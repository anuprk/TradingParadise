import { describe, it, expect } from 'vitest';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';
import {
  dailyPremiumIncome,
  weeklyPremiumIncome,
  monthlyPremiumIncome,
  computeAggregatedMetrics,
  computePerformanceByStrategy,
  dailyIncomeData,
  monthlyIncomeData,
  cumulativePLData,
  filterByPeriod,
} from '../optionsDashboard';

/**
 * Unit tests for Options Dashboard aggregation logic.
 *
 * Requirements: 18.1, 18.6, 18.12
 */

function makeEntry(overrides: Partial<TradeJournalEntry> = {}): TradeJournalEntry {
  return {
    id: 'e1',
    stockSymbol: 'AAPL',
    openDate: new Date('2025-01-10'),
    expirationDate: new Date('2025-02-10'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 150,
    dte: 31,
    ditc: 0,
    breakEvenPrice: 145,
    strikePrice: 150,
    premium: 5,
    cashReserve: 15000,
    fees: 1.5,
    tradeStatus: 'Closed',
    closeDate: new Date('2025-01-15'),
    exitPrice: 0.5,
    profitLoss: 3.5,
    winLoss: 'Win',
    daysHeld: 5,
    annualizedROR: 24.33,
    marginAnnualizedROR: undefined,
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Premium Income Calculations', () => {
  it('returns 0 when no entries', () => {
    expect(dailyPremiumIncome([], new Date())).toBe(0);
    expect(weeklyPremiumIncome([], new Date())).toBe(0);
    expect(monthlyPremiumIncome([], new Date())).toBe(0);
  });

  it('sums premiums for entries closed on the reference day', () => {
    const ref = new Date('2025-06-15T12:00:00');
    const entries = [
      makeEntry({ id: 'a', premium: 10, closeDate: new Date('2025-06-15T09:00:00'), tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', premium: 20, closeDate: new Date('2025-06-15T15:00:00'), tradeStatus: 'Closed' }),
      makeEntry({ id: 'c', premium: 5, closeDate: new Date('2025-06-14T15:00:00'), tradeStatus: 'Closed' }),
    ];
    expect(dailyPremiumIncome(entries, ref)).toBe(30);
  });

  it('sums premiums for entries closed in the reference week', () => {
    // 2025-06-16 is a Monday
    const ref = new Date('2025-06-18T12:00:00'); // Wednesday
    const entries = [
      makeEntry({ id: 'a', premium: 10, closeDate: new Date('2025-06-16T09:00:00'), tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', premium: 15, closeDate: new Date('2025-06-20T09:00:00'), tradeStatus: 'Closed' }),
      makeEntry({ id: 'c', premium: 5, closeDate: new Date('2025-06-14T09:00:00'), tradeStatus: 'Closed' }), // previous week
    ];
    expect(weeklyPremiumIncome(entries, ref)).toBe(25);
  });

  it('sums premiums for entries closed in the reference month', () => {
    const ref = new Date(2025, 2, 15); // March 15 local
    const entries = [
      makeEntry({ id: 'a', premium: 100, closeDate: new Date(2025, 2, 1), tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', premium: 200, closeDate: new Date(2025, 2, 28), tradeStatus: 'Closed' }),
      makeEntry({ id: 'c', premium: 50, closeDate: new Date(2025, 1, 28), tradeStatus: 'Closed' }), // Feb
    ];
    expect(monthlyPremiumIncome(entries, ref)).toBe(300);
  });

  it('excludes open entries from premium income', () => {
    const ref = new Date('2025-06-15');
    const entries = [
      makeEntry({ id: 'a', premium: 10, closeDate: new Date('2025-06-15'), tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', premium: 20, tradeStatus: 'Open', closeDate: undefined }),
    ];
    expect(dailyPremiumIncome(entries, ref)).toBe(10);
  });
});

describe('Aggregated Metrics', () => {
  it('returns zeros for empty entries', () => {
    const m = computeAggregatedMetrics([]);
    expect(m.totalTrades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.totalPL).toBe(0);
    expect(m.avgPL).toBe(0);
    expect(m.totalFees).toBe(0);
    expect(m.avgAnnualizedROR).toBe(0);
    expect(m.avgMarginAnnualizedROR).toBe(0);
  });

  it('computes correct metrics for closed entries', () => {
    const entries = [
      makeEntry({ id: 'a', profitLoss: 100, winLoss: 'Win', fees: 2, annualizedROR: 20, tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', profitLoss: -50, winLoss: 'Loss', fees: 3, annualizedROR: -10, tradeStatus: 'Closed' }),
      makeEntry({ id: 'c', profitLoss: 75, winLoss: 'Win', fees: 1, annualizedROR: 30, tradeStatus: 'Closed' }),
    ];
    const m = computeAggregatedMetrics(entries);
    expect(m.totalTrades).toBe(3);
    expect(m.winRate).toBeCloseTo(66.67, 1);
    expect(m.totalPL).toBe(125);
    expect(m.avgPL).toBeCloseTo(41.67, 1);
    expect(m.totalFees).toBe(6);
    expect(m.avgAnnualizedROR).toBeCloseTo(13.33, 1);
  });

  it('ignores open entries in metrics', () => {
    const entries = [
      makeEntry({ id: 'a', profitLoss: 100, winLoss: 'Win', fees: 2, tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', tradeStatus: 'Open', profitLoss: undefined, winLoss: null }),
    ];
    const m = computeAggregatedMetrics(entries);
    expect(m.totalTrades).toBe(1);
  });
});

describe('Performance by Strategy', () => {
  const strategies: Strategy[] = [
    {
      id: 's1',
      name: 'Iron Condor',
      classification: 'Core',
      description: '',
      entryCriteria: [{ id: 'ec1', parameterName: 'DTE', value: '45' }],
      managementRules: [{ id: 'mr1', triggerCondition: 'test', actionDescription: 'test' }],
      profitTargets: [],
      stopLosses: [],
    },
    {
      id: 's2',
      name: 'Covered Call',
      classification: 'Core',
      description: '',
      entryCriteria: [{ id: 'ec2', parameterName: 'DTE', value: '30' }],
      managementRules: [{ id: 'mr2', triggerCondition: 'test', actionDescription: 'test' }],
      profitTargets: [],
      stopLosses: [],
    },
  ];

  it('returns empty array when no closed trades', () => {
    const result = computePerformanceByStrategy([], strategies);
    expect(result).toEqual([]);
  });

  it('groups entries by strategy and computes per-strategy metrics', () => {
    const entries = [
      makeEntry({ id: 'a', strategyId: 's1', profitLoss: 100, winLoss: 'Win', annualizedROR: 20, tradeStatus: 'Closed' }),
      makeEntry({ id: 'b', strategyId: 's1', profitLoss: -30, winLoss: 'Loss', annualizedROR: -5, tradeStatus: 'Closed' }),
      makeEntry({ id: 'c', strategyId: 's2', profitLoss: 50, winLoss: 'Win', annualizedROR: 15, tradeStatus: 'Closed' }),
    ];
    const result = computePerformanceByStrategy(entries, strategies);

    expect(result).toHaveLength(2);

    // Sorted by totalPL descending
    const s1 = result.find((r) => r.strategyId === 's1')!;
    expect(s1.strategyName).toBe('Iron Condor');
    expect(s1.totalTrades).toBe(2);
    expect(s1.winRate).toBe(50);
    expect(s1.totalPL).toBe(70);
    expect(s1.avgAnnualizedROR).toBeCloseTo(7.5);

    const s2 = result.find((r) => r.strategyId === 's2')!;
    expect(s2.strategyName).toBe('Covered Call');
    expect(s2.totalTrades).toBe(1);
    expect(s2.winRate).toBe(100);
    expect(s2.totalPL).toBe(50);
  });

  it('labels unknown strategies', () => {
    const entries = [
      makeEntry({ id: 'a', strategyId: 'unknown-id', profitLoss: 10, winLoss: 'Win', tradeStatus: 'Closed' }),
    ];
    const result = computePerformanceByStrategy(entries, []);
    expect(result[0].strategyName).toBe('Unknown Strategy');
  });
});

describe('Empty state handling', () => {
  it('dailyIncomeData returns empty for no entries', () => {
    expect(dailyIncomeData([], 'all')).toEqual([]);
  });

  it('monthlyIncomeData returns empty for no entries', () => {
    expect(monthlyIncomeData([], 'all')).toEqual([]);
  });

  it('cumulativePLData returns empty for no entries', () => {
    expect(cumulativePLData([], 'all')).toEqual([]);
  });

  it('filterByPeriod returns all entries for "all" period', () => {
    const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    expect(filterByPeriod(entries, 'all')).toHaveLength(2);
  });
});
