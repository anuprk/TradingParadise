import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  activePlanId: string | null;
  isLoading: boolean;
  toasts: Toast[];

  setActivePlanId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  activePlanId: null,
  isLoading: false,
  toasts: [],

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
}));
