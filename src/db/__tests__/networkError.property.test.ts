// Feature: dark-mode-and-cloud-auth, Property 6: Network errors surface as user-visible error messages

/**
 * Property-based test for network error surfacing.
 * Generates random error messages and operation types with fast-check,
 * mocks Supabase client to return errors, and asserts that repository
 * functions throw Error objects with descriptive messages containing
 * the original error text.
 *
 * **Validates: Requirements 11.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Operation types that map to repository CRUD functions
type OperationType = 'create' | 'read' | 'update' | 'delete';
type RepositoryDomain = 'plans' | 'portfolios' | 'journal_entries' | 'reminders' | 'portfolio_transactions';

// Mock supabase before importing repositories
vi.mock('../../lib/supabase', () => {
  // The error message to inject — set per test iteration
  let mockErrorMessage = 'network error';

  const createErrorChain = () => {
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

    // Terminal methods that resolve the query — all return errors
    chain.single = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: mockErrorMessage } }),
    );
    chain.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: mockErrorMessage } }),
    );

    // When chain is awaited directly (e.g. for insert without .single())
    chain.then = (resolve: any) =>
      resolve({ data: null, error: { message: mockErrorMessage }, count: null });

    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createErrorChain()),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    },
    __setMockError: (msg: string) => {
      mockErrorMessage = msg;
    },
  };
});

// Import after mocking
import { createPlan, updatePlan, deletePlan, listPlans } from '../planRepository';
import { createPortfolio, updatePortfolio, deletePortfolio, listPortfolios } from '../portfolioRepository';
import { createJournalEntry, updateJournalEntry, deleteJournalEntry, listJournalEntries } from '../journalRepository';
import { createReminder, updateReminder, deleteReminder, listReminders } from '../reminderRepository';
import { addTransaction, getTransactionsByPortfolio, deleteTransaction, deleteTransactionsByPortfolio } from '../transactionRepository';

// Access the mock error setter
const { __setMockError } = await import('../../lib/supabase') as any;

// --- Generators ---

const arbErrorMessage = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0,
);

const arbOperationType: fc.Arbitrary<OperationType> = fc.constantFrom('create', 'read', 'update', 'delete');

const arbRepositoryDomain: fc.Arbitrary<RepositoryDomain> = fc.constantFrom(
  'plans', 'portfolios', 'journal_entries', 'reminders', 'portfolio_transactions',
);

// --- Helpers ---

/**
 * Calls a repository function for the given domain and operation type.
 * Returns the promise that should reject with an error.
 */
function callRepository(domain: RepositoryDomain, operation: OperationType): Promise<any> {
  switch (domain) {
    case 'plans':
      switch (operation) {
        case 'create':
          return createPlan({
            id: 'test-id', name: 'Test', author: 'Author', year: 2024,
            goals: [], greeksTargets: [], riskManagement: { bpThresholds: [], positionLimits: [] },
            tradeRules: [], dailyManagement: { nightlyReview: [], morningReview: [] },
            vacationRules: [], marketRegimes: [], accountSizing: { totalAccountSize: 10000, allocations: [] },
            coreStrategies: [], speculativeStrategies: [],
            createdAt: new Date(), updatedAt: new Date(),
          } as any);
        case 'read':
          return listPlans();
        case 'update':
          return updatePlan('test-id', { name: 'Updated' });
        case 'delete':
          return deletePlan('test-id');
      }
      break;
    case 'portfolios':
      switch (operation) {
        case 'create':
          return createPortfolio({
            id: 'test-id', name: 'Test Portfolio', description: 'desc',
            initialBalance: 10000, planId: 'plan-1',
            createdAt: new Date(), updatedAt: new Date(),
          } as any);
        case 'read':
          return listPortfolios('plan-1');
        case 'update':
          return updatePortfolio('test-id', { name: 'Updated' });
        case 'delete':
          return deletePortfolio('test-id');
      }
      break;
    case 'journal_entries':
      switch (operation) {
        case 'create':
          return createJournalEntry({
            id: 'test-id', stockSymbol: 'AAPL', openDate: new Date(),
            expirationDate: new Date(), optionType: 'Call', direction: 'Sell',
            stockPriceDOC: 150, dte: 30, ditc: 5, breakEvenPrice: 145,
            strikePrice: 155, premium: 3.5, cashReserve: 15500, fees: 0.65,
            tradeStatus: 'Open', portfolioId: 'port-1', strategyId: 'strat-1',
            planId: 'plan-1', notes: '', createdAt: new Date(), updatedAt: new Date(),
          } as any);
        case 'read':
          return listJournalEntries('plan-1');
        case 'update':
          return updateJournalEntry('test-id', { notes: 'updated' });
        case 'delete':
          return deleteJournalEntry('test-id');
      }
      break;
    case 'reminders':
      switch (operation) {
        case 'create':
          return createReminder({
            id: 'test-id', title: 'Test', description: 'desc',
            date: new Date(), time: '09:00', recurrence: 'none',
            status: 'pending', planId: 'plan-1',
            createdAt: new Date(), updatedAt: new Date(),
          } as any);
        case 'read':
          return listReminders('plan-1');
        case 'update':
          return updateReminder('test-id', { title: 'Updated' });
        case 'delete':
          return deleteReminder('test-id');
      }
      break;
    case 'portfolio_transactions':
      switch (operation) {
        case 'create':
          return addTransaction({
            id: 'test-id', portfolioId: 'port-1', planId: 'plan-1',
            transactionDate: new Date(), symbol: 'AAPL', description: 'Buy',
            transactionType: 'Buy', assetType: 'Stock', quantity: 100,
            price: 150, amount: 15000, fees: 4.95, source: 'manual',
            createdAt: new Date(), updatedAt: new Date(),
          } as any);
        case 'read':
          return getTransactionsByPortfolio('port-1');
        case 'update':
          // Transactions don't have an update function, use delete as a proxy
          return deleteTransaction('test-id');
        case 'delete':
          return deleteTransactionsByPortfolio('port-1');
      }
      break;
  }
  return Promise.reject(new Error('Unknown domain/operation'));
}

// --- Tests ---

describe('Property 6: Network errors surface as user-visible error messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Validates: Requirements 11.3
   *
   * For any combination of repository domain, operation type, and error message,
   * when Supabase returns an error, the repository function throws an Error
   * whose message contains the original error text from Supabase.
   */
  it('repository functions propagate Supabase errors as thrown Error objects with descriptive messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRepositoryDomain,
        arbOperationType,
        arbErrorMessage,
        async (domain, operation, errorMessage) => {
          __setMockError(errorMessage);

          const promise = callRepository(domain, operation);

          await expect(promise).rejects.toThrow();

          try {
            await callRepository(domain, operation);
          } catch (err: any) {
            // The thrown error must be an Error instance
            expect(err).toBeInstanceOf(Error);
            // The error message must contain the original Supabase error text
            expect(err.message).toContain(errorMessage);
            // The error message must have a human-readable prefix (not just the raw error)
            expect(err.message.length).toBeGreaterThan(errorMessage.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 11.3
   *
   * For any error message, the thrown error includes a "Failed to" prefix
   * that describes the operation, making it suitable for display in a toast.
   */
  it('error messages include a descriptive prefix suitable for user-facing toast display', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRepositoryDomain,
        arbOperationType,
        arbErrorMessage,
        async (domain, operation, errorMessage) => {
          __setMockError(errorMessage);

          try {
            await callRepository(domain, operation);
          } catch (err: any) {
            // All repository errors follow the pattern "Failed to <action>: <supabase error>"
            expect(err.message).toMatch(/^Failed to .+:/);
            expect(err.message).toContain(errorMessage);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
