import { create } from 'zustand';
import axios from 'axios';
import { UserProfile } from '../api/types';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  loginWithIam: (email: string, password: string) => Promise<void>;
  signupWithIam: (email: string, password: string, name: string) => Promise<void>;
  loginWithMock: (username: string, email: string, userId: string) => void;
  logout: () => void;
}

const STORAGE_KEY_TOKEN = 'doro_blog_token';
const STORAGE_KEY_USER = 'doro_blog_user';

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

// Module-level timer for active session expiration tracking
let expirationTimer: any = null;

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
    if (remainingMs <= 0) {
      useAuthStore.getState().logout();
      useAuthStore.getState().openLoginModal();
      return;
    }

    expirationTimer = setTimeout(() => {
      console.warn('DORO Auth: Access token expired. Resetting session to prevent ghost login.');
      const state = useAuthStore.getState();
      state.logout();
      state.openLoginModal();
    }, remainingMs);
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
  // Stale expired token in localStorage: purge immediately
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USER);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: initialToken,
  user: initialUser,
  isAuthenticated: !!initialToken,
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),

  setToken: (token) => {
    if (token && !isTokenExpired(token)) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      scheduleExpiration(token);
      set({ token, isAuthenticated: true });
    } else {
      clearExpirationTimer();
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      set({ token: null, isAuthenticated: false, user: null });
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
    const accessToken = loginRes.data.data.tokens.accessToken;

    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    scheduleExpiration(accessToken);

    const profileRes = await axios.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userProfile = profileRes.data.data;

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userProfile));
    set({ token: accessToken, user: userProfile, isAuthenticated: true });
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
    set({ token: devToken, user: mockProfile, isAuthenticated: true });
  },

  logout: () => {
    clearExpirationTimer();
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
