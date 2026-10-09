import { create } from 'zustand';

type Admin = { id: string; email: string; role: 'SUPER_ADMIN' | 'MANAGER' | 'SUPPORT' };

type State = {
  admin: Admin | null;
  theme: 'light' | 'dark';
  sidebar: boolean;
  setAdmin: (a: Admin | null) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
};

function initialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('tz_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

export const useStore = create<State>((set) => ({
  admin: null,
  theme: initialTheme(),
  sidebar: true,
  setAdmin: (admin) => set({ admin }),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('tz_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return { theme: next };
    }),
  toggleSidebar: () => set((s) => ({ sidebar: !s.sidebar })),
}));

export function applyTheme() {
  document.documentElement.classList.toggle('dark', initialTheme() === 'dark');
}
