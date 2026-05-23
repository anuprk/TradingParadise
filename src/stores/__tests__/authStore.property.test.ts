// Feature: dark-mode-and-cloud-auth, Property 2: Sign-out clears all user-specific state

/**
 * Property-based test for sign-out clearing all user-specific state.
 * Uses fast-check to generate random user state objects, sets them into
 * the stores, calls signOut, and asserts all fields reset to initial values.
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock supabase before importing the auth store
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

import { useAuthStore } from '../authStore';
import { useAppStore } from '../appStore';
import { usePlanStore } from '../planStore';
import { usePortfolioStore } from '../portfolioStore';
import { useJournalStore } from '../journalStore';
import { useReminderStore } from '../reminderStore';
import { useTransactionStore } from '../transactionStore';

// Arbitrary generators for store state
const arbPlan = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  author: fc.string({ minLength: 1, maxLength: 30 }),
  year: fc.integer({ min: 2000, max: 2030 }),
});

const arbPortfolio = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ maxLength: 100 }),
  initialBalance: fc.double({ min: 0, max: 1000000, noNaN: true }),
  planId: fc.uuid(),
});

// Use integer timestamps to avoid Invalid Date issues with fc.date()
const arbISODate = fc
  .integer({ min: 946684800000, max: 1924905600000 }) // 2000-01-01 to 2030-12-31 in ms
  .map((ts) => new Date(ts).toISOString());

const arbJournalEntry = fc.record({
  id: fc.uuid(),
  stockSymbol: fc.string({ minLength: 1, maxLength: 5 }),
  openDate: arbISODate,
  tradeStatus: fc.constantFrom('Open', 'Closed'),
});

const arbReminder = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  date: arbISODate,
  status: fc.constantFrom('pending', 'completed', 'snoozed', 'dismissed'),
  planId: fc.uuid(),
});

const arbTransaction = fc.record({
  id: fc.uuid(),
  symbol: fc.string({ minLength: 1, maxLength: 5 }),
  amount: fc.double({ min: -100000, max: 100000, noNaN: true }),
  transactionType: fc.constantFrom('Buy', 'Sell'),
});

const arbHolding = fc.record({
  symbol: fc.string({ minLength: 1, maxLength: 5 }),
  quantity: fc.double({ min: 0, max: 10000, noNaN: true }),
});

const arbActivePlanId = fc.option(fc.uuid(), { nil: null });

describe('Property 2: Sign-out clears all user-specific state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears all user-specific state after sign-out regardless of initial state', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbActivePlanId,
        fc.array(arbPlan, { minLength: 0, maxLength: 5 }),
        fc.array(arbPortfolio, { minLength: 0, maxLength: 5 }),
        fc.array(arbJournalEntry, { minLength: 0, maxLength: 10 }),
        fc.array(arbReminder, { minLength: 0, maxLength: 5 }),
        fc.array(arbTransaction, { minLength: 0, maxLength: 10 }),
        fc.array(arbHolding, { minLength: 0, maxLength: 5 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 20 }),
        async (
          activePlanId,
          plans,
          portfolios,
          entries,
          reminders,
          transactions,
          holdings,
          totalCount,
          currentPage,
        ) => {
          // Set random state into all stores
          useAppStore.setState({ activePlanId });
          usePlanStore.setState({
            currentPlan: plans.length > 0 ? (plans[0] as any) : null,
            plans: plans as any[],
            isDirty: plans.length > 0,
          });
          usePortfolioStore.setState({
            portfolios: portfolios as any[],
            currentPortfolio: portfolios.length > 0 ? (portfolios[0] as any) : null,
            metrics: portfolios.length > 0 ? ({ totalPL: 100 } as any) : null,
          });
          useJournalStore.setState({
            entries: entries as any[],
            filters: entries.length > 0 ? { planId: 'some-plan-id' } : {},
          });
          useReminderStore.setState({ reminders: reminders as any[] });
          useTransactionStore.setState({
            transactions: transactions as any[],
            holdings: holdings as any[],
            totalCount,
            currentPage,
          });

          // Call signOut
          await useAuthStore.getState().signOut();

          // Assert all user-specific fields are reset to initial values
          const appState = useAppStore.getState();
          expect(appState.activePlanId).toBeNull();

          const planState = usePlanStore.getState();
          expect(planState.currentPlan).toBeNull();
          expect(planState.plans).toEqual([]);
          expect(planState.isDirty).toBe(false);

          const portfolioState = usePortfolioStore.getState();
          expect(portfolioState.portfolios).toEqual([]);
          expect(portfolioState.currentPortfolio).toBeNull();
          expect(portfolioState.metrics).toBeNull();

          const journalState = useJournalStore.getState();
          expect(journalState.entries).toEqual([]);
          expect(journalState.filters).toEqual({});

          const reminderState = useReminderStore.getState();
          expect(reminderState.reminders).toEqual([]);

          const transactionState = useTransactionStore.getState();
          expect(transactionState.transactions).toEqual([]);
          expect(transactionState.holdings).toEqual([]);
          expect(transactionState.totalCount).toBe(0);
          expect(transactionState.currentPage).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
