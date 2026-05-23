/**
 * Property-based tests for JSON serialization round-trip consistency.
 * Uses fast-check to verify that serialize → deserialize produces equivalent objects.
 *
 * **Validates: Requirements 16.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { serializePlan, deserializePlan } from '../serialization';
import type { TradingPlan } from '../../types/tradingPlan';

// --- Generators ---

/** Non-empty alphanumeric string (1–30 chars). */
const arbNonEmptyStr = fc.stringMatching(/^[A-Za-z0-9 _-]{1,30}$/);

/** UUID-like string. */
const arbId = fc.uuid();

/** Year in valid range. */
const arbYear = fc.integer({ min: 2000, max: 2100 });

/** Date within a reasonable range. */
const arbDate = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
  noInvalidDate: true,
});

/** Positive number for monetary values. */
const arbPositiveNum = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

/** Percentage 0–100. */
const arbPercentage = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

/** Positive integer. */
const arbPositiveInt = fc.integer({ min: 1, max: 1000 });

/** Non-negative integer for order fields. */
const arbOrder = fc.integer({ min: 0, max: 999 });

// --- Sub-object generators ---

const arbGoal = fc.record({
  id: arbId,
  description: arbNonEmptyStr,
  targetValue: arbNonEmptyStr,
});

const arbGreeksTarget = fc.record({
  id: arbId,
  metricName: arbNonEmptyStr,
  targetDescription: arbNonEmptyStr,
  minValue: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  maxValue: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
});

const arbBPThreshold = fc.record({
  id: arbId,
  percentage: arbPercentage,
  actionDescription: arbNonEmptyStr,
});

const arbPositionLimit = fc.record({
  id: arbId,
  strategyName: arbNonEmptyStr,
  maxPositions: arbPositiveInt,
  maxPerUnderlying: arbPositiveInt,
});


const arbRiskManagement = fc.record({
  bpThresholds: fc.array(arbBPThreshold, { minLength: 0, maxLength: 3 }),
  positionLimits: fc.array(arbPositionLimit, { minLength: 0, maxLength: 3 }),
  maxLossPerTrade: fc.option(arbPositiveNum, { nil: undefined }),
  maxLossPerPortfolio: fc.option(arbPositiveNum, { nil: undefined }),
});

const arbTradeRule = fc.record({
  id: arbId,
  order: arbOrder,
  text: arbNonEmptyStr,
  category: fc.option(arbNonEmptyStr, { nil: undefined }),
});

const arbChecklistItem = (reviewType: 'nightly' | 'morning') =>
  fc.record({
    id: arbId,
    order: arbOrder,
    description: arbNonEmptyStr,
    reviewType: fc.constant(reviewType),
  });

const arbDailyManagement = fc.record({
  nightlyReview: fc.array(arbChecklistItem('nightly'), { minLength: 0, maxLength: 3 }),
  morningReview: fc.array(arbChecklistItem('morning'), { minLength: 0, maxLength: 3 }),
});

const arbVacationRule = fc.record({
  id: arbId,
  order: arbOrder,
  text: arbNonEmptyStr,
});

const arbMarketRegime = fc.record({
  id: arbId,
  name: arbNonEmptyStr,
  conditions: arbNonEmptyStr,
  strategyAdjustments: arbNonEmptyStr,
});

const arbStrategyAllocation = fc.record({
  id: arbId,
  categoryName: arbNonEmptyStr,
  allocationPercentage: arbPercentage,
  numberOfPositions: fc.option(arbPositiveInt, { nil: undefined }),
  positionSizing: fc.option(arbNonEmptyStr, { nil: undefined }),
});

const arbAccountSizing = fc.record({
  totalAccountSize: arbPositiveNum,
  allocations: fc.array(arbStrategyAllocation, { minLength: 0, maxLength: 3 }),
});

const arbStrategyVariant = fc.record({
  id: arbId,
  name: arbNonEmptyStr,
  description: arbNonEmptyStr,
});

const arbEntryCriterion = fc.record({
  id: arbId,
  parameterName: arbNonEmptyStr,
  value: arbNonEmptyStr,
});

const arbManagementRule = fc.record({
  id: arbId,
  triggerCondition: arbNonEmptyStr,
  actionDescription: arbNonEmptyStr,
});

const arbProfitTarget = fc.record({
  id: arbId,
  targetValue: arbNonEmptyStr,
  action: arbNonEmptyStr,
});

const arbStopLoss = fc.record({
  id: arbId,
  stopValue: arbNonEmptyStr,
  action: arbNonEmptyStr,
});

const arbStrategy = fc.record({
  id: arbId,
  name: arbNonEmptyStr,
  classification: fc.constantFrom('Core' as const, 'Speculative' as const),
  description: arbNonEmptyStr,
  variants: fc.option(fc.array(arbStrategyVariant, { minLength: 0, maxLength: 2 }), { nil: undefined }),
  entryCriteria: fc.array(arbEntryCriterion, { minLength: 1, maxLength: 3 }),
  managementRules: fc.array(arbManagementRule, { minLength: 1, maxLength: 3 }),
  profitTargets: fc.array(arbProfitTarget, { minLength: 0, maxLength: 2 }),
  stopLosses: fc.array(arbStopLoss, { minLength: 0, maxLength: 2 }),
});


// --- Full TradingPlan generator ---

const arbTradingPlan: fc.Arbitrary<TradingPlan> = fc.record({
  id: arbId,
  name: arbNonEmptyStr,
  author: arbNonEmptyStr,
  year: arbYear,
  createdAt: arbDate,
  updatedAt: arbDate,
  goals: fc.array(arbGoal, { minLength: 1, maxLength: 3 }),
  greeksTargets: fc.array(arbGreeksTarget, { minLength: 0, maxLength: 3 }),
  riskManagement: arbRiskManagement,
  tradeRules: fc.array(arbTradeRule, { minLength: 1, maxLength: 5 }),
  dailyManagement: arbDailyManagement,
  vacationRules: fc.array(arbVacationRule, { minLength: 0, maxLength: 3 }),
  marketRegimes: fc.array(arbMarketRegime, { minLength: 3, maxLength: 5 }),
  accountSizing: arbAccountSizing,
  coreStrategies: fc.array(arbStrategy, { minLength: 0, maxLength: 2 }),
  speculativeStrategies: fc.array(arbStrategy, { minLength: 0, maxLength: 2 }),
});

// --- Helper: normalize values for JSON round-trip comparison ---

/**
 * Normalizes a value to account for inherent JSON serialization behaviors:
 * - JSON.stringify converts -0 to 0
 * - JSON.stringify strips undefined values (they become absent after parse)
 * - Date objects are compared by ISO string
 */
function normalizeForJson(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    // JSON.stringify(-0) === "0", so normalize -0 to 0
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // JSON.stringify strips undefined values, so skip them in the original too
      if (v !== undefined) {
        normalized[k] = normalizeForJson(v);
      }
    }
    return normalized;
  }
  return value;
}

function comparePlans(original: TradingPlan, roundTripped: TradingPlan) {
  const normalizedOriginal = normalizeForJson(original);
  const normalizedRoundTripped = normalizeForJson(roundTripped);
  expect(normalizedRoundTripped).toEqual(normalizedOriginal);
}

// --- Property 5: JSON Round-Trip Consistency ---

describe('Property 5: JSON Round-Trip Consistency', () => {
  /**
   * **Validates: Requirements 16.3**
   *
   * For any valid TradingPlan object, serializing to JSON then deserializing
   * from JSON produces an equivalent TradingPlan object.
   */
  it('serialize then deserialize produces equivalent plan', () => {
    fc.assert(
      fc.property(arbTradingPlan, (plan) => {
        const json = serializePlan(plan, [], [], []);
        const result = deserializePlan(json);

        comparePlans(plan, result.plan as unknown as TradingPlan);

        // Verify wrapper fields
        expect(result.version).toBe('1.0');
        expect(result.portfolios).toEqual([]);
        expect(result.journalEntries).toEqual([]);
        expect(result.reminders).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });
});
