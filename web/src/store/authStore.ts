import { create } from 'zustand';
import axios from 'axios';
import { CSRF_HEADER, CSRF_VALUE } from '../api/csrf';
import type { UserProfile } from '../api/types';
import { BFF_BASE } from '../config';

/**
 * 로그인 상태. 로그인과 토큰 관리는 서버(BFF)가 맡는다: 브라우저는 HttpOnly 세션 쿠키만 가지고 있어서
 * 여기에는 토큰이 없고, 서버가 알려 주는 "누구로 로그인했는가" 만 있다.
 */
interface AuthState {
  user: UserProfile | null;
  role: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setUser: (user: UserProfile | null) => void;
  /** 서버에 현재 로그인 상태를 물어 반영한다. 앱 시작 때 한 번 호출한다. */
  loadSession: () => Promise<void>;
  /** Doro 로그인 화면으로 이동한다. 로그인이 끝나면 지금 보던 페이지로 돌아온다. */
  login: () => void;
  signOut: () => Promise<void>;
  /** 서버가 401 을 돌려줬다: 세션이 끝난 것이므로 화면 상태를 비로그인으로 맞춘다. */
  markSignedOut: () => void;
}

interface SessionResponse {
  data?: { authenticated?: boolean; user?: UserProfile | null; role?: string | null };
}

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const SIGNED_OUT = { user: null, role: null, isAuthenticated: false, isAdmin: false } as const;

/** 로그인 후 돌아올 곳을 담은 로그인 시작 주소. 서버가 사이트 안의 경로인지 한 번 더 검증한다. */
export function buildLoginUrl(returnPath: string): string {
  return `${BFF_BASE}/login?return=${encodeURIComponent(returnPath)}`;
}

export const useAuthStore = create<AuthState>((set) => ({
  ...SIGNED_OUT,

  setUser: (user) => set({ user }),

  loadSession: async () => {
    try {
      const response = await axios.get<SessionResponse>(`${BFF_BASE}/session`, { headers: { [CSRF_HEADER]: CSRF_VALUE } });
      const data = response.data?.data;
      if (data?.authenticated && data.user) {
        const role = data.role ?? null;
        set({ user: data.user, role, isAuthenticated: true, isAdmin: role !== null && ADMIN_ROLES.has(role.toUpperCase()) });
      } else {
        set(SIGNED_OUT);
      }
    } catch (error) {
      // 서버에 닿지 못해도 앱은 비로그인 상태로 뜬다
      console.warn('Failed to load the login session', error);
      set(SIGNED_OUT);
    }
  },

  login: () => {
    window.location.assign(buildLoginUrl(`${window.location.pathname}${window.location.search}`));
  },

  signOut: async () => {
    try {
      await axios.post(`${BFF_BASE}/logout`, null, { headers: { [CSRF_HEADER]: CSRF_VALUE } });
    } catch (error) {
      // 서버 호출이 실패해도 이 화면은 로그아웃 상태로 보인다(쿠키가 남아 있으면 다음 요청에서 다시 확인된다)
      console.warn('Logout request failed', error);
    }
    set(SIGNED_OUT);
  },

  markSignedOut: () => set(SIGNED_OUT),
}));

/**
 * 이전 로그인 방식(브라우저가 토큰을 직접 보관)이 남긴 값들. 지금은 쓰지 않지만 localStorage 에 리프레시 토큰이 남아 있으면
 * XSS 나 같은 기기의 다른 사용자가 꺼내 쓸 수 있으므로 한 번 지운다. (doro_auth_accounts 는 포털과 공유하는 키라 건드리지 않는다)
 */
const LEGACY_LOGIN_KEYS = ['doro_blog_token', 'doro_blog_refresh_token', 'doro_blog_user', 'doro_saved_accounts'];

export function purgeLegacyLoginStorage(): void {
  try {
    LEGACY_LOGIN_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Could not clear legacy login storage', error);
  }
}

/** 앱 시작 때 호출한다 (main.tsx). 서버가 알려 주는 로그인 상태를 받은 뒤에 화면을 그린다. */
export function initAuth(): Promise<void> {
  purgeLegacyLoginStorage();
  return useAuthStore.getState().loadSession();
}
