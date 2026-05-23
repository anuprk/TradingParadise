import { describe, it, expect } from 'vitest';
import { computePerformanceSummary } from '../metrics';
import type { PortfolioTransaction } from '../../types/transaction';

function makeTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: 'txn-1',
    portfolioId: 'port-1',
    planId: 'plan-1',
    transactionDate: new Date(Date.UTC(2024, 2, 15)),
    symbol: 'AAPL',
    description: 'Buy AAPL',
    transactionType: 'Buy',
    assetType: 'Stock',
    quantity: 10,
    price: 150,
    amount: 1500,
    fees: 0,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('computePerformanceSummary', () => {
  describe('edge cases', () => {
    it('returns all zeros with initialBalance when no transactions', () => {
      const result = computePerformanceSummary([], 10000);
      expect(result).toEqual({
        totalPortfolioValue: 10000,
        totalRealizedPL: 0,
        totalUnrealizedPL: 0,
        overallReturnPercentage: 0,
        winRate: 0,
        totalTransactions: 0,
      });
    });

    it('returns 0% overallReturnPercentage when initial balance is zero', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100 }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 10, price: 120, transactionDate: new Date(Date.UTC(2024, 3, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 0);
      expect(result.overallReturnPercentage).toBe(0);
    });

    it('returns 0% winRate when no closed positions exist', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100 }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      expect(result.winRate).toBe(0);
    });
  });

  describe('realized P/L computation', () => {
    it('computes realized P/L from a simple buy/sell pair', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 10, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Realized P/L = (10 * 120) - (10 * 100) = 1200 - 1000 = 200
      expect(result.totalRealizedPL).toBe(200);
    });

    it('computes realized P/L for partial sells', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 5, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Realized P/L = (5 * 120) - (5 * 100) = 600 - 500 = 100
      expect(result.totalRealizedPL).toBe(100);
    });

    it('computes negative realized P/L for losing trades', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 10, price: 80, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Realized P/L = (10 * 80) - (10 * 100) = 800 - 1000 = -200
      expect(result.totalRealizedPL).toBe(-200);
    });

    it('groups transactions by composite key (symbol, assetType, optionType, strikePrice, expirationDate)', () => {
      const transactions = [
        makeTransaction({ id: 'b1', symbol: 'AAPL', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', symbol: 'AAPL', transactionType: 'Sell', quantity: 10, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
        makeTransaction({ id: 'b2', symbol: 'MSFT', transactionType: 'Buy', quantity: 5, price: 200, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's2', symbol: 'MSFT', transactionType: 'Sell', quantity: 5, price: 210, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // AAPL: (10*120) - (10*100) = 200
      // MSFT: (5*210) - (5*200) = 50
      expect(result.totalRealizedPL).toBe(250);
    });
  });

  describe('unrealized P/L computation', () => {
    it('computes unrealized P/L for open positions', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Open position: 10 shares at avg cost 100, current price 100 (latest transaction price)
      // Unrealized P/L = (10 * 100) - (10 * 100) = 0
      expect(result.totalUnrealizedPL).toBe(0);
    });

    it('computes unrealized P/L when latest price differs from cost basis', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 'b2', transactionType: 'Buy', quantity: 5, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Net quantity: 15, total cost: 10*100 + 5*120 = 1600, avg cost: 1600/15 ≈ 106.67
      // Latest price: 120 (most recent buy), current value: 15 * 120 = 1800
      // Unrealized P/L = 1800 - 1600 = 200
      expect(result.totalUnrealizedPL).toBeCloseTo(200, 2);
    });
  });

  describe('total portfolio value', () => {
    it('computes totalPortfolioValue = initialBalance + realizedPL + unrealizedPL + dividends - fees', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, fees: 5, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 10, price: 120, fees: 5, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
        makeTransaction({ id: 'd1', transactionType: 'Dividend', quantity: 0, price: 0, amount: 50, fees: 0, transactionDate: new Date(Date.UTC(2024, 2, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Realized P/L = (10*120) - (10*100) = 200
      // Unrealized P/L = 0 (no open positions, net qty = 0)
      // Dividends = 50
      // Fees = 5 + 5 + 0 = 10
      // Total = 10000 + 200 + 0 + 50 - 10 = 10240
      expect(result.totalPortfolioValue).toBe(10240);
    });
  });

  describe('overall return percentage', () => {
    it('computes correct return percentage', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy', quantity: 10, price: 100, fees: 0, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', transactionType: 'Sell', quantity: 10, price: 120, fees: 0, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // Total value = 10000 + 200 + 0 + 0 - 0 = 10200
      // Return % = (10200 - 10000) / 10000 * 100 = 2%
      expect(result.overallReturnPercentage).toBe(2);
    });
  });

  describe('win rate', () => {
    it('computes win rate from closed positions', () => {
      const transactions = [
        // Winning trade: AAPL
        makeTransaction({ id: 'b1', symbol: 'AAPL', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', symbol: 'AAPL', transactionType: 'Sell', quantity: 10, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
        // Losing trade: MSFT
        makeTransaction({ id: 'b2', symbol: 'MSFT', transactionType: 'Buy', quantity: 5, price: 200, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's2', symbol: 'MSFT', transactionType: 'Sell', quantity: 5, price: 180, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      // 1 winning out of 2 closed positions = 50%
      expect(result.winRate).toBe(50);
    });

    it('returns 100% win rate when all closed positions are profitable', () => {
      const transactions = [
        makeTransaction({ id: 'b1', symbol: 'AAPL', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
        makeTransaction({ id: 's1', symbol: 'AAPL', transactionType: 'Sell', quantity: 10, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      expect(result.winRate).toBe(100);
    });
  });

  describe('totalTransactions', () => {
    it('counts all transactions including non-trade types', () => {
      const transactions = [
        makeTransaction({ id: 'b1', transactionType: 'Buy' }),
        makeTransaction({ id: 's1', transactionType: 'Sell' }),
        makeTransaction({ id: 'd1', transactionType: 'Dividend', quantity: 0, price: 0, amount: 50 }),
        makeTransaction({ id: 'f1', transactionType: 'Fee', quantity: 0, price: 0, amount: -5 }),
      ];
      const result = computePerformanceSummary(transactions, 10000);
      expect(result.totalTransactions).toBe(4);
    });
  });
});
