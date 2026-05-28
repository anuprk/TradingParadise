import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { useAppStore } from './appStore';
import { usePlanStore } from './planStore';
import { usePortfolioStore } from './portfolioStore';
import { useJournalStore } from './journalStore';
import { useReminderStore } from './reminderStore';
import { useTransactionStore } from './transactionStore';

declare const __APP_VERSION__: string;

const APP_VERSION_KEY = 'app_version';

function mapAuthError(error: AuthError): string {
  const msg = error.message;

  if (msg.includes('User already registered')) {
    return 'An account with this email already exists.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Password must be at least 8 characters.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.';
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
    return 'Network error — unable to reach the server. Check your connection.';
  }

  // Show the actual error for debugging unhandled cases
  return `Auth error: ${msg}`;
}

function clearAppData() {
  useAppStore.setState({ activePlanId: null });
  usePlanStore.setState({ currentPlan: null, plans: [], isDirty: false });
  usePortfolioStore.setState({ portfolios: [], currentPortfolio: null, metrics: null });
  useJournalStore.setState({ entries: [], filters: {} });
  useReminderStore.setState({ reminders: [] });
  useTransactionStore.setState({
    transactions: [],
    holdings: [],
    totalCount: 0,
    currentPage: 1,
  });
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true });

    // Force logout if app version changed (new deployment)
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    if (storedVersion && currentVersion && storedVersion !== currentVersion) {
      localStorage.setItem(APP_VERSION_KEY, currentVersion);
      await supabase.auth.signOut();
      set({ user: null, session: null, isLoading: false });
      clearAppData();
      return;
    }
    if (currentVersion) {
      localStorage.setItem(APP_VERSION_KEY, currentVersion);
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        set({ user: null, session: null, error: mapAuthError(error) });
        return;
      }
      set({
        session: data.session,
        user: data.session?.user ?? null,
      });
    } finally {
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null });
      if (!session) {
        clearAppData();
      }
      // Handle token refresh failure — treat as sign-out
      if (event === 'TOKEN_REFRESHED' && !session) {
        clearAppData();
      }
      // Handle explicit sign-out from another tab
      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null });
        clearAppData();
      }
    });
  },

  signUp: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ error: mapAuthError(error) });
      return;
    }
    set({ session: data.session, user: data.user });
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: mapAuthError(error) });
      return;
    }
    set({ session: data.session, user: data.user });
  },

  signOut: async () => {
    set({ error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ error: mapAuthError(error) });
      return;
    }
    set({ user: null, session: null });
    clearAppData();
  },

  resetPassword: async (email) => {
    set({ error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      set({ error: mapAuthError(error) });
    }
  },

  updatePassword: async (newPassword) => {
    set({ error: null });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      set({ error: mapAuthError(error) });
    }
  },

  clearError: () => set({ error: null }),
}));
