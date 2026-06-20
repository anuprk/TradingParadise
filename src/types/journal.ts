/**
 * TypeScript type definitions for Trade Journal data models.
 * Matches the design document data model specification exactly.
 */

export type InstrumentType = 'Option' | 'Stock';
export type OptionType = 'Call' | 'Put';
export type TradeDirection = 'Buy' | 'Sell';
export type TradeStatus = 'Open' | 'Closed' | 'Expired' | 'Assigned';
export type WinLoss = 'Win' | 'Loss' | null;

export interface TradeJournalEntry {
  id: string;
  instrumentType: InstrumentType;        // 'Option' or 'Stock'
  stockSymbol: string;
  campaign: string;                    // Free-text campaign/group label
  openDate: Date;
  expirationDate: Date;
  optionType: OptionType;
  direction: TradeDirection;
  stockPriceDOC: number;
  dte: number;                         // Auto-calculated
  ditc: number;                        // Auto-calculated for open trades
  currentStockPrice?: number;
  breakEvenPrice: number;              // Auto-calculated
  strikePrice: number;
  premium: number;
  contracts: number;                   // Number of contracts
  quantity: number;                    // Number of shares (for stocks)
  cashReserve: number;
  marginCashReserve?: number;
  fees: number;
  exitPrice?: number;
  closeDate?: Date;
  profitLoss?: number;                 // Auto-calculated on close
  winLoss: WinLoss;                    // Auto-calculated on close
  daysHeld?: number;                   // Auto-calculated on close
  annualizedROR?: number;              // Auto-calculated
  marginAnnualizedROR?: number;        // Auto-calculated
  tradeStatus: TradeStatus;
  portfolioId?: string;                // Linked Portfolio (optional)
  strategyId: string;                  // Linked Strategy
  planId: string;                      // Linked Trading Plan
  unrealizedPL?: number;              // Auto-calculated for open trades
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
