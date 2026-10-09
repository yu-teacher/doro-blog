import { create } from 'zustand';

interface ThemeState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

const STORAGE_KEY_THEME = 'doro_blog_theme';

/** 저장소 접근이 막힌 환경(쿠키 차단, 일부 임베디드·사생활 보호 모드)에서도 앱이 떠야 하므로, 읽기·쓰기 실패는 기본값으로 대신한다. */
const readSavedTheme = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_THEME);
  } catch (err) {
    console.warn('Theme preference could not be read; using the default theme.', err);
    return null;
  }
};

const getInitialTheme = (): 'dark' | 'light' => {
  const saved = readSavedTheme();
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  // Default to dark as requested by user
  return 'dark';
};

const applyTheme = (theme: 'dark' | 'light') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch (err) {
    console.warn('Theme preference could not be saved.', err);
  }
};

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getInitialTheme();
  applyTheme(initial);

  return {
    theme: initial,
    toggleTheme: () => {
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return { theme: next };
      });
    },
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
  };
});
