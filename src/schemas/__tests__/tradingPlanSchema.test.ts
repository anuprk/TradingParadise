/**
 * Unit tests for Trading Plan Zod validation schemas.
 * Validates: Requirements 1.5, 2.4, 3.5, 3.6, 4.4, 7.3, 8.3, 9.8
 */

import { describe, it, expect } from 'vitest';
import {
  tradingPlanSchema,
  riskManagementSchema,
  greeksTargetSchema,
  strategySchema,
  validateAllocationSum,
} from '../tradingPlanSchema';

// --- Helpers to build valid objects ---

function makeGoal(overrides = {}) {
  return { id: 'g1', description: 'Earn income', targetValue: '$50k', ...overrides };
}

function makeGreeksTarget(overrides = {}) {
  return { id: 'gt1', metricName: 'Delta', targetDescription: 'Keep neutral', ...overrides };
}

function makeBPThreshold(pct: number, overrides = {}) {
  return { id: `bp-${pct}`, percentage: pct, actionDescription: `Action at ${pct}%`, ...overrides };
}

function makeTradeRule(order: number, overrides = {}) {
  return { id: `tr-${order}`, order, text: `Rule ${order}`, ...overrides };
}

function makeMarketRegime(name: string, overrides = {}) {
  return { id: `mr-${name}`, name, conditions: 'Some conditions', strategyAdjustments: 'Some adjustments', ...overrides };
}

function makeStrategy(overrides = {}) {
  return {
    id: 's1',
    name: 'Test Strategy',
    classification: 'Core' as const,
    description: 'A test strategy',
    entryCriteria: [{ id: 'ec1', parameterName: 'DTE', value: '45' }],
    managementRules: [{ id: 'mr1', triggerCondition: 'At 50% profit', actionDescription: 'Close position' }],
    profitTargets: [],
    stopLosses: [],
    ...overrides,
  };
}

function makeAllocation(pct: number, overrides = {}) {
  return { id: `a-${pct}`, categoryName: `Category ${pct}`, allocationPercentage: pct, ...overrides };
}

function makeValidPlan(overrides = {}) {
  return {
    id: 'plan-1',
    name: 'Test Plan',
    author: 'Trader',
    year: 2025,
    createdAt: new Date(),
    updatedAt: new Date(),
    goals: [makeGoal()],
    greeksTargets: [makeGreeksTarget()],
    riskManagement: {
      bpThresholds: [makeBPThreshold(25), makeBPThreshold(50), makeBPThreshold(75)],
      positionLimits: [],
    },
    tradeRules: [makeTradeRule(1)],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [],
    marketRegimes: [
      makeMarketRegime('Bullish'),
      makeMarketRegime('Neutral'),
      makeMarketRegime('Bearish'),
    ],
    accountSizing: { totalAccountSize: 100000, allocations: [makeAllocation(100)] },
    coreStrategies: [makeStrategy()],
    speculativeStrategies: [],
    ...overrides,
  };
}

// --- Tests ---

describe('tradingPlanSchema', () => {
  it('accepts a valid trading plan', () => {
    const result = tradingPlanSchema.safeParse(makeValidPlan());
    expect(result.success).toBe(true);
  });

  it('rejects plan with missing required name', () => {
    const result = tradingPlanSchema.safeParse(makeValidPlan({ name: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects plan with missing required author', () => {
    const result = tradingPlanSchema.safeParse(makeValidPlan({ author: '' }));
    expect(result.success).toBe(false);
  });
});

describe('greeksTargetSchema — Req 2.4: min <= max', () => {
  it('accepts target with min < max', () => {
    const result = greeksTargetSchema.safeParse(makeGreeksTarget({ minValue: 5, maxValue: 10 }));
    expect(result.success).toBe(true);
  });

  it('accepts target with min === max', () => {
    const result = greeksTargetSchema.safeParse(makeGreeksTarget({ minValue: 7, maxValue: 7 }));
    expect(result.success).toBe(true);
  });

  it('rejects target with min > max', () => {
    const result = greeksTargetSchema.safeParse(makeGreeksTarget({ minValue: 15, maxValue: 10 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('Minimum value'))).toBe(true);
    }
  });

  it('accepts target with only min (no max)', () => {
    const result = greeksTargetSchema.safeParse(makeGreeksTarget({ minValue: 5 }));
    expect(result.success).toBe(true);
  });

  it('accepts target with only max (no min)', () => {
    const result = greeksTargetSchema.safeParse(makeGreeksTarget({ maxValue: 10 }));
    expect(result.success).toBe(true);
  });
});

describe('riskManagementSchema — Req 3.5: BP ascending order', () => {
  it('accepts thresholds in ascending order', () => {
    const result = riskManagementSchema.safeParse({
      bpThresholds: [makeBPThreshold(25), makeBPThreshold(50), makeBPThreshold(75)],
      positionLimits: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects thresholds in descending order', () => {
    const result = riskManagementSchema.safeParse({
      bpThresholds: [makeBPThreshold(75), makeBPThreshold(50), makeBPThreshold(25)],
      positionLimits: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('ascending order'))).toBe(true);
    }
  });

  it('rejects thresholds with equal adjacent values', () => {
    const result = riskManagementSchema.safeParse({
      bpThresholds: [makeBPThreshold(50), { ...makeBPThreshold(50), id: 'bp-50b' }],
      positionLimits: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('riskManagementSchema — Req 3.6: duplicate BP threshold', () => {
  it('rejects duplicate BP threshold percentages', () => {
    const result = riskManagementSchema.safeParse({
      bpThresholds: [
        makeBPThreshold(25),
        makeBPThreshold(50),
        { ...makeBPThreshold(25), id: 'bp-25-dup' },
      ],
      positionLimits: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('Duplicate') || m.includes('ascending'))).toBe(true);
    }
  });
});

describe('tradingPlanSchema — Req 4.4: trade rules 1-50', () => {
  it('accepts 1 trade rule', () => {
    const result = tradingPlanSchema.safeParse(makeValidPlan({ tradeRules: [makeTradeRule(1)] }));
    expect(result.success).toBe(true);
  });

  it('accepts 50 trade rules', () => {
    const rules = Array.from({ length: 50 }, (_, i) => makeTradeRule(i + 1));
    const result = tradingPlanSchema.safeParse(makeValidPlan({ tradeRules: rules }));
    expect(result.success).toBe(true);
  });

  it('rejects 0 trade rules', () => {
    const result = tradingPlanSchema.safeParse(makeValidPlan({ tradeRules: [] }));
    expect(result.success).toBe(false);
  });

  it('rejects 51 trade rules', () => {
    const rules = Array.from({ length: 51 }, (_, i) => makeTradeRule(i + 1));
    const result = tradingPlanSchema.safeParse(makeValidPlan({ tradeRules: rules }));
    expect(result.success).toBe(false);
  });
});

describe('tradingPlanSchema — Req 7.3: market regimes 3-10', () => {
  it('accepts 3 market regimes', () => {
    const regimes = [makeMarketRegime('A'), makeMarketRegime('B'), makeMarketRegime('C')];
    const result = tradingPlanSchema.safeParse(makeValidPlan({ marketRegimes: regimes }));
    expect(result.success).toBe(true);
  });

  it('accepts 10 market regimes', () => {
    const regimes = Array.from({ length: 10 }, (_, i) => makeMarketRegime(`Regime${i}`));
    const result = tradingPlanSchema.safeParse(makeValidPlan({ marketRegimes: regimes }));
    expect(result.success).toBe(true);
  });

  it('rejects 2 market regimes', () => {
    const regimes = [makeMarketRegime('A'), makeMarketRegime('B')];
    const result = tradingPlanSchema.safeParse(makeValidPlan({ marketRegimes: regimes }));
    expect(result.success).toBe(false);
  });

  it('rejects 11 market regimes', () => {
    const regimes = Array.from({ length: 11 }, (_, i) => makeMarketRegime(`Regime${i}`));
    const result = tradingPlanSchema.safeParse(makeValidPlan({ marketRegimes: regimes }));
    expect(result.success).toBe(false);
  });
});

describe('strategySchema — Req 9.8: entry criteria + management rules', () => {
  it('accepts strategy with at least 1 entry criterion and 1 management rule', () => {
    const result = strategySchema.safeParse(makeStrategy());
    expect(result.success).toBe(true);
  });

  it('rejects strategy with no entry criteria', () => {
    const result = strategySchema.safeParse(makeStrategy({ entryCriteria: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('entry criterion'))).toBe(true);
    }
  });

  it('rejects strategy with no management rules', () => {
    const result = strategySchema.safeParse(makeStrategy({ managementRules: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('management rule'))).toBe(true);
    }
  });
});

describe('validateAllocationSum — Req 8.3: allocation sum warning', () => {
  it('returns valid when allocations sum to 100%', () => {
    const result = validateAllocationSum([makeAllocation(60), makeAllocation(40)]);
    expect(result.isValid).toBe(true);
    expect(result.sum).toBe(100);
    expect(result.warning).toBeUndefined();
  });

  it('returns warning when allocations sum to less than 100%', () => {
    const result = validateAllocationSum([makeAllocation(30), makeAllocation(20)]);
    expect(result.isValid).toBe(false);
    expect(result.sum).toBe(50);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('50%');
  });

  it('returns warning when allocations sum to more than 100%', () => {
    const result = validateAllocationSum([makeAllocation(60), makeAllocation(60)]);
    expect(result.isValid).toBe(false);
    expect(result.sum).toBe(120);
    expect(result.warning).toContain('120%');
  });

  it('returns valid for single 100% allocation', () => {
    const result = validateAllocationSum([makeAllocation(100)]);
    expect(result.isValid).toBe(true);
    expect(result.sum).toBe(100);
  });

  it('returns warning for empty allocations (sum = 0)', () => {
    const result = validateAllocationSum([]);
    expect(result.isValid).toBe(false);
    expect(result.sum).toBe(0);
    expect(result.warning).toBeDefined();
  });
});
