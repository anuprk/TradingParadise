import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type ThemeMode = 'dark' | 'light';

interface AppState {
  activePlanId: string | null;
  isLoading: boolean;
  toasts: Toast[];
  theme: ThemeMode;

  setActivePlanId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

let toastCounter = 0;

function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tp-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'dark';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('tp-theme', theme);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  activePlanId: null,
  isLoading: false,
  toasts: [],
  theme: getInitialTheme(),

  setActivePlanId: (id) => set({ activePlanId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  addToast: (message, type) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));

// Apply theme on initial load
applyTheme(getInitialTheme());
