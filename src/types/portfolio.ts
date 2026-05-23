/**
 * TypeScript type definitions for Portfolio data models.
 * Matches the design document data model specification exactly.
 */

import type { OptionType } from './journal';

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  initialBalance: number;
  planId: string;                      // Linked Trading Plan
  createdAt: Date;
  updatedAt: Date;
}

/** Computed from journal entries — not stored */
export interface PortfolioMetrics {
  netLiquidation: number;
  totalRealizedPL: number;
  totalUnrealizedPL: number;
  totalPL: number;
  monthlyReturns: MonthlyReturn[];
  maxDrawdown: number;
  cumulativeReturn: number;
  winRate: number;
  averageTradeReturn: number;
  totalTrades: number;
}

export interface MonthlyReturn {
  month: string;                       // "YYYY-MM"
  dollarReturn: number;
  percentageReturn: number;
}

export interface OpenPosition {
  stockSymbol: string;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
}
