import { create } from 'zustand';
import axios from 'axios';
import { decodeJwtPayload, getUserRole, isTokenExpired, isUserAdmin } from '../utils/jwt';
import { clearSavedAccountTokens, saveAccountHistory, type SavedAccount } from './savedAccounts';
import { revokeServerSession } from '../api/sessionRevocation';
import { UserProfile } from '../api/types';
import {
  RefreshOutcome,
  emailOfToken,
  findFresherSharedTokens,
  requestTokenRefresh,
  withRefreshLock,
  writeBackSharedTokens,
} from '../api/tokenRefresh';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: string | null;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setToken: (token: string | null, refreshToken?: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  loginWithIam: (email: string, password: string) => Promise<void>;
  loginWithSavedAccount: (account: SavedAccount) => Promise<void>;
  signupWithIam: (email: string, password: string, name: string) => Promise<void>;
  refreshAuthToken: () => Promise<string | null>;
  /** 갱신 결과를 refreshed/rejected/unavailable 로 구분해 돌려준다. rejected 일 때만 로그아웃해야 한다. */
  refreshSession: () => Promise<RefreshOutcome>;
  /** 이 브라우저의 로그인 상태만 지운다. 세션이 이미 끝났거나 다른 탭이 로그아웃한 경우에 쓴다. */
  logout: () => void;
  /** 사용자가 직접 로그아웃: 로컬 상태를 지우고 서버 세션도 폐기한다. */
  signOut: () => Promise<void>;
}

const STORAGE_KEY_TOKEN = 'doro_blog_token';
const STORAGE_KEY_REFRESH = 'doro_blog_refresh_token';
const STORAGE_KEY_USER = 'doro_blog_user';

/** 토큰 수명이 이 값보다 길면 만료 5분 전에, 짧으면 1분 전에 미리 갱신한다. */
const LONG_LIVED_TOKEN_MS = 10 * 60_000;
const REFRESH_AHEAD_LONG_MS = 5 * 60_000;
const REFRESH_AHEAD_SHORT_MS = 60_000;

const REFRESH_RETRY_DELAY_MS = 30_000;

// Module-level timer for active session expiration tracking
let expirationTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpirationTimer() {
  if (expirationTimer) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }
}

function scheduleExpiration(token: string | null) {
  clearExpirationTimer();
  if (!token) return;

  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== 'number') return;

  const handleRefresh = async () => {
    const outcome = await useAuthStore.getState().refreshSession();
    if (outcome.kind === 'rejected') {
      // 서버가 리프레시 토큰을 거부한 경우에만 세션을 종료한다.
      const state = useAuthStore.getState();
      state.logout();
      state.openLoginModal();
    } else if (outcome.kind === 'unavailable') {
      // 네트워크/서버 일시 장애: 로그인 상태를 유지하고 잠시 후 다시 시도한다.
      expirationTimer = setTimeout(handleRefresh, REFRESH_RETRY_DELAY_MS);
    }
  };

  const remainingMs = exp * 1000 - Date.now();
  if (remainingMs <= 0) {
    void handleRefresh();
    return;
  }

  const refreshAheadMs = remainingMs > LONG_LIVED_TOKEN_MS ? REFRESH_AHEAD_LONG_MS : REFRESH_AHEAD_SHORT_MS;
  const delayMs = remainingMs - refreshAheadMs;
  expirationTimer = setTimeout(handleRefresh, delayMs > 0 ? delayMs : remainingMs);
}

/** 액세스/리프레시 토큰을 저장소에 기록하고 만료 타이머를 맞춘다. refreshToken 이 undefined 면 기존 값을 유지한다. */
function persistTokens(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
  if (refreshToken !== undefined) {
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_REFRESH);
    }
  }
  scheduleExpiration(accessToken);
}

/** 토큰에서 파생되는 인증 상태. 저장하는 값과 파생값이 어긋나지 않도록 한 곳에서만 만든다. */
function sessionFields(accessToken: string) {
  return {
    token: accessToken,
    isAuthenticated: true,
    isAdmin: isUserAdmin(accessToken),
    role: getUserRole(accessToken),
  };
}

function readStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    console.warn('Ignoring unreadable stored user profile', e);
    return null;
  }
}

// 초기 상태 계산: 저장된 토큰이 이미 만료되었는지 즉시 확인한다. (부수 효과인 타이머/갱신은 initAuth 에서 시작한다)
const rawToken = localStorage.getItem(STORAGE_KEY_TOKEN);
const rawRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
let initialToken: string | null = null;
let initialUser: UserProfile | null = null;

if (rawToken && !isTokenExpired(rawToken)) {
  initialToken = rawToken;
  initialUser = readStoredUser();
} else if (rawToken) {
  if (!rawRefreshToken) {
    // 만료되었고 갱신 수단도 없으면 저장소를 비운다.
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
  } else {
    // 리프레시 토큰이 있으면 사용자 정보를 유지해 화면이 깜빡이지 않게 한다.
    initialUser = readStoredUser();
  }
}

const LOGGED_OUT_STATE = { token: null, refreshToken: null, user: null, isAuthenticated: false, isAdmin: false, role: null } as const;

let activeRefreshPromise: Promise<RefreshOutcome> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialToken,
  refreshToken: rawRefreshToken,
  user: initialUser,
  isAuthenticated: !!initialToken || !!rawRefreshToken,
  isAdmin: isUserAdmin(initialToken),
  role: getUserRole(initialToken),
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),

  setToken: (token, refreshToken) => {
    if (token && !isTokenExpired(token)) {
      persistTokens(token, refreshToken);
      set({ ...sessionFields(token), refreshToken: refreshToken !== undefined ? refreshToken : get().refreshToken });
    } else {
      clearExpirationTimer();
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      set({ token: null, refreshToken: null, isAuthenticated: false, isAdmin: false, role: null, user: null });
    }
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
    set({ user });
  },

  loginWithIam: async (email: string, password: string) => {
    const loginRes = await axios.post('/iam/api/v1/auth/login', { email, password });
    const { accessToken, refreshToken } = loginRes.data.data.tokens;

    persistTokens(accessToken, refreshToken);

    const profileRes = await axios.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userProfile = profileRes.data.data;

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));

    saveAccountHistory({
      userId: userProfile.id,
      email: email,
      name: userProfile.nickname || email.split('@')[0],
      nickname: userProfile.nickname,
      profileImageUrl: userProfile.profileImageUrl,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });

    set({ ...sessionFields(accessToken), refreshToken: refreshToken || null, user: userProfile, loginModalOpen: false });
  },

  loginWithSavedAccount: async (account: SavedAccount) => {
    let accessToken = account.accessToken;
    let refreshToken = account.refreshToken;

    // Check if current accessToken is valid
    if (!accessToken || isTokenExpired(accessToken)) {
      if (!refreshToken) {
        throw new Error('REAUTH_REQUIRED');
      }

      try {
        const res = await axios.post('/iam/api/v1/auth/token/refresh', {
          refreshToken: refreshToken,
        });
        accessToken = res.data?.data?.accessToken;
        if (res.data?.data?.refreshToken) {
          refreshToken = res.data.data.refreshToken;
        }
        if (!accessToken) {
          throw new Error('REAUTH_REQUIRED');
        }
        // 회전된 리프레시 토큰을 포털과 공유하는 저장소에도 반영해 포털이 폐기된 토큰을 쓰지 않게 한다.
        if (refreshToken) {
          writeBackSharedTokens(emailOfToken(accessToken) ?? account.email.toLowerCase(), accessToken, refreshToken);
        }
      } catch {
        throw new Error('REAUTH_REQUIRED');
      }
    }

    persistTokens(accessToken, refreshToken);

    const profileRes = await axios.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userProfile = profileRes.data.data;

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));

    saveAccountHistory({
      userId: userProfile.id || account.userId,
      email: account.email,
      name: account.name || userProfile.nickname,
      nickname: userProfile.nickname,
      profileImageUrl: userProfile.profileImageUrl || account.profileImageUrl,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });

    set({ ...sessionFields(accessToken), refreshToken: refreshToken || null, user: userProfile, loginModalOpen: false });
  },

  refreshAuthToken: async () => {
    const outcome = await get().refreshSession();
    return outcome.kind === 'refreshed' ? outcome.accessToken : null;
  },

  refreshSession: () => {
    if (activeRefreshPromise) {
      return activeRefreshPromise;
    }

    const promise = withRefreshLock(async (): Promise<RefreshOutcome> => {
      // localStorage 가 기준이다: 다른 탭이 갱신했을 수도, 로그아웃했을 수도 있다.
      // 저장소에 토큰이 없는데 메모리 값으로 갱신하면 다른 탭에서 한 로그아웃을 되살리게 된다.
      const currentAccess = localStorage.getItem(STORAGE_KEY_TOKEN);
      const currentRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
      if (!currentRefresh) {
        return { kind: 'rejected' };
      }
      const email = emailOfToken(currentAccess);

      const adopt = (accessToken: string, refreshToken: string): RefreshOutcome => {
        persistTokens(accessToken, refreshToken);
        set({ ...sessionFields(accessToken), refreshToken });
        return { kind: 'refreshed', accessToken, refreshToken };
      };

      // 1) 이 탭 메모리와 다른 유효한 토큰이 저장소에 있으면 다른 탭이 갱신한 것이다.
      if (currentAccess && currentAccess !== get().token && !isTokenExpired(currentAccess)) {
        return adopt(currentAccess, currentRefresh);
      }
      // 2) 포털이 같은 계정으로 더 최근에 갱신했다면 그 토큰을 그대로 쓴다. (다시 회전시키면 포털 토큰이 폐기된다)
      const shared = findFresherSharedTokens(email, currentAccess);
      if (shared) {
        return adopt(shared.accessToken, shared.refreshToken);
      }

      const outcome = await requestTokenRefresh(currentRefresh);
      if (outcome.kind === 'refreshed') {
        writeBackSharedTokens(email, outcome.accessToken, outcome.refreshToken);
        return adopt(outcome.accessToken, outcome.refreshToken);
      }
      return outcome;
    }).finally(() => {
      activeRefreshPromise = null;
    });

    activeRefreshPromise = promise;
    return promise;
  },

  signupWithIam: async (email: string, password: string, name: string) => {
    await axios.post('/iam/api/v1/auth/signup', { email, password, name });
  },

  logout: () => {
    const { token, user } = get();
    const email = emailOfToken(token) ?? user?.email?.toLowerCase() ?? null;
    clearExpirationTimer();
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
    if (email) clearSavedAccountTokens(email);
    set(LOGGED_OUT_STATE);
  },

  signOut: async () => {
    // 로컬 토큰을 지우기 전에 서버에 보낼 값을 잡아 둔다
    const accessToken = localStorage.getItem(STORAGE_KEY_TOKEN) ?? get().token;
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH) ?? get().refreshToken;
    get().logout();
    await revokeServerSession(accessToken, refreshToken);
  },
}));

/**
 * 앱 시작 시 한 번 호출한다 (main.tsx). 모듈 로드 시점의 부수 효과 대신 명시적으로 세션을 시작한다.
 * - 유효한 액세스 토큰이 있으면 만료 전 자동 갱신 타이머를 건다.
 * - 액세스 토큰이 없거나 만료되었고 리프레시 토큰이 있으면 즉시 조용히 갱신한다.
 */
export function initAuth(): void {
  syncAuthAcrossTabs();
  const { token, refreshToken } = useAuthStore.getState();
  if (token && !isTokenExpired(token)) {
    scheduleExpiration(token);
    return;
  }
  if (refreshToken) {
    useAuthStore.getState().refreshAuthToken().catch((e: unknown) => {
      console.warn('Initial background silent refresh failed', e);
    });
  }
}

let storageSyncStarted = false;

/**
 * 다른 탭에서 일어난 로그인/갱신/로그아웃을 이 탭의 상태에 반영한다.
 * storage 이벤트는 값을 바꾼 탭이 아닌 다른 탭에만 오므로 되돌림(핑퐁)이 생기지 않는다.
 * 이 탭이 localStorage 에 다시 쓰지 않는 것이 중요하다: 다시 쓰면 다른 탭의 로그아웃을 되살리게 된다.
 */
function syncAuthAcrossTabs(): void {
  if (storageSyncStarted || typeof window === 'undefined') return;
  storageSyncStarted = true;

  window.addEventListener('storage', (event: StorageEvent) => {
    const { key } = event;
    if (key !== null && key !== STORAGE_KEY_TOKEN && key !== STORAGE_KEY_REFRESH && key !== STORAGE_KEY_USER) return;

    const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);

    if (!storedToken && !storedRefresh) {
      // 다른 탭이 로그아웃했다 (또는 저장소가 통째로 비워졌다)
      clearExpirationTimer();
      useAuthStore.setState(LOGGED_OUT_STATE);
      return;
    }

    const current = useAuthStore.getState();
    if (storedToken && storedToken !== current.token && !isTokenExpired(storedToken)) {
      // 다른 탭이 로그인하거나 토큰을 갱신했다
      scheduleExpiration(storedToken);
      useAuthStore.setState({ ...sessionFields(storedToken), refreshToken: storedRefresh, user: readStoredUser() ?? current.user });
      return;
    }
    if (storedRefresh !== current.refreshToken || key === STORAGE_KEY_USER) {
      useAuthStore.setState({ refreshToken: storedRefresh, user: readStoredUser() ?? current.user });
    }
  });
}
