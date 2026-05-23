/**
 * Shared enums and utility types used across the TradingParadise application.
 */

/** Classification of a strategy as either Core or Speculative */
export type StrategyClassification = 'Core' | 'Speculative';

/** Review type for daily management checklist items */
export type ReviewType = 'nightly' | 'morning';

/** Time period selections for dashboard filtering */
export type TimePeriod = '30d' | '90d' | '6m' | '1y' | 'all';

/** Aggregation period for premium income calculations */
export type AggregationPeriod = 'day' | 'week' | 'month';

/** Compliance deviation severity levels */
export type DeviationSeverity = 'warning' | 'violation';

/** Serialized plan data envelope for JSON import/export */
export interface SerializedPlanData {
  version: string;
  exportedAt: string;
  plan: unknown;
  portfolios: unknown[];
  journalEntries: unknown[];
  reminders: unknown[];
}
