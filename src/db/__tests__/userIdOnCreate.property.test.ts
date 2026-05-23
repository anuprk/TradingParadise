// Feature: dark-mode-and-cloud-auth, Property 4: Every created record includes the authenticated user's ID

/**
 * Property-based test for user ID inclusion on record creation.
 * Generates random user IDs (UUID) and random record data with fast-check,
 * mocks the auth user, calls create functions, and asserts that `user_id`
 * in the insert payload matches the authenticated user's ID.
 *
 * **Validates: Requirements 8.2**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Track the insert payloads per table
let capturedInserts: Map<string, Record<string, unknown>>;
// The user ID to return from auth.getUser()
let mockUserId: string;

vi.mock('../../lib/supabase', () => {
  const createMockChain = (table: string) => {
    const chain: Record<string, any> = {};

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      capturedInserts.set(table, row);
      return chain;
    });
    chain.select = vi.fn((_columns?: string) => {
      return {
        single: vi.fn().mockImplementation(() => {
          const captured = capturedInserts.get(table);
          return Promise.resolve({
            data: { id: captured?.id || 'generated-id' },
            error: null,
          });
        }),
      };
    });
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue({ data: [], error: null });
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);

    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createMockChain(table)),
      auth: {
        getUser: vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        ),
      },
    },
  };
});

import { createPlan } from '../planRepository';
import { createPortfolio } from '../portfolioRepository';
import { createJournalEntry } from '../journalRepository';
import { createReminder } from '../reminderRepository';
import { addTransaction } from '../transactionRepository';
import type { TradingPlan } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';
import type { TradeJournalEntry } from '../../types/journal';
import type { Reminder } from '../../types/reminder';
import type { PortfolioTransaction } from '../../types/transaction';

// --- Generators ---

const arbDate = fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true });

const arbTradingPlan: fc.Arbitrary<TradingPlan> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  author: fc.string({ minLength: 1, maxLength: 30 }),
  year: fc.integer({ min: 2000, max: 2099 }),
  createdAt: arbDate,
  updatedAt: arbDate,
  goals: fc.constant([]),
  greeksTargets: fc.constant([]),
  riskManagement: fc.constant({ bpThresholds: [], positionLimits: [] }),
  tradeRules: fc.constant([]),
  dailyManagement: fc.constant({ nightlyReview: [], morningReview: [] }),
  vacationRules: fc.constant([]),
  marketRegimes: fc.constant([]),
  accountSizing: fc.constant({ totalAccountSize: 10000, allocations: [] }),
  coreStrategies: fc.constant([]),
  speculativeStrategies: fc.constant([]),
});

const arbPortfolio: fc.Arbitrary<Portfolio> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  initialBalance: fc.double({ min: 0, max: 10000000, noNaN: true, noDefaultInfinity: true }),
  planId: fc.uuid(),
  createdAt: arbDate,
  updatedAt: arbDate,
});

const arbJournalEntry: fc.Arbitrary<TradeJournalEntry> = fc.record({
  id: fc.uuid(),
  stockSymbol: fc.string({ minLength: 1, maxLength: 5 }),
  openDate: arbDate,
  expirationDate: arbDate,
  optionType: fc.constantFrom('Call' as const, 'Put' as const),
  direction: fc.constantFrom('Buy' as const, 'Sell' as const),
  stockPriceDOC: fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }),
  dte: fc.integer({ min: 0, max: 365 }),
  ditc: fc.integer({ min: 0, max: 365 }),
  currentStockPrice: fc.option(fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  breakEvenPrice: fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }),
  strikePrice: fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }),
  premium: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
  cashReserve: fc.double({ min: 0, max: 1000000, noNaN: true, noDefaultInfinity: true }),
  marginCashReserve: fc.option(fc.double({ min: 0, max: 1000000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  fees: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
  exitPrice: fc.option(fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  closeDate: fc.option(arbDate, { nil: undefined }),
  profitLoss: fc.option(fc.double({ min: -100000, max: 100000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  winLoss: fc.constantFrom('Win' as const, 'Loss' as const, null),
  daysHeld: fc.option(fc.integer({ min: 0, max: 365 }), { nil: undefined }),
  annualizedROR: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  marginAnnualizedROR: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  tradeStatus: fc.constantFrom('Open' as const, 'Closed' as const),
  portfolioId: fc.uuid(),
  strategyId: fc.uuid(),
  planId: fc.uuid(),
  unrealizedPL: fc.option(fc.double({ min: -100000, max: 100000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  notes: fc.string({ minLength: 0, maxLength: 200 }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

const arbReminder: fc.Arbitrary<Reminder> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  strategyId: fc.option(fc.uuid(), { nil: undefined }),
  activityType: fc.option(fc.constantFrom('review', 'trade', 'research'), { nil: undefined }),
  date: arbDate,
  time: fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
  recurrence: fc.constantFrom('one-time' as const, 'daily' as const, 'weekly' as const, 'monthly' as const),
  status: fc.constantFrom('pending' as const, 'completed' as const, 'snoozed' as const, 'dismissed' as const),
  planId: fc.uuid(),
  createdAt: arbDate,
  updatedAt: arbDate,
});

const arbTransaction: fc.Arbitrary<PortfolioTransaction> = fc.record({
  id: fc.uuid(),
  portfolioId: fc.uuid(),
  planId: fc.uuid(),
  transactionDate: arbDate,
  settlementDate: fc.option(arbDate, { nil: undefined }),
  symbol: fc.string({ minLength: 1, maxLength: 5 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  transactionType: fc.constantFrom('Buy' as const, 'Sell' as const),
  assetType: fc.constantFrom('Stock' as const, 'Option' as const),
  optionType: fc.option(fc.constantFrom('Call' as const, 'Put' as const), { nil: undefined }),
  strikePrice: fc.option(fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  expirationDate: fc.option(arbDate, { nil: undefined }),
  quantity: fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }),
  price: fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
  amount: fc.double({ min: -1000000, max: 1000000, noNaN: true, noDefaultInfinity: true }),
  fees: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
  source: fc.constantFrom('manual' as const, 'csv' as const),
  rawDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  strategyId: fc.option(fc.uuid(), { nil: undefined }),
  marginUsed: fc.option(fc.double({ min: 0, max: 1000000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  annualizedReturn: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  returnOnMargin: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

// --- Tests ---

describe('Property 4: Every created record includes the authenticated user\'s ID', () => {
  beforeEach(() => {
    capturedInserts = new Map();
    vi.clearAllMocks();
  });

  it('createPlan inserts with user_id matching the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), arbTradingPlan, async (userId, plan) => {
        mockUserId = userId;
        capturedInserts = new Map();

        await createPlan(plan);

        const insertedRow = capturedInserts.get('plans');
        expect(insertedRow).toBeDefined();
        expect(insertedRow!.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  it('createPortfolio inserts with user_id matching the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), arbPortfolio, async (userId, portfolio) => {
        mockUserId = userId;
        capturedInserts = new Map();

        await createPortfolio(portfolio);

        const insertedRow = capturedInserts.get('portfolios');
        expect(insertedRow).toBeDefined();
        expect(insertedRow!.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  it('createJournalEntry inserts with user_id matching the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), arbJournalEntry, async (userId, entry) => {
        mockUserId = userId;
        capturedInserts = new Map();

        await createJournalEntry(entry);

        const insertedRow = capturedInserts.get('journal_entries');
        expect(insertedRow).toBeDefined();
        expect(insertedRow!.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  it('createReminder inserts with user_id matching the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), arbReminder, async (userId, reminder) => {
        mockUserId = userId;
        capturedInserts = new Map();

        await createReminder(reminder);

        const insertedRow = capturedInserts.get('reminders');
        expect(insertedRow).toBeDefined();
        expect(insertedRow!.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  it('addTransaction inserts with user_id matching the authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), arbTransaction, async (userId, transaction) => {
        mockUserId = userId;
        capturedInserts = new Map();

        await addTransaction(transaction);

        const insertedRow = capturedInserts.get('portfolio_transactions');
        expect(insertedRow).toBeDefined();
        expect(insertedRow!.user_id).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });
});
