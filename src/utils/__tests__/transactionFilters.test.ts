import { describe, it, expect } from 'vitest';
import { filterTransactions, sortTransactions } from '../transactionFilters';
import type { PortfolioTransaction, TransactionFilterState } from '../../types/transaction';

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
    price: 150.0,
    amount: 1500.0,
    fees: 1.0,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function emptyFilters(): TransactionFilterState {
  return {
    symbol: '',
    dateFrom: null,
    dateTo: null,
    transactionType: '',
    assetType: '',
  };
}

describe('filterTransactions', () => {
  const transactions: PortfolioTransaction[] = [
    makeTransaction({ id: '1', symbol: 'AAPL', transactionType: 'Buy', assetType: 'Stock', transactionDate: new Date(Date.UTC(2024, 0, 10)) }),
    makeTransaction({ id: '2', symbol: 'MSFT', transactionType: 'Sell', assetType: 'Stock', transactionDate: new Date(Date.UTC(2024, 1, 15)) }),
    makeTransaction({ id: '3', symbol: 'AAPL', transactionType: 'Sell', assetType: 'Option', transactionDate: new Date(Date.UTC(2024, 2, 20)) }),
    makeTransaction({ id: '4', symbol: 'TSLA', transactionType: 'Dividend', assetType: 'ETF', transactionDate: new Date(Date.UTC(2024, 3, 5)) }),
  ];

  it('returns all transactions when no filters are active', () => {
    const result = filterTransactions(transactions, emptyFilters());
    expect(result).toHaveLength(4);
  });

  it('filters by symbol case-insensitively (contains)', () => {
    const filters = { ...emptyFilters(), symbol: 'aapl' };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.symbol === 'AAPL')).toBe(true);
  });

  it('filters by symbol as substring match', () => {
    const filters = { ...emptyFilters(), symbol: 'MS' };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('MSFT');
  });

  it('filters by dateFrom (inclusive)', () => {
    const filters = { ...emptyFilters(), dateFrom: new Date(Date.UTC(2024, 1, 15)) };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(3);
    expect(result.every((t) => t.transactionDate.getTime() >= filters.dateFrom!.getTime())).toBe(true);
  });

  it('filters by dateTo (inclusive)', () => {
    const filters = { ...emptyFilters(), dateTo: new Date(Date.UTC(2024, 1, 15)) };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.transactionDate.getTime() <= filters.dateTo!.getTime())).toBe(true);
  });

  it('filters by date range (dateFrom and dateTo)', () => {
    const filters = {
      ...emptyFilters(),
      dateFrom: new Date(Date.UTC(2024, 1, 1)),
      dateTo: new Date(Date.UTC(2024, 2, 31)),
    };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual(['2', '3']);
  });

  it('filters by transactionType (exact match)', () => {
    const filters = { ...emptyFilters(), transactionType: 'Sell' as const };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.transactionType === 'Sell')).toBe(true);
  });

  it('filters by assetType (exact match)', () => {
    const filters = { ...emptyFilters(), assetType: 'Option' as const };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(1);
    expect(result[0].assetType).toBe('Option');
  });

  it('combines multiple filters with AND logic', () => {
    const filters = {
      ...emptyFilters(),
      symbol: 'AAPL',
      transactionType: 'Sell' as const,
    };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when no transactions match', () => {
    const filters = { ...emptyFilters(), symbol: 'XYZ' };
    const result = filterTransactions(transactions, filters);
    expect(result).toHaveLength(0);
  });

  it('handles empty transaction list', () => {
    const result = filterTransactions([], { ...emptyFilters(), symbol: 'AAPL' });
    expect(result).toHaveLength(0);
  });
});

describe('sortTransactions', () => {
  const transactions: PortfolioTransaction[] = [
    makeTransaction({ id: '1', symbol: 'MSFT', price: 300, transactionDate: new Date(Date.UTC(2024, 2, 15)) }),
    makeTransaction({ id: '2', symbol: 'AAPL', price: 150, transactionDate: new Date(Date.UTC(2024, 0, 10)) }),
    makeTransaction({ id: '3', symbol: 'TSLA', price: 250, transactionDate: new Date(Date.UTC(2024, 1, 20)) }),
  ];

  it('sorts by symbol ascending', () => {
    const result = sortTransactions(transactions, 'symbol', 'asc');
    expect(result.map((t) => t.symbol)).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  it('sorts by symbol descending', () => {
    const result = sortTransactions(transactions, 'symbol', 'desc');
    expect(result.map((t) => t.symbol)).toEqual(['TSLA', 'MSFT', 'AAPL']);
  });

  it('sorts by transactionDate ascending', () => {
    const result = sortTransactions(transactions, 'transactionDate', 'asc');
    expect(result.map((t) => t.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by transactionDate descending', () => {
    const result = sortTransactions(transactions, 'transactionDate', 'desc');
    expect(result.map((t) => t.id)).toEqual(['1', '3', '2']);
  });

  it('sorts by price ascending', () => {
    const result = sortTransactions(transactions, 'price', 'asc');
    expect(result.map((t) => t.price)).toEqual([150, 250, 300]);
  });

  it('sorts by price descending', () => {
    const result = sortTransactions(transactions, 'price', 'desc');
    expect(result.map((t) => t.price)).toEqual([300, 250, 150]);
  });

  it('handles null/undefined values by sorting them to the end (ascending)', () => {
    const txns = [
      makeTransaction({ id: '1', strikePrice: 170 }),
      makeTransaction({ id: '2', strikePrice: undefined }),
      makeTransaction({ id: '3', strikePrice: 150 }),
    ];
    const result = sortTransactions(txns, 'strikePrice', 'asc');
    expect(result.map((t) => t.id)).toEqual(['3', '1', '2']);
  });

  it('handles null/undefined values by sorting them to the end (descending)', () => {
    const txns = [
      makeTransaction({ id: '1', strikePrice: 170 }),
      makeTransaction({ id: '2', strikePrice: undefined }),
      makeTransaction({ id: '3', strikePrice: 150 }),
    ];
    const result = sortTransactions(txns, 'strikePrice', 'desc');
    expect(result.map((t) => t.id)).toEqual(['1', '3', '2']);
  });

  it('sorts by optionType (string column)', () => {
    const txns = [
      makeTransaction({ id: '1', optionType: 'Put' }),
      makeTransaction({ id: '2', optionType: 'Call' }),
      makeTransaction({ id: '3', optionType: undefined }),
    ];
    const result = sortTransactions(txns, 'optionType', 'asc');
    expect(result.map((t) => t.optionType)).toEqual(['Call', 'Put', undefined]);
  });

  it('does not mutate the original array', () => {
    const original = [...transactions];
    sortTransactions(transactions, 'price', 'asc');
    expect(transactions.map((t) => t.id)).toEqual(original.map((t) => t.id));
  });

  it('handles empty array', () => {
    const result = sortTransactions([], 'symbol', 'asc');
    expect(result).toEqual([]);
  });

  it('handles single element array', () => {
    const txns = [makeTransaction({ id: '1' })];
    const result = sortTransactions(txns, 'symbol', 'asc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});
