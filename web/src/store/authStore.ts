import { create } from 'zustand';
import { UserProfile } from '../api/types';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  loginWithMock: (username: string, email: string, userId: string) => void;
  logout: () => void;
}

const STORAGE_KEY_TOKEN = 'doro_blog_token';
const STORAGE_KEY_USER = 'doro_blog_user';

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

export const useAuthStore = create<AuthState>((set) => {
  const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const savedUserJson = localStorage.getItem(STORAGE_KEY_USER);
  let savedUser: UserProfile | null = null;
  if (savedUserJson) {
    try {
      savedUser = JSON.parse(savedUserJson);
    } catch {
      // ignore
    }
  }

  return {
    token: savedToken,
    user: savedUser,
    isAuthenticated: !!savedToken,

    setToken: (token) => {
      if (token) {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        set({ token, isAuthenticated: true });
      } else {
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

    loginWithMock: (username, email, userId) => {
      const devToken = generateDevJwt(userId, email, username);
      const mockProfile: UserProfile = {
        id: userId,
        username: username,
        email: email,
        nickname: username,
        blogTitle: `${username}.log`,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY_TOKEN, devToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockProfile));
      set({ token: devToken, user: mockProfile, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});
