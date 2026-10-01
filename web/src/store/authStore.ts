import { create } from 'zustand';
import axios from 'axios';
import { UserProfile } from '../api/types';
import {
  RefreshOutcome,
  emailOfToken,
  findFresherSharedTokens,
  requestTokenRefresh,
  withRefreshLock,
  writeBackSharedTokens,
} from '../api/tokenRefresh';

export interface SavedAccount {
  userId: string;
  email: string;
  name: string;
  nickname?: string;
  profileImageUrl?: string | null;
  accessToken?: string;
  refreshToken?: string;
  lastUsedAt?: number;
}

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
  loginWithMock: (username: string, email: string, userId: string) => void;
  refreshAuthToken: () => Promise<string | null>;
  /** 갱신 결과를 refreshed/rejected/unavailable 로 구분해 돌려준다. rejected 일 때만 로그아웃해야 한다. */
  refreshSession: () => Promise<RefreshOutcome>;
  logout: () => void;
}

const STORAGE_KEY_TOKEN = 'doro_blog_token';
const STORAGE_KEY_REFRESH = 'doro_blog_refresh_token';
const STORAGE_KEY_USER = 'doro_blog_user';
const STORAGE_KEY_SAVED_ACCOUNTS = 'doro_saved_accounts';
const STORAGE_KEY_PLATFORM_ACCOUNTS = 'doro_auth_accounts';

export function getSavedAccounts(): SavedAccount[] {
  const accountMap = new Map<string, SavedAccount>();

  // 1. Read from blog's saved accounts
  try {
    const rawBlog = localStorage.getItem(STORAGE_KEY_SAVED_ACCOUNTS);
    if (rawBlog) {
      const parsed: SavedAccount[] = JSON.parse(rawBlog);
      parsed.forEach((acc) => {
        if (acc.email) accountMap.set(acc.email.toLowerCase(), acc);
      });
    }
  } catch {
    // ignore
  }

  // 2. Read from DORO IAM portal standard accounts (doro_auth_accounts)
  try {
    const rawPortal = localStorage.getItem(STORAGE_KEY_PLATFORM_ACCOUNTS);
    if (rawPortal) {
      const parsed = JSON.parse(rawPortal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, unknown>) => {
          const email = typeof item.email === 'string' ? item.email : null;
          if (email) {
            const emailKey = email.toLowerCase();
            const existing = accountMap.get(emailKey);
            accountMap.set(emailKey, {
              userId: (typeof item.userId === 'string' ? item.userId : '') || existing?.userId || '',
              email: email,
              name: (typeof item.fullName === 'string' ? item.fullName : (typeof item.name === 'string' ? item.name : '')) || existing?.name || email.split('@')[0],
              nickname: existing?.nickname,
              profileImageUrl: (typeof item.profileImageUrl === 'string' ? item.profileImageUrl : null) || existing?.profileImageUrl,
              accessToken: (typeof item.accessToken === 'string' ? item.accessToken : undefined) || existing?.accessToken,
              refreshToken: (typeof item.refreshToken === 'string' ? item.refreshToken : undefined) || existing?.refreshToken,
              lastUsedAt: existing?.lastUsedAt || Date.now(),
            });
          }
        });
      }
    }
  } catch {
    // ignore
  }

  return Array.from(accountMap.values()).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function saveAccountHistory(account: Partial<SavedAccount> & { email: string }) {
  const current = getSavedAccounts();
  const emailKey = account.email.toLowerCase();
  const existingIdx = current.findIndex((a) => a.email.toLowerCase() === emailKey);

  const updated: SavedAccount = {
    userId: account.userId || (existingIdx >= 0 ? current[existingIdx].userId : ''),
    email: account.email,
    name: account.name || (existingIdx >= 0 ? current[existingIdx].name : account.email.split('@')[0]),
    nickname: account.nickname || (existingIdx >= 0 ? current[existingIdx].nickname : undefined),
    profileImageUrl: account.profileImageUrl !== undefined ? account.profileImageUrl : (existingIdx >= 0 ? current[existingIdx].profileImageUrl : undefined),
    accessToken: account.accessToken || (existingIdx >= 0 ? current[existingIdx].accessToken : undefined),
    refreshToken: account.refreshToken || (existingIdx >= 0 ? current[existingIdx].refreshToken : undefined),
    lastUsedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = updated;
  } else {
    current.unshift(updated);
  }

  try {
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function removeSavedAccount(email: string) {
  const current = getSavedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}

// Parse JWT payload safely and check expiration
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64Url)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Expired if current time >= exp (in ms) - 5 seconds margin
    return Date.now() >= payload.exp * 1000 - 5000;
  } catch {
    return true;
  }
}

export function getUserRole(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64Url)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.role || null;
  } catch {
    return null;
  }
}

export function isUserAdmin(token: string | null): boolean {
  const role = getUserRole(token);
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

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

  try {
    const parts = token.split('.');
    if (parts.length < 2) return;
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64Url));
    if (!payload.exp) return;

    const remainingMs = payload.exp * 1000 - Date.now();
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

    if (remainingMs <= 0) {
      void handleRefresh();
      return;
    }

    // 만료 5분 전(짧은 토큰은 60초 전)에 조용히 갱신한다.
    const refreshTriggerMs = remainingMs > 600000
      ? remainingMs - 300000
      : Math.max(0, remainingMs - 60000);

    expirationTimer = setTimeout(handleRefresh, refreshTriggerMs > 0 ? refreshTriggerMs : remainingMs);
  } catch (e) {
    console.error('Failed to schedule token expiration timer', e);
  }
}

// Simple base64 JWT generator for local dev without IAM login
function generateDevJwt(userId: string, email: string, username: string): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      email: email,
      username: username,
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    })
  );
  return `${header}.${payload}.signature`;
}

// Initial state calculation: verify token expiration right away
const rawToken = localStorage.getItem(STORAGE_KEY_TOKEN);
const rawRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
let initialToken: string | null = null;
let initialUser: UserProfile | null = null;

if (rawToken && !isTokenExpired(rawToken)) {
  initialToken = rawToken;
  const savedUserJson = localStorage.getItem(STORAGE_KEY_USER);
  if (savedUserJson) {
    try {
      initialUser = JSON.parse(savedUserJson);
    } catch {
      // ignore
    }
  }
  scheduleExpiration(initialToken);
} else if (rawToken) {
  // Access token is expired, but do we have a refresh token?
  // Let the client interceptor or app try silent refresh when needed,
  // or clean up if no refresh token exists.
  if (!rawRefreshToken) {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
  } else {
    // Keep user state for seamless optimistic refresh
    const savedUserJson = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUserJson) {
      try {
        initialUser = JSON.parse(savedUserJson);
      } catch {
        // ignore
      }
    }
  }
}

if (rawRefreshToken && (!rawToken || isTokenExpired(rawToken))) {
  // Silent bootstrap refresh on page load so the session is restored instantly
  setTimeout(() => {
    useAuthStore.getState().refreshAuthToken().catch((e) => {
      console.warn('Initial background silent refresh failed', e);
    });
  }, 0);
}

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
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      if (refreshToken !== undefined) {
        if (refreshToken) {
          localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
        } else {
          localStorage.removeItem(STORAGE_KEY_REFRESH);
        }
      }
      scheduleExpiration(token);
      set({ 
        token, 
        refreshToken: refreshToken !== undefined ? refreshToken : get().refreshToken, 
        isAuthenticated: true,
        isAdmin: isUserAdmin(token),
        role: getUserRole(token),
      });
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

    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    }
    scheduleExpiration(accessToken);

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

    set({ 
      token: accessToken, 
      refreshToken: refreshToken || null, 
      user: userProfile, 
      isAuthenticated: true,
      isAdmin: isUserAdmin(accessToken),
      role: getUserRole(accessToken),
      loginModalOpen: false,
    });
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

    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    }
    scheduleExpiration(accessToken);

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

    set({
      token: accessToken,
      refreshToken: refreshToken || null,
      user: userProfile,
      isAuthenticated: true,
      isAdmin: isUserAdmin(accessToken),
      role: getUserRole(accessToken),
      loginModalOpen: false,
    });
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
      // 다른 탭이 이미 갱신했을 수 있으므로 메모리 상태보다 localStorage 의 최신 값을 우선한다.
      const currentAccess = localStorage.getItem(STORAGE_KEY_TOKEN) || get().token;
      const currentRefresh = localStorage.getItem(STORAGE_KEY_REFRESH) || get().refreshToken;
      if (!currentRefresh) {
        return { kind: 'rejected' };
      }
      const email = emailOfToken(currentAccess);

      const adopt = (accessToken: string, refreshToken: string): RefreshOutcome => {
        localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
        scheduleExpiration(accessToken);
        set({
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          isAdmin: isUserAdmin(accessToken),
          role: getUserRole(accessToken),
        });
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

  loginWithMock: (username, email, userId) => {
    const devToken = generateDevJwt(userId, email, username);
    const mockProfile: UserProfile = {
      id: userId,
      username: username,
      email: email,
      nickname: username,
      blogTitle: `${username}.log`,
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_TOKEN, devToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockProfile));
    scheduleExpiration(devToken);
    set({ token: devToken, refreshToken: null, user: mockProfile, isAuthenticated: true, isAdmin: false, role: 'USER' });
  },

  logout: () => {
    clearExpirationTimer();
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isAdmin: false, role: null });
  },
}));
