/**
 * TypeScript type definitions for Portfolio Transaction data models.
 * Supports multi-portfolio transaction tracking, brokerage statement import,
 * fingerprint-based de-duplication, holdings computation, and performance metrics.
 */

import type { OptionType } from './journal';

// --- Transaction Type Aliases ---

export type TransactionType =
  | 'Buy'
  | 'Sell'
  | 'Dividend'
  | 'Fee'
  | 'Transfer'
  | 'Expiration'
  | 'Assignment';

export type AssetType = 'Stock' | 'ETF' | 'Option' | 'Cash';

export type TransactionSource = 'tastytrade_pdf' | 'fidelity_pdf' | 'tastytrade_csv' | 'fidelity_csv' | 'csv' | 'manual';

// --- Core Transaction Interface ---

export interface PortfolioTransaction {
  id: string;
  portfolioId: string;
  planId: string;
  transactionDate: Date;
  settlementDate?: Date;
  symbol: string;
  description: string;
  transactionType: TransactionType;
  assetType: AssetType;
  optionType?: OptionType;
  strikePrice?: number;
  expirationDate?: Date;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  source: TransactionSource;
  rawDescription?: string;
  // Strategy linked to plan's strategy table (manually assigned)
  strategyId?: string;
  // Margin used for this position (editable)
  marginUsed?: number;
  // Computed: (P/L / cost basis) × (365 / days held) × 100
  annualizedReturn?: number;
  // Computed: P/L / marginUsed × 100
  returnOnMargin?: number;
  createdAt: Date;
  updatedAt: Date;
}

// --- Import Pipeline Interfaces ---

export interface ParseResult {
  transactions: PortfolioTransaction[];
  errors: ParseError[];
  skipped: number;
  total: number;
}

export interface ParseError {
  row: number;
  content: string;
  reason: string;
  missingFields?: string[];
}

// --- De-duplication Interfaces ---

export interface DuplicateReport {
  duplicates: DuplicateEntry[];
  unique: PortfolioTransaction[];
}

export interface DuplicateEntry {
  transaction: PortfolioTransaction;
  existingId: string;
  fingerprint: string;
  overrideInclude: boolean;
}

export interface TransactionFingerprint {
  transactionDate: string;
  symbol: string;
  transactionType: TransactionType;
  optionType: string;
  strikePrice: string;
  price: string;
  quantity: string;
}

// --- Parser Interface (Strategy Pattern) ---

export interface StatementParser {
  canParse(content: ArrayBuffer | string): boolean;
  parse(
    content: ArrayBuffer | string,
    portfolioId: string,
    planId: string,
  ): Promise<ParseResult>;
}

// --- Holdings Computation ---

export interface Holding {
  symbol: string;
  assetType: AssetType;
  optionType?: OptionType;
  strikePrice?: number;
  expirationDate?: Date;
  netQuantity: number;
  averageCostBasis: number;
  totalCostBasis: number;
  currentValue: number;
  unrealizedPL: number;
}

// --- Performance Summary ---

export interface PerformanceSummaryData {
  totalPortfolioValue: number;
  totalRealizedPL: number;
  totalUnrealizedPL: number;
  overallReturnPercentage: number;
  winRate: number;
  totalTransactions: number;
}

// --- Transaction Filters ---

export interface TransactionFilterState {
  symbol: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  transactionType: TransactionType | '';
  assetType: AssetType | '';
}
