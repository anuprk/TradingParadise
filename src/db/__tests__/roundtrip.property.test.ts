// Feature: dark-mode-and-cloud-auth, Property 5: Data schema round-trip preservation

/**
 * Property-based test for data schema round-trip preservation.
 * Generates random valid plan and portfolio objects, mocks Supabase to capture
 * the inserted row and return it on select, then verifies all fields are preserved
 * after a create-then-get cycle (accounting for Date/ISO serialization).
 *
 * **Validates: Requirements 8.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Captured rows for round-trip verification
let capturedPlanRow: Record<string, unknown> | null = null;
let capturedPortfolioRow: Record<string, unknown> | null = null;

// Mock supabase before importing repositories
vi.mock('../../lib/supabase', () => {
  const createMockChain = (table: string) => {
    const chain: Record<string, any> = {};

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      if (table === 'plans') capturedPlanRow = row;
      if (table === 'portfolios') capturedPortfolioRow = row;
      return chain;
    });
    chain.select = vi.fn((columns?: string) => {
      if (columns === 'id') {
        // After insert, return the id
        return {
          single: vi.fn().mockImplementation(() => {
            const captured = table === 'plans' ? capturedPlanRow : capturedPortfolioRow;
            return Promise.resolve({
              data: { id: captured?.id || 'test-id' },
              error: null,
            });
          }),
        };
      }
      // select('*') for reads
      return chain;
    });
    chain.eq = vi.fn((_col: string, _id: string) => {
      return {
        maybeSingle: vi.fn().mockImplementation(() => {
          const captured = table === 'plans' ? capturedPlanRow : capturedPortfolioRow;
          return Promise.resolve({ data: captured, error: null });
        }),
      };
    });
    chain.order = vi.fn().mockReturnValue({ data: [], error: null });
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);

    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createMockChain(table)),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    },
  };
});

import { createPlan, getPlan } from '../planRepository';
import { createPortfolio, getPortfolio } from '../portfolioRepository';
import type { TradingPlan } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';

// --- Generators ---

const arbGoal = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  targetValue: fc.string({ minLength: 1, maxLength: 50 }),
});

const arbGreeksTarget = fc.record({
  id: fc.uuid(),
  metricName: fc.constantFrom('Delta', 'Theta', 'Vega', 'Gamma'),
  targetDescription: fc.string({ minLength: 1, maxLength: 100 }),
  minValue: fc.option(fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  maxValue: fc.option(fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
});

const arbBPThreshold = fc.record({
  id: fc.uuid(),
  percentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  actionDescription: fc.string({ minLength: 1, maxLength: 100 }),
});

const arbPositionLimit = fc.record({
  id: fc.uuid(),
  strategyName: fc.string({ minLength: 1, maxLength: 50 }),
  maxPositions: fc.integer({ min: 1, max: 100 }),
  maxPerUnderlying: fc.integer({ min: 1, max: 50 }),
});

const arbRiskManagement = fc.record({
  bpThresholds: fc.array(arbBPThreshold, { minLength: 0, maxLength: 3 }),
  positionLimits: fc.array(arbPositionLimit, { minLength: 0, maxLength: 3 }),
  maxLossPerTrade: fc.option(fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  maxLossPerPortfolio: fc.option(fc.double({ min: 0, max: 1000000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
});

const arbTradeRule = fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 0, max: 100 }),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  category: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

const arbChecklistItem = (reviewType: 'nightly' | 'morning') =>
  fc.record({
    id: fc.uuid(),
    order: fc.integer({ min: 0, max: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    reviewType: fc.constant(reviewType),
  });

const arbDailyManagement = fc.record({
  nightlyReview: fc.array(arbChecklistItem('nightly'), { minLength: 0, maxLength: 3 }),
  morningReview: fc.array(arbChecklistItem('morning'), { minLength: 0, maxLength: 3 }),
});

const arbVacationRule = fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 0, max: 50 }),
  text: fc.string({ minLength: 1, maxLength: 200 }),
});

const arbMarketRegime = fc.record({
  id: fc.uuid(),
  name: fc.constantFrom('Bullish', 'Neutral', 'Bearish', 'High Volatility'),
  conditions: fc.string({ minLength: 1, maxLength: 200 }),
  strategyAdjustments: fc.string({ minLength: 1, maxLength: 200 }),
});

const arbStrategyAllocation = fc.record({
  id: fc.uuid(),
  categoryName: fc.string({ minLength: 1, maxLength: 50 }),
  allocationPercentage: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  numberOfPositions: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
  positionSizing: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const arbAccountSizing = fc.record({
  totalAccountSize: fc.double({ min: 1000, max: 10000000, noNaN: true, noDefaultInfinity: true }),
  allocations: fc.array(arbStrategyAllocation, { minLength: 0, maxLength: 3 }),
});

const arbEntryCriterion = fc.record({
  id: fc.uuid(),
  parameterName: fc.string({ minLength: 1, maxLength: 50 }),
  value: fc.string({ minLength: 1, maxLength: 50 }),
});

const arbManagementRule = fc.record({
  id: fc.uuid(),
  triggerCondition: fc.string({ minLength: 1, maxLength: 100 }),
  actionDescription: fc.string({ minLength: 1, maxLength: 100 }),
});

const arbProfitTarget = fc.record({
  id: fc.uuid(),
  targetValue: fc.string({ minLength: 1, maxLength: 30 }),
  action: fc.string({ minLength: 1, maxLength: 100 }),
});

const arbStopLoss = fc.record({
  id: fc.uuid(),
  stopValue: fc.string({ minLength: 1, maxLength: 30 }),
  action: fc.string({ minLength: 1, maxLength: 100 }),
});

const arbStrategy = (classification: 'Core' | 'Speculative') =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    classification: fc.constant(classification),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    variants: fc.option(
      fc.array(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        { minLength: 0, maxLength: 2 },
      ),
      { nil: undefined },
    ),
    entryCriteria: fc.array(arbEntryCriterion, { minLength: 0, maxLength: 3 }),
    managementRules: fc.array(arbManagementRule, { minLength: 0, maxLength: 3 }),
    profitTargets: fc.array(arbProfitTarget, { minLength: 0, maxLength: 2 }),
    stopLosses: fc.array(arbStopLoss, { minLength: 0, maxLength: 2 }),
  });

const arbDate = fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true });

const arbTradingPlan: fc.Arbitrary<TradingPlan> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  author: fc.string({ minLength: 1, maxLength: 30 }),
  year: fc.integer({ min: 2000, max: 2099 }),
  createdAt: arbDate,
  updatedAt: arbDate,
  goals: fc.array(arbGoal, { minLength: 0, maxLength: 3 }),
  greeksTargets: fc.array(arbGreeksTarget, { minLength: 0, maxLength: 3 }),
  riskManagement: arbRiskManagement,
  tradeRules: fc.array(arbTradeRule, { minLength: 0, maxLength: 3 }),
  dailyManagement: arbDailyManagement,
  vacationRules: fc.array(arbVacationRule, { minLength: 0, maxLength: 3 }),
  marketRegimes: fc.array(arbMarketRegime, { minLength: 0, maxLength: 3 }),
  accountSizing: arbAccountSizing,
  coreStrategies: fc.array(arbStrategy('Core'), { minLength: 0, maxLength: 2 }),
  speculativeStrategies: fc.array(arbStrategy('Speculative'), { minLength: 0, maxLength: 2 }),
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

// --- Tests ---

describe('Property 5: Data schema round-trip preservation', () => {
  beforeEach(() => {
    capturedPlanRow = null;
    capturedPortfolioRow = null;
    vi.clearAllMocks();
  });

  /**
   * Validates: Requirements 8.4
   * For any valid TradingPlan, converting to row format (camelCase to snake_case)
   * and back (snake_case to camelCase) preserves all field values.
   * Date fields are compared via toISOString() since they go through ISO serialization.
   */
  it('plan round-trip preserves all fields through toRow/fromRow mapping', async () => {
    await fc.assert(
      fc.asyncProperty(arbTradingPlan, async (plan) => {
        capturedPlanRow = null;

        // Create the plan (this calls toRow internally and captures the row)
        await createPlan(plan);

        // The captured row should have the plan's id
        expect(capturedPlanRow).not.toBeNull();

        // Get the plan back (this calls fromRow on the captured row)
        const retrieved = await getPlan(plan.id);

        expect(retrieved).not.toBeUndefined();
        if (!retrieved) return;

        // Compare non-date fields directly
        expect(retrieved.id).toEqual(plan.id);
        expect(retrieved.name).toEqual(plan.name);
        expect(retrieved.author).toEqual(plan.author);
        expect(retrieved.year).toEqual(plan.year);
        expect(retrieved.goals).toEqual(plan.goals);
        expect(retrieved.greeksTargets).toEqual(plan.greeksTargets);
        expect(retrieved.riskManagement).toEqual(plan.riskManagement);
        expect(retrieved.tradeRules).toEqual(plan.tradeRules);
        expect(retrieved.dailyManagement).toEqual(plan.dailyManagement);
        expect(retrieved.vacationRules).toEqual(plan.vacationRules);
        expect(retrieved.marketRegimes).toEqual(plan.marketRegimes);
        expect(retrieved.accountSizing).toEqual(plan.accountSizing);
        expect(retrieved.coreStrategies).toEqual(plan.coreStrategies);
        expect(retrieved.speculativeStrategies).toEqual(plan.speculativeStrategies);

        // Date fields go through ISO serialization — compare via toISOString()
        // createPlan sets createdAt/updatedAt to `now`, so we compare against
        // what was actually stored in the captured row
        expect(retrieved.createdAt).toBeInstanceOf(Date);
        expect(retrieved.updatedAt).toBeInstanceOf(Date);
        expect(retrieved.createdAt.toISOString()).toEqual(capturedPlanRow!.created_at);
        expect(retrieved.updatedAt.toISOString()).toEqual(capturedPlanRow!.updated_at);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 8.4
   * For any valid Portfolio, converting to row format and back preserves all fields.
   * Date fields are compared via toISOString().
   */
  it('portfolio round-trip preserves all fields through toRow/toPortfolio mapping', async () => {
    await fc.assert(
      fc.asyncProperty(arbPortfolio, async (portfolio) => {
        capturedPortfolioRow = null;

        // Create the portfolio (captures the row)
        await createPortfolio(portfolio);

        expect(capturedPortfolioRow).not.toBeNull();

        // Get the portfolio back (calls toPortfolio on the captured row)
        const retrieved = await getPortfolio(portfolio.id);

        expect(retrieved).not.toBeUndefined();
        if (!retrieved) return;

        // Compare non-date fields
        expect(retrieved.id).toEqual(portfolio.id);
        expect(retrieved.name).toEqual(portfolio.name);
        expect(retrieved.description).toEqual(portfolio.description);
        expect(retrieved.initialBalance).toEqual(portfolio.initialBalance);
        expect(retrieved.planId).toEqual(portfolio.planId);

        // Date fields go through ISO serialization
        expect(retrieved.createdAt).toBeInstanceOf(Date);
        expect(retrieved.updatedAt).toBeInstanceOf(Date);
        expect(retrieved.createdAt.toISOString()).toEqual(capturedPortfolioRow!.created_at);
        expect(retrieved.updatedAt.toISOString()).toEqual(capturedPortfolioRow!.updated_at);
      }),
      { numRuns: 100 },
    );
  });
});
