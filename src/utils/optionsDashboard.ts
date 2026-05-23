/**
 * Aggregation utilities for the Options Dashboard.
 * Pure functions that compute premium income, performance metrics,
 * and strategy breakdowns from journal entries.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.6, 18.7, 18.10
 */

import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  isWithinInterval,
  subDays,
  subMonths,
  format,
} from 'date-fns';
import type { TradeJournalEntry } from '../types/journal';
import type { Strategy } from '../types/tradingPlan';

/* ------------------------------------------------------------------ */
/*  Premium Income                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sum premiums of entries closed within a date interval.
 */
export function sumPremiumInRange(
  entries: TradeJournalEntry[],
  start: Date,
  end: Date,
): number {
  return entries
    .filter((e) => {
      if (e.tradeStatus !== 'Closed' || !e.closeDate) return false;
      const close = new Date(e.closeDate);
      return isWithinInterval(close, { start, end });
    })
    .reduce((sum, e) => sum + e.premium, 0);
}

export function dailyPremiumIncome(
  entries: TradeJournalEntry[],
  ref: Date = new Date(),
): number {
  return sumPremiumInRange(entries, startOfDay(ref), endOfDay(ref));
}

export function weeklyPremiumIncome(
  entries: TradeJournalEntry[],
  ref: Date = new Date(),
): number {
  return sumPremiumInRange(
    entries,
    startOfWeek(ref, { weekStartsOn: 1 }),
    endOfWeek(ref, { weekStartsOn: 1 }),
  );
}

export function monthlyPremiumIncome(
  entries: TradeJournalEntry[],
  ref: Date = new Date(),
): number {
  return sumPremiumInRange(entries, startOfMonth(ref), endOfMonth(ref));
}

/* ------------------------------------------------------------------ */
/*  Time period helpers                                                */
/* ------------------------------------------------------------------ */

export type TimePeriod = '30d' | '90d' | '6m' | '1y' | 'all';

export function periodStartDate(period: TimePeriod, ref: Date = new Date()): Date | null {
  switch (period) {
    case '30d': return subDays(ref, 30);
    case '90d': return subDays(ref, 90);
    case '6m': return subMonths(ref, 6);
    case '1y': return subMonths(ref, 12);
    case 'all': return null;
  }
}

export function filterByPeriod(
  entries: TradeJournalEntry[],
  period: TimePeriod,
  ref: Date = new Date(),
): TradeJournalEntry[] {
  const start = periodStartDate(period, ref);
  if (!start) return entries;
  const startTime = start.getTime();
  return entries.filter((e) => {
    const d = e.closeDate ? new Date(e.closeDate) : new Date(e.openDate);
    return d.getTime() >= startTime;
  });
}

/* ------------------------------------------------------------------ */
/*  Chart data                                                         */
/* ------------------------------------------------------------------ */

export interface DailyIncomePoint {
  date: string; // YYYY-MM-DD
  income: number;
}

export function dailyIncomeData(
  entries: TradeJournalEntry[],
  period: TimePeriod,
  ref: Date = new Date(),
): DailyIncomePoint[] {
  const closed = entries.filter((e) => e.tradeStatus === 'Closed' && e.closeDate);
  const start = periodStartDate(period, ref);

  const map = new Map<string, number>();
  for (const e of closed) {
    const d = new Date(e.closeDate!);
    if (start && d.getTime() < start.getTime()) continue;
    const key = format(d, 'yyyy-MM-dd');
    map.set(key, (map.get(key) ?? 0) + e.premium);
  }

  return Array.from(map.entries())
    .map(([date, income]) => ({ date, income }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthlyIncomePoint {
  month: string; // YYYY-MM
  income: number;
}

export function monthlyIncomeData(
  entries: TradeJournalEntry[],
  period: TimePeriod,
  ref: Date = new Date(),
): MonthlyIncomePoint[] {
  const closed = entries.filter((e) => e.tradeStatus === 'Closed' && e.closeDate);
  const start = periodStartDate(period, ref);

  const map = new Map<string, number>();
  for (const e of closed) {
    const d = new Date(e.closeDate!);
    if (start && d.getTime() < start.getTime()) continue;
    const key = format(d, 'yyyy-MM');
    map.set(key, (map.get(key) ?? 0) + e.premium);
  }

  return Array.from(map.entries())
    .map(([month, income]) => ({ month, income }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface CumulativePLPoint {
  date: string; // YYYY-MM-DD
  cumulativePL: number;
}

export function cumulativePLData(
  entries: TradeJournalEntry[],
  period: TimePeriod,
  ref: Date = new Date(),
): CumulativePLPoint[] {
  const closed = entries
    .filter((e) => e.tradeStatus === 'Closed' && e.closeDate)
    .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime());

  const start = periodStartDate(period, ref);

  let running = 0;
  const points: CumulativePLPoint[] = [];
  for (const e of closed) {
    const d = new Date(e.closeDate!);
    running += e.profitLoss ?? 0;
    if (start && d.getTime() < start.getTime()) continue;
    points.push({ date: format(d, 'yyyy-MM-dd'), cumulativePL: running });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/*  Performance metrics                                                */
/* ------------------------------------------------------------------ */

export interface AggregatedMetrics {
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  avgAnnualizedROR: number;
  avgMarginAnnualizedROR: number;
  totalFees: number;
}

export function computeAggregatedMetrics(entries: TradeJournalEntry[]): AggregatedMetrics {
  const closed = entries.filter((e) => e.tradeStatus === 'Closed');
  const total = closed.length;

  if (total === 0) {
    return { totalTrades: 0, winRate: 0, totalPL: 0, avgPL: 0, avgAnnualizedROR: 0, avgMarginAnnualizedROR: 0, totalFees: 0 };
  }

  const wins = closed.filter((e) => e.winLoss === 'Win').length;
  const totalPL = closed.reduce((s, e) => s + (e.profitLoss ?? 0), 0);
  const totalFees = closed.reduce((s, e) => s + e.fees, 0);

  const rorValues = closed.filter((e) => e.annualizedROR != null).map((e) => e.annualizedROR!);
  const marginRorValues = closed.filter((e) => e.marginAnnualizedROR != null).map((e) => e.marginAnnualizedROR!);

  return {
    totalTrades: total,
    winRate: (wins / total) * 100,
    totalPL,
    avgPL: totalPL / total,
    avgAnnualizedROR: rorValues.length > 0 ? rorValues.reduce((a, b) => a + b, 0) / rorValues.length : 0,
    avgMarginAnnualizedROR: marginRorValues.length > 0 ? marginRorValues.reduce((a, b) => a + b, 0) / marginRorValues.length : 0,
    totalFees,
  };
}

/* ------------------------------------------------------------------ */
/*  Strategy breakdown                                                 */
/* ------------------------------------------------------------------ */

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgAnnualizedROR: number;
}

export function computePerformanceByStrategy(
  entries: TradeJournalEntry[],
  strategies: Strategy[],
): StrategyPerformance[] {
  const nameMap = new Map<string, string>();
  for (const s of strategies) nameMap.set(s.id, s.name);

  // Also include strategies from entries not in the plan
  const strategyIds = new Set([
    ...strategies.map((s) => s.id),
    ...entries.map((e) => e.strategyId),
  ]);

  const results: StrategyPerformance[] = [];

  for (const sid of strategyIds) {
    const closed = entries.filter((e) => e.strategyId === sid && e.tradeStatus === 'Closed');
    if (closed.length === 0) continue;

    const wins = closed.filter((e) => e.winLoss === 'Win').length;
    const totalPL = closed.reduce((s, e) => s + (e.profitLoss ?? 0), 0);
    const rorValues = closed.filter((e) => e.annualizedROR != null).map((e) => e.annualizedROR!);

    results.push({
      strategyId: sid,
      strategyName: nameMap.get(sid) ?? 'Unknown Strategy',
      totalTrades: closed.length,
      winRate: (wins / closed.length) * 100,
      totalPL,
      avgAnnualizedROR: rorValues.length > 0 ? rorValues.reduce((a, b) => a + b, 0) / rorValues.length : 0,
    });
  }

  return results.sort((a, b) => b.totalPL - a.totalPL);
}
