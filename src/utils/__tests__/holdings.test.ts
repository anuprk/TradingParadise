import { describe, it, expect } from 'vitest';
import { computeHoldings } from '../holdings';
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
    fees: 1,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('computeHoldings', () => {
  it('returns empty array for empty transactions', () => {
    expect(computeHoldings([])).toEqual([]);
  });

  it('returns empty array when no Buy/Sell transactions exist', () => {
    const transactions = [
      makeTransaction({ transactionType: 'Dividend' }),
      makeTransaction({ transactionType: 'Fee' }),
      makeTransaction({ transactionType: 'Transfer' }),
    ];
    expect(computeHoldings(transactions)).toEqual([]);
  });

  it('computes a single holding from one Buy transaction', () => {
    const transactions = [makeTransaction({ quantity: 10, price: 150 })];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe('AAPL');
    expect(holdings[0].assetType).toBe('Stock');
    expect(holdings[0].netQuantity).toBe(10);
    expect(holdings[0].averageCostBasis).toBe(150);
    expect(holdings[0].totalCostBasis).toBe(1500);
    expect(holdings[0].currentValue).toBe(1500);
    expect(holdings[0].unrealizedPL).toBe(0);
  });

  it('computes weighted average cost basis from multiple buys', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
      makeTransaction({ id: 'txn-2', quantity: 20, price: 130, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].netQuantity).toBe(30);
    // Weighted average: (10*100 + 20*130) / 30 = 3600/30 = 120
    expect(holdings[0].averageCostBasis).toBeCloseTo(120, 2);
    expect(holdings[0].totalCostBasis).toBeCloseTo(3600, 2);
  });

  it('subtracts sell quantities from net quantity', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', transactionType: 'Buy', quantity: 20, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
      makeTransaction({ id: 'txn-2', transactionType: 'Sell', quantity: 5, price: 120, transactionDate: new Date(Date.UTC(2024, 1, 1)) }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].netQuantity).toBe(15);
    // Average cost basis is from buys only: 100
    expect(holdings[0].averageCostBasis).toBe(100);
    expect(holdings[0].totalCostBasis).toBe(1500);
    // Current value uses latest price (120 from the sell)
    expect(holdings[0].currentValue).toBe(1800);
    expect(holdings[0].unrealizedPL).toBe(300);
  });

  it('excludes groups with netQuantity === 0', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', transactionType: 'Buy', quantity: 10, price: 100 }),
      makeTransaction({ id: 'txn-2', transactionType: 'Sell', quantity: 10, price: 120 }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(0);
  });

  it('groups by symbol separately', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', symbol: 'AAPL', quantity: 10, price: 150 }),
      makeTransaction({ id: 'txn-2', symbol: 'MSFT', quantity: 5, price: 300 }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(2);
    expect(holdings[0].symbol).toBe('AAPL');
    expect(holdings[1].symbol).toBe('MSFT');
  });

  it('sorts holdings by symbol ascending', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', symbol: 'TSLA', quantity: 5, price: 200 }),
      makeTransaction({ id: 'txn-2', symbol: 'AAPL', quantity: 10, price: 150 }),
      makeTransaction({ id: 'txn-3', symbol: 'MSFT', quantity: 8, price: 300 }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings.map((h) => h.symbol)).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  it('groups options by composite key including optionType, strikePrice, expirationDate', () => {
    const exp1 = new Date(Date.UTC(2024, 5, 21));
    const exp2 = new Date(Date.UTC(2024, 8, 20));
    const transactions = [
      makeTransaction({
        id: 'txn-1',
        symbol: 'AAPL',
        assetType: 'Option',
        optionType: 'Call',
        strikePrice: 170,
        expirationDate: exp1,
        quantity: 2,
        price: 5,
      }),
      makeTransaction({
        id: 'txn-2',
        symbol: 'AAPL',
        assetType: 'Option',
        optionType: 'Put',
        strikePrice: 170,
        expirationDate: exp1,
        quantity: 3,
        price: 4,
      }),
      makeTransaction({
        id: 'txn-3',
        symbol: 'AAPL',
        assetType: 'Option',
        optionType: 'Call',
        strikePrice: 180,
        expirationDate: exp2,
        quantity: 1,
        price: 3,
      }),
    ];
    const holdings = computeHoldings(transactions);

    // Three separate groups: Call@170/exp1, Put@170/exp1, Call@180/exp2
    expect(holdings).toHaveLength(3);
  });

  it('uses latest transaction price for currentValue', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', transactionType: 'Buy', quantity: 10, price: 100, transactionDate: new Date(Date.UTC(2024, 0, 1)) }),
      makeTransaction({ id: 'txn-2', transactionType: 'Buy', quantity: 5, price: 120, transactionDate: new Date(Date.UTC(2024, 2, 1)) }),
    ];
    const holdings = computeHoldings(transactions);

    // Latest price is 120 (from March transaction)
    expect(holdings[0].currentValue).toBe(15 * 120);
  });

  it('normalizes symbol case for grouping', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', symbol: 'aapl', quantity: 5, price: 150 }),
      makeTransaction({ id: 'txn-2', symbol: 'AAPL', quantity: 5, price: 155 }),
    ];
    const holdings = computeHoldings(transactions);

    // Should be grouped together
    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe('AAPL');
    expect(holdings[0].netQuantity).toBe(10);
  });

  it('handles transactions with undefined option fields consistently', () => {
    const transactions = [
      makeTransaction({ id: 'txn-1', symbol: 'AAPL', assetType: 'Stock', optionType: undefined, strikePrice: undefined, expirationDate: undefined, quantity: 10, price: 150 }),
      makeTransaction({ id: 'txn-2', symbol: 'AAPL', assetType: 'Stock', optionType: undefined, strikePrice: undefined, expirationDate: undefined, quantity: 5, price: 160 }),
    ];
    const holdings = computeHoldings(transactions);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].netQuantity).toBe(15);
  });
});
