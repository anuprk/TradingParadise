/**
 * Unit tests for JSON serialization utilities.
 * Tests serializePlan, deserializePlan, and ValidationError.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

import { describe, it, expect } from 'vitest';
import {
  serializePlan,
  deserializePlan,
  ValidationError,
} from '../serialization';
import type { TradingPlan } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';
import type { TradeJournalEntry } from '../../types/journal';
import type { Reminder } from '../../types/reminder';

// --- Test fixtures ---

function createMinimalPlan(): TradingPlan {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'plan-1',
    name: 'Test Plan',
    author: 'Test Author',
    year: 2025,
    createdAt: now,
    updatedAt: now,
    goals: [{ id: 'g1', description: 'Goal 1', targetValue: '10%' }],
    greeksTargets: [],
    riskManagement: {
      bpThresholds: [],
      positionLimits: [],
    },
    tradeRules: [{ id: 'r1', order: 0, text: 'Rule 1' }],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [],
    marketRegimes: [
      { id: 'mr1', name: 'Bullish', conditions: 'Up trend', strategyAdjustments: 'Increase' },
      { id: 'mr2', name: 'Neutral', conditions: 'Sideways', strategyAdjustments: 'Hold' },
      { id: 'mr3', name: 'Bearish', conditions: 'Down trend', strategyAdjustments: 'Reduce' },
    ],
    accountSizing: { totalAccountSize: 100000, allocations: [] },
    coreStrategies: [],
    speculativeStrategies: [],
  };
}

function createMinimalPortfolio(): Portfolio {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'port-1',
    name: 'Main Account',
    description: 'Primary trading account',
    initialBalance: 50000,
    planId: 'plan-1',
    createdAt: now,
    updatedAt: now,
  };
}

function createMinimalJournalEntry(): TradeJournalEntry {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'je-1',
    stockSymbol: 'AAPL',
    openDate: now,
    expirationDate: new Date('2025-03-15T10:00:00.000Z'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 150,
    dte: 59,
    ditc: 0,
    breakEvenPrice: 145,
    strikePrice: 150,
    premium: 5,
    cashReserve: 15000,
    fees: 1.5,
    winLoss: null,
    tradeStatus: 'Open',
    portfolioId: 'port-1',
    strategyId: 'strat-1',
    planId: 'plan-1',
    notes: 'Test trade',
    createdAt: now,
    updatedAt: now,
  };
}

function createMinimalReminder(): Reminder {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'rem-1',
    title: 'Check positions',
    description: 'Review open positions',
    date: now,
    time: '09:00',
    recurrence: 'daily',
    status: 'pending',
    planId: 'plan-1',
    createdAt: now,
    updatedAt: now,
  };
}

// --- Tests ---

describe('ValidationError', () => {
  it('should be an instance of Error', () => {
    const err = new ValidationError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('should store field errors', () => {
    const fieldErrors = ['plan.name: Required', 'plan.year: Expected number'];
    const err = new ValidationError('Invalid data', fieldErrors);
    expect(err.message).toBe('Invalid data');
    expect(err.fieldErrors).toEqual(fieldErrors);
    expect(err.name).toBe('ValidationError');
  });

  it('should default to empty field errors', () => {
    const err = new ValidationError('test');
    expect(err.fieldErrors).toEqual([]);
  });
});

describe('serializePlan', () => {
  it('should produce valid JSON with version and exportedAt', () => {
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe('1.0');
    expect(parsed.exportedAt).toBeDefined();
    expect(typeof parsed.exportedAt).toBe('string');
    // exportedAt should be a valid ISO date string
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
  });

  it('should include plan, portfolios, journalEntries, and reminders', () => {
    const plan = createMinimalPlan();
    const portfolios = [createMinimalPortfolio()];
    const entries = [createMinimalJournalEntry()];
    const reminders = [createMinimalReminder()];

    const json = serializePlan(plan, portfolios, entries, reminders);
    const parsed = JSON.parse(json);

    expect(parsed.plan.id).toBe('plan-1');
    expect(parsed.portfolios).toHaveLength(1);
    expect(parsed.journalEntries).toHaveLength(1);
    expect(parsed.reminders).toHaveLength(1);
  });

  it('should convert Date objects to ISO strings', () => {
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    const parsed = JSON.parse(json);

    expect(typeof parsed.plan.createdAt).toBe('string');
    expect(parsed.plan.createdAt).toBe('2025-01-15T10:00:00.000Z');
  });

  it('should produce pretty-printed JSON with 2-space indent', () => {
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    // Pretty-printed JSON starts with "{\n  "
    expect(json).toMatch(/^\{\n {2}/);
  });
});

describe('deserializePlan', () => {
  it('should round-trip a complete plan with all data types', () => {
    const plan = createMinimalPlan();
    const portfolios = [createMinimalPortfolio()];
    const entries = [createMinimalJournalEntry()];
    const reminders = [createMinimalReminder()];

    const json = serializePlan(plan, portfolios, entries, reminders);
    const result = deserializePlan(json);

    expect(result.version).toBe('1.0');
    expect(result.plan.id).toBe('plan-1');
    expect(result.plan.name).toBe('Test Plan');
    expect(result.portfolios).toHaveLength(1);
    expect(result.journalEntries).toHaveLength(1);
    expect(result.reminders).toHaveLength(1);
  });

  it('should convert ISO date strings back to Date objects', () => {
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    const result = deserializePlan(json);

    expect(result.plan.createdAt).toBeInstanceOf(Date);
    expect(result.plan.updatedAt).toBeInstanceOf(Date);
    expect(result.plan.createdAt.toISOString()).toBe('2025-01-15T10:00:00.000Z');
  });

  it('should convert journal entry dates back to Date objects', () => {
    const plan = createMinimalPlan();
    const entries = [createMinimalJournalEntry()];
    const json = serializePlan(plan, [], entries, []);
    const result = deserializePlan(json);

    expect(result.journalEntries[0].openDate).toBeInstanceOf(Date);
    expect(result.journalEntries[0].expirationDate).toBeInstanceOf(Date);
    expect(result.journalEntries[0].createdAt).toBeInstanceOf(Date);
  });

  it('should convert portfolio dates back to Date objects', () => {
    const plan = createMinimalPlan();
    const portfolios = [createMinimalPortfolio()];
    const json = serializePlan(plan, portfolios, [], []);
    const result = deserializePlan(json);

    expect(result.portfolios[0].createdAt).toBeInstanceOf(Date);
    expect(result.portfolios[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should convert reminder dates back to Date objects', () => {
    const plan = createMinimalPlan();
    const reminders = [createMinimalReminder()];
    const json = serializePlan(plan, [], [], reminders);
    const result = deserializePlan(json);

    expect(result.reminders[0].date).toBeInstanceOf(Date);
    expect(result.reminders[0].createdAt).toBeInstanceOf(Date);
  });

  it('should throw ValidationError for invalid JSON syntax', () => {
    expect(() => deserializePlan('not valid json')).toThrow(ValidationError);
    expect(() => deserializePlan('not valid json')).toThrow(
      'Invalid JSON: unable to parse the provided string',
    );
  });

  it('should throw ValidationError for empty object', () => {
    expect(() => deserializePlan('{}')).toThrow(ValidationError);
  });

  it('should throw ValidationError with field-level messages for missing fields', () => {
    try {
      deserializePlan('{"version": "1.0", "exportedAt": "2025-01-01"}');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.fieldErrors.length).toBeGreaterThan(0);
      // Should mention missing plan field
      expect(ve.fieldErrors.some((e) => e.includes('plan'))).toBe(true);
    }
  });

  it('should throw ValidationError for invalid plan data types', () => {
    const badData = {
      version: '1.0',
      exportedAt: '2025-01-01T00:00:00.000Z',
      plan: { id: '', name: '', author: '', year: 1999 },
      portfolios: [],
      journalEntries: [],
      reminders: [],
    };
    try {
      deserializePlan(JSON.stringify(badData));
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.fieldErrors.length).toBeGreaterThan(0);
    }
  });

  it('should not modify existing data on import failure', () => {
    // Verify that deserializePlan is pure — it either returns new data or throws
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    const result1 = deserializePlan(json);

    // Attempting to deserialize bad data should throw, not corrupt result1
    expect(() => deserializePlan('bad')).toThrow(ValidationError);
    expect(result1.plan.id).toBe('plan-1');
  });

  it('should handle empty arrays for portfolios, entries, and reminders', () => {
    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [], []);
    const result = deserializePlan(json);

    expect(result.portfolios).toEqual([]);
    expect(result.journalEntries).toEqual([]);
    expect(result.reminders).toEqual([]);
  });

  it('should preserve optional fields when present', () => {
    const plan = createMinimalPlan();
    plan.riskManagement.maxLossPerTrade = 500;
    plan.riskManagement.maxLossPerPortfolio = 5000;

    const json = serializePlan(plan, [], [], []);
    const result = deserializePlan(json);

    expect(result.plan.riskManagement.maxLossPerTrade).toBe(500);
    expect(result.plan.riskManagement.maxLossPerPortfolio).toBe(5000);
  });

  it('should preserve journal entry optional fields', () => {
    const entry = createMinimalJournalEntry();
    entry.closeDate = new Date('2025-02-15T10:00:00.000Z');
    entry.exitPrice = 2;
    entry.profitLoss = 300;
    entry.winLoss = 'Win';
    entry.daysHeld = 31;

    const plan = createMinimalPlan();
    const json = serializePlan(plan, [], [entry], []);
    const result = deserializePlan(json);

    const re = result.journalEntries[0];
    expect(re.closeDate).toBeInstanceOf(Date);
    expect(re.exitPrice).toBe(2);
    expect(re.profitLoss).toBe(300);
    expect(re.winLoss).toBe('Win');
    expect(re.daysHeld).toBe(31);
  });
});
