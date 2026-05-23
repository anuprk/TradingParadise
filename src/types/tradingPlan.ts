/**
 * TypeScript type definitions for Trading Plan data models.
 * Matches the design document data model specification exactly.
 */

export interface TradingPlan {
  id: string;                          // UUID
  name: string;                        // Plan name
  author: string;                      // Author name
  year: number;                        // Plan year
  createdAt: Date;
  updatedAt: Date;
  goals: Goal[];
  greeksTargets: GreeksTarget[];
  riskManagement: RiskManagement;
  tradeRules: TradeRule[];
  dailyManagement: DailyManagement;
  vacationRules: VacationRule[];
  marketRegimes: MarketRegime[];
  accountSizing: AccountSizing;
  coreStrategies: Strategy[];
  speculativeStrategies: Strategy[];
}

export interface Goal {
  id: string;
  description: string;
  targetValue: string;
}

export interface GreeksTarget {
  id: string;
  metricName: string;                  // "Delta", "Theta", "Vega", or custom
  targetDescription: string;
  minValue?: number;
  maxValue?: number;
}

export interface RiskManagement {
  bpThresholds: BPThreshold[];
  positionLimits: PositionLimit[];
  maxLossPerTrade?: number;
  maxLossPerPortfolio?: number;
}

export interface BPThreshold {
  id: string;
  percentage: number;                  // 0-100
  actionDescription: string;
}

export interface PositionLimit {
  id: string;
  strategyName: string;
  maxPositions: number;
  maxPerUnderlying: number;
}

export interface TradeRule {
  id: string;
  order: number;
  text: string;
  category?: string;
}

export interface DailyManagement {
  nightlyReview: ChecklistItem[];
  morningReview: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  order: number;
  description: string;
  reviewType: 'nightly' | 'morning';
}

export interface VacationRule {
  id: string;
  order: number;
  text: string;
}

export interface MarketRegime {
  id: string;
  name: string;                        // "Bullish", "Neutral", "Bearish", etc.
  conditions: string;
  strategyAdjustments: string;
}

export interface AccountSizing {
  totalAccountSize: number;
  allocations: StrategyAllocation[];
}

export interface StrategyAllocation {
  id: string;
  categoryName: string;
  allocationPercentage: number;
  numberOfPositions?: number;
  positionSizing?: string;
}

export interface Strategy {
  id: string;
  name: string;
  classification: 'Core' | 'Speculative';
  description: string;
  variants?: StrategyVariant[];
  entryCriteria: EntryCriterion[];
  managementRules: ManagementRule[];
  profitTargets: ProfitTarget[];
  stopLosses: StopLoss[];
}

export interface StrategyVariant {
  id: string;
  name: string;
  description: string;
}

export interface EntryCriterion {
  id: string;
  parameterName: string;
  value: string;
}

export interface ManagementRule {
  id: string;
  triggerCondition: string;
  actionDescription: string;
}

export interface ProfitTarget {
  id: string;
  targetValue: string;                 // Percentage or dollar
  action: string;
}

export interface StopLoss {
  id: string;
  stopValue: string;                   // Percentage or dollar
  action: string;
}
