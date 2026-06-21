/**
 * Integration tests for auth flow and data access.
 *
 * Tests:
 * 1. Sign-up → sign-in → sign-out lifecycle with mocked Supabase
 * 2. ProtectedRoute redirects unauthenticated users and renders for authenticated users
 * 3. Repository error handling surfaces toast messages via the app store
 *
 * Requirements: 4.1, 5.1, 7.1, 7.2, 11.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Supabase mock ---

let mockSession: any = null;
let mockUser: any = null;
let _authStateCallback: ((event: string, session: any) => void) | null = null;
// Force TypeScript to consider _authStateCallback as "read"
void _authStateCallback;

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockSession },
        error: null,
      })),
      signUp: vi.fn(async ({ email }: { email: string; password: string }) => {
        mockUser = { id: 'user-123', email };
        mockSession = { user: mockUser, access_token: 'token-abc' };
        return { data: { user: mockUser, session: mockSession }, error: null };
      }),
      signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
        mockUser = { id: 'user-123', email };
        mockSession = { user: mockUser, access_token: 'token-abc' };
        return { data: { user: mockUser, session: mockSession }, error: null };
      }),
      signOut: vi.fn(async () => {
        mockUser = null;
        mockSession = null;
        return { error: null };
      }),
      onAuthStateChange: vi.fn((cb: (event: string, session: any) => void) => {
        _authStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getUser: vi.fn(async () => ({
        data: { user: mockUser },
        error: null,
      })),
    },
    from: vi.fn((_table: string) => {
      const chain: Record<string, any> = {};
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.update = vi.fn(() => chain);
      chain.delete = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.range = vi.fn(() => chain);
      chain.ilike = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.single = vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null }));
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
      chain.then = (resolve: any) => resolve({ data: [], error: null, count: 0 });
      return chain;
    }),
  },
}));

// Import stores after mocking supabase
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { usePlanStore } from '../stores/planStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useJournalStore } from '../stores/journalStore';
import { useReminderStore } from '../stores/reminderStore';
import { useTransactionStore } from '../stores/transactionStore';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// --- Helpers ---

function resetStores() {
  mockSession = null;
  mockUser = null;
  _authStateCallback = null;

  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    error: null,
  });
  useAppStore.setState({ activePlanId: null, toasts: [] });
  usePlanStore.setState({ currentPlan: null, plans: [], isDirty: false });
  usePortfolioStore.setState({ portfolios: [], currentPortfolio: null, metrics: null });
  useJournalStore.setState({ entries: [], filters: {} });
  useReminderStore.setState({ reminders: [] });
  useTransactionStore.setState({ transactions: [], holdings: [], totalCount: 0, currentPage: 1 });
}

function renderProtectedRoute(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Dashboard Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// --- Tests ---

describe('Integration: Auth flow lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  describe('sign-up → sign-in → sign-out cycle', () => {
    it('signUp creates a user and establishes a session', async () => {
      const store = useAuthStore.getState();

      await act(async () => {
        await store.signUp('test@example.com', 'password123');
      });

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('test@example.com');
      expect(state.session).not.toBeNull();
      expect(state.error).toBeNull();
    });

    it('signIn establishes a session for an existing user', async () => {
      const store = useAuthStore.getState();

      await act(async () => {
        await store.signIn('test@example.com', 'password123');
      });

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.id).toBe('user-123');
      expect(state.session).not.toBeNull();
      expect(state.session?.access_token).toBe('token-abc');
      expect(state.error).toBeNull();
    });

    it('signOut clears the session and all app data', async () => {
      // First sign in to establish state
      await act(async () => {
        await useAuthStore.getState().signIn('test@example.com', 'password123');
      });

      // Populate app stores with data
      useAppStore.setState({ activePlanId: 'plan-1' });
      usePlanStore.setState({
        currentPlan: { id: 'plan-1', name: 'My Plan' } as any,
        plans: [{ id: 'plan-1', name: 'My Plan' }] as any[],
        isDirty: true,
      });
      usePortfolioStore.setState({
        portfolios: [{ id: 'port-1', name: 'Portfolio' }] as any[],
        currentPortfolio: { id: 'port-1' } as any,
      });
      useJournalStore.setState({
        entries: [{ id: 'entry-1' }] as any[],
        filters: { planId: 'plan-1' },
      });
      useReminderStore.setState({
        reminders: [{ id: 'rem-1' }] as any[],
      });
      useTransactionStore.setState({
        transactions: [{ id: 'tx-1' }] as any[],
        holdings: [{ symbol: 'AAPL' }] as any[],
        totalCount: 5,
        currentPage: 2,
      });

      // Sign out
      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      // Auth state cleared
      const authState = useAuthStore.getState();
      expect(authState.user).toBeNull();
      expect(authState.session).toBeNull();

      // App data cleared
      expect(useAppStore.getState().activePlanId).toBeNull();
      expect(usePlanStore.getState().plans).toEqual([]);
      expect(usePlanStore.getState().currentPlan).toBeNull();
      expect(usePlanStore.getState().isDirty).toBe(false);
      expect(usePortfolioStore.getState().portfolios).toEqual([]);
      expect(usePortfolioStore.getState().currentPortfolio).toBeNull();
      expect(useJournalStore.getState().entries).toEqual([]);
      expect(useJournalStore.getState().filters).toEqual({});
      expect(useReminderStore.getState().reminders).toEqual([]);
      expect(useTransactionStore.getState().transactions).toEqual([]);
      expect(useTransactionStore.getState().holdings).toEqual([]);
      expect(useTransactionStore.getState().totalCount).toBe(0);
      expect(useTransactionStore.getState().currentPage).toBe(1);
    });

    it('full cycle: signUp → signOut → signIn restores access', async () => {
      // Sign up
      await act(async () => {
        await useAuthStore.getState().signUp('new@example.com', 'securepass1');
      });
      expect(useAuthStore.getState().user?.email).toBe('new@example.com');

      // Sign out
      await act(async () => {
        await useAuthStore.getState().signOut();
      });
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();

      // Sign in again
      await act(async () => {
        await useAuthStore.getState().signIn('new@example.com', 'securepass1');
      });
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().session).not.toBeNull();
    });
  });
});

describe('Integration: ProtectedRoute behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('redirects unauthenticated users to /login', () => {
    useAuthStore.setState({ user: null, isLoading: false });

    renderProtectedRoute('/dashboard');

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated users', () => {
    useAuthStore.setState({
      user: { id: 'user-123', email: 'test@example.com' } as any,
      isLoading: false,
    });

    renderProtectedRoute('/dashboard');

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('shows loading spinner while auth state is being determined', () => {
    useAuthStore.setState({ user: null, isLoading: true });

    renderProtectedRoute('/dashboard');

    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to login after sign-out clears user state', async () => {
    // Start authenticated
    useAuthStore.setState({
      user: { id: 'user-123', email: 'test@example.com' } as any,
      session: { access_token: 'token' } as any,
      isLoading: false,
    });

    const { rerender } = renderProtectedRoute('/dashboard');
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();

    // Sign out
    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    // Re-render to reflect state change
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });
});

describe('Integration: Repository errors surface as toast messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('planStore.loadPlans dispatches an error toast when the repository throws', async () => {
    // Make supabase.from return an error for this test
    const { supabase } = await import('../lib/supabase');
    const errorChain: Record<string, any> = {};
    errorChain.select = vi.fn(() => errorChain);
    errorChain.order = vi.fn(() => errorChain);
    errorChain.eq = vi.fn(() => errorChain);
    errorChain.then = (resolve: any) =>
      resolve({ data: null, error: { message: 'connection timeout' } });

    vi.mocked(supabase.from).mockReturnValueOnce(errorChain as any);

    await act(async () => {
      await usePlanStore.getState().loadPlans();
    });

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toContain('connection timeout');
  });

  it('planStore.loadPlan dispatches an error toast when getPlan fails', async () => {
    const { supabase } = await import('../lib/supabase');
    const errorChain: Record<string, any> = {};
    errorChain.select = vi.fn(() => errorChain);
    errorChain.eq = vi.fn(() => errorChain);
    errorChain.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'row not found' } }),
    );

    vi.mocked(supabase.from).mockReturnValueOnce(errorChain as any);

    await act(async () => {
      await usePlanStore.getState().loadPlan('nonexistent-id');
    });

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toContain('row not found');
  });

  it('planStore.createPlan dispatches an error toast when insert fails', async () => {
    const { supabase } = await import('../lib/supabase');

    // Mock getUser to return a valid user
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    const errorChain: Record<string, any> = {};
    errorChain.insert = vi.fn(() => errorChain);
    errorChain.select = vi.fn(() => errorChain);
    errorChain.single = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'duplicate key violation' } }),
    );

    vi.mocked(supabase.from).mockReturnValueOnce(errorChain as any);

    const fakePlan = {
      id: 'plan-1',
      name: 'Test Plan',
      author: 'Author',
      year: 2024,
      goals: [],
      greeksTargets: [],
      riskManagement: { bpThresholds: [], positionLimits: [] },
      tradeRules: [],
      dailyManagement: { nightlyReview: [], morningReview: [] },
      vacationRules: [],
      marketRegimes: [],
      accountSizing: { totalAccountSize: 10000, allocations: [] },
      coreStrategies: [],
      speculativeStrategies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    await act(async () => {
      await usePlanStore.getState().createPlan(fakePlan);
    });

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toContain('duplicate key violation');
  });

  it('planStore.deletePlan dispatches an error toast when delete fails', async () => {
    const { supabase } = await import('../lib/supabase');
    const errorChain: Record<string, any> = {};
    errorChain.delete = vi.fn(() => errorChain);
    errorChain.eq = vi.fn(() => errorChain);
    errorChain.then = (resolve: any) =>
      resolve({ data: null, error: { message: 'permission denied' } });

    vi.mocked(supabase.from).mockReturnValueOnce(errorChain as any);

    await act(async () => {
      await usePlanStore.getState().deletePlan('plan-1');
    });

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toContain('permission denied');
  });

  it('multiple errors accumulate as separate toasts', async () => {
    const { supabase } = await import('../lib/supabase');

    // First error
    const errorChain1: Record<string, any> = {};
    errorChain1.select = vi.fn(() => errorChain1);
    errorChain1.order = vi.fn(() => errorChain1);
    errorChain1.then = (resolve: any) =>
      resolve({ data: null, error: { message: 'timeout error' } });
    vi.mocked(supabase.from).mockReturnValueOnce(errorChain1 as any);

    await act(async () => {
      await usePlanStore.getState().loadPlans();
    });

    // Second error
    const errorChain2: Record<string, any> = {};
    errorChain2.select = vi.fn(() => errorChain2);
    errorChain2.eq = vi.fn(() => errorChain2);
    errorChain2.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'server error' } }),
    );
    vi.mocked(supabase.from).mockReturnValueOnce(errorChain2 as any);

    await act(async () => {
      await usePlanStore.getState().loadPlan('some-id');
    });

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBe(2);
    expect(toasts[0].message).toContain('timeout error');
    expect(toasts[1].message).toContain('server error');
  });
});
