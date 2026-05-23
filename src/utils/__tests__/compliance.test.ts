import { describe, it, expect } from 'vitest';
import {
  checkTradeCompliance,
  calculateCompliancePercentage,
  parseRange,
  parseSingleNumber,
} from '../compliance';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';

function makeEntry(overrides: Partial<TradeJournalEntry> = {}): TradeJournalEntry {
  return {
    id: 'entry-1',
    stockSymbol: 'SPY',
    openDate: new Date('2025-01-01'),
    expirationDate: new Date('2025-02-14'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 450,
    dte: 44,
    ditc: 10,
    breakEvenPrice: 395,
    strikePrice: 400,
    premium: 5,
    cashReserve: 40000,
    fees: 1.5,
    tradeStatus: 'Open',
    portfolioId: 'port-1',
    strategyId: 'strat-1',
    planId: 'plan-1',
    notes: '',
    winLoss: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 'strat-1',
    name: 'Short Put',
    classification: 'Core',
    description: 'Cash-secured short put',
    entryCriteria: [],
    managementRules: [{ id: 'mr-1', triggerCondition: 'At 50%', actionDescription: 'Close' }],
    profitTargets: [],
    stopLosses: [],
    ...overrides,
  };
}

describe('parseRange', () => {
  it('parses a simple integer range', () => {
    expect(parseRange('30-45')).toEqual({ min: 30, max: 45 });
  });

  it('parses a range with spaces', () => {
    expect(parseRange('30 - 45')).toEqual({ min: 30, max: 45 });
  });

  it('parses a decimal range', () => {
    expect(parseRange('0.20-0.35')).toEqual({ min: 0.20, max: 0.35 });
  });

  it('returns null for non-range strings', () => {
    expect(parseRange('45 DTE')).toBeNull();
    expect(parseRange('hello')).toBeNull();
    expect(parseRange('')).toBeNull();
  });
});

describe('parseSingleNumber', () => {
  it('parses a plain number', () => {
    expect(parseSingleNumber('45')).toBe(45);
  });

  it('strips DTE suffix', () => {
    expect(parseSingleNumber('45 DTE')).toBe(45);
  });

  it('strips % suffix', () => {
    expect(parseSingleNumber('50%')).toBe(50);
  });

  it('returns null for non-numeric strings', () => {
    expect(parseSingleNumber('hello')).toBeNull();
  });
});

describe('checkTradeCompliance', () => {
  it('returns compliant when strategy has no entry criteria', () => {
    const entry = makeEntry();
    const strategy = makeStrategy();
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
    expect(result.deviations).toHaveLength(0);
  });

  it('returns compliant when DTE is within range', () => {
    const entry = makeEntry({ dte: 40 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
    expect(result.deviations).toHaveLength(0);
  });

  it('flags deviation when DTE is outside range', () => {
    const entry = makeEntry({ dte: 60 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Days to Expiration', value: '30-45' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations).toHaveLength(1);
    expect(result.deviations[0].field).toBe('DTE');
    expect(result.deviations[0].actual).toBe('60');
  });

  it('handles case-insensitive parameter names', () => {
    const entry = makeEntry({ dte: 40 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'dte', value: '30-45' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
  });

  it('checks strike price against a single value with tolerance', () => {
    const entry = makeEntry({ strikePrice: 400 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Strike Price', value: '405' }],
    });
    // 400 vs 405 — within 10% tolerance of 405 (40.5)
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
  });

  it('flags strike price deviation beyond tolerance', () => {
    const entry = makeEntry({ strikePrice: 300 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Strike Price', value: '405' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations[0].field).toBe('Strike Price');
  });

  it('checks option type string match', () => {
    const entry = makeEntry({ optionType: 'Call' });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Option Type', value: 'Put' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations[0].field).toBe('Option Type');
    expect(result.deviations[0].severity).toBe('violation');
  });

  it('checks direction string match', () => {
    const entry = makeEntry({ direction: 'Buy' });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Direction', value: 'Sell' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations[0].field).toBe('Direction');
  });

  it('skips unrecognized criteria without flagging deviation', () => {
    const entry = makeEntry();
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'IV Rank', value: '> 30' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
  });

  it('checks multiple criteria and reports all deviations', () => {
    const entry = makeEntry({ dte: 60, optionType: 'Call' });
    const strategy = makeStrategy({
      entryCriteria: [
        { id: 'c1', parameterName: 'DTE', value: '30-45' },
        { id: 'c2', parameterName: 'Option Type', value: 'Put' },
      ],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations).toHaveLength(2);
  });

  it('assigns warning severity for values slightly outside range', () => {
    // DTE = 46, range 30-45. 46 is NOT > 45 * 1.1 (49.5), so it's a warning
    const entry = makeEntry({ dte: 46 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations[0].severity).toBe('warning');
  });

  it('assigns violation severity for values far outside range', () => {
    // DTE = 100, range 30-45. 100 > 45 * 1.1 (49.5), so it's a violation
    const entry = makeEntry({ dte: 100 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(false);
    expect(result.deviations[0].severity).toBe('violation');
  });

  it('checks premium against a single value', () => {
    const entry = makeEntry({ premium: 5 });
    const strategy = makeStrategy({
      entryCriteria: [{ id: 'c1', parameterName: 'Premium', value: '5.00' }],
    });
    const result = checkTradeCompliance(entry, strategy);
    expect(result.isCompliant).toBe(true);
  });
});

describe('calculateCompliancePercentage', () => {
  it('returns 100 when there are no entries', () => {
    expect(calculateCompliancePercentage([], [])).toBe(100);
  });

  it('returns 100 when all entries are compliant', () => {
    const entries = [
      makeEntry({ id: 'e1', dte: 40, strategyId: 'strat-1' }),
      makeEntry({ id: 'e2', dte: 35, strategyId: 'strat-1' }),
    ];
    const strategies = [
      makeStrategy({
        id: 'strat-1',
        entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
      }),
    ];
    expect(calculateCompliancePercentage(entries, strategies)).toBe(100);
  });

  it('returns 0 when no entries are compliant', () => {
    const entries = [
      makeEntry({ id: 'e1', dte: 60, strategyId: 'strat-1' }),
      makeEntry({ id: 'e2', dte: 10, strategyId: 'strat-1' }),
    ];
    const strategies = [
      makeStrategy({
        id: 'strat-1',
        entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
      }),
    ];
    expect(calculateCompliancePercentage(entries, strategies)).toBe(0);
  });

  it('returns correct percentage for mixed compliance', () => {
    const entries = [
      makeEntry({ id: 'e1', dte: 40, strategyId: 'strat-1' }),
      makeEntry({ id: 'e2', dte: 60, strategyId: 'strat-1' }),
    ];
    const strategies = [
      makeStrategy({
        id: 'strat-1',
        entryCriteria: [{ id: 'c1', parameterName: 'DTE', value: '30-45' }],
      }),
    ];
    expect(calculateCompliancePercentage(entries, strategies)).toBe(50);
  });

  it('treats entries with no matching strategy as non-compliant', () => {
    const entries = [
      makeEntry({ id: 'e1', strategyId: 'unknown-strat' }),
    ];
    const strategies = [makeStrategy({ id: 'strat-1' })];
    expect(calculateCompliancePercentage(entries, strategies)).toBe(0);
  });
});
