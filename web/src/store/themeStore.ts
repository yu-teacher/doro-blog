import { create } from 'zustand';

interface ThemeState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

const STORAGE_KEY_THEME = 'doro_blog_theme';

const getInitialTheme = (): 'dark' | 'light' => {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
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
  localStorage.setItem(STORAGE_KEY_THEME, theme);
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
