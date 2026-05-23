/**
 * Unit tests for Trade Journal Entry Zod validation schema.
 */

import { describe, it, expect } from 'vitest';
import { tradeJournalEntrySchema } from '../journalSchema';

function makeValidEntry(overrides = {}) {
  return {
    id: 'j1',
    stockSymbol: 'AAPL',
    openDate: new Date('2025-01-15'),
    expirationDate: new Date('2025-02-15'),
    optionType: 'Put' as const,
    direction: 'Sell' as const,
    stockPriceDOC: 150,
    dte: 31,
    ditc: 5,
    breakEvenPrice: 145,
    strikePrice: 150,
    premium: 5,
    cashReserve: 15000,
    fees: 1.5,
    winLoss: null,
    tradeStatus: 'Open' as const,
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan-1',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('tradeJournalEntrySchema', () => {
  it('accepts a valid open trade entry', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry());
    expect(result.success).toBe(true);
  });

  it('accepts a valid closed trade entry', () => {
    const result = tradeJournalEntrySchema.safeParse(
      makeValidEntry({
        exitPrice: 2,
        closeDate: new Date('2025-02-10'),
        profitLoss: 300,
        winLoss: 'Win',
        daysHeld: 26,
        annualizedROR: 28.1,
        tradeStatus: 'Closed',
      })
    );
    expect(result.success).toBe(true);
  });

  it('rejects entry with empty stock symbol', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ stockSymbol: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects entry with negative premium', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ premium: -5 }));
    expect(result.success).toBe(false);
  });

  it('rejects entry with missing portfolioId', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ portfolioId: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects entry with missing strategyId', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ strategyId: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects entry with invalid option type', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ optionType: 'Straddle' }));
    expect(result.success).toBe(false);
  });

  it('rejects entry with invalid trade status', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ tradeStatus: 'Pending' }));
    expect(result.success).toBe(false);
  });

  it('uppercases stock symbol', () => {
    const result = tradeJournalEntrySchema.safeParse(makeValidEntry({ stockSymbol: 'aapl' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stockSymbol).toBe('AAPL');
    }
  });
});
