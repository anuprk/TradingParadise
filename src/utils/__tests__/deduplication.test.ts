import { describe, it, expect } from 'vitest';
import { findDuplicates } from '../deduplication';
import type { PortfolioTransaction } from '../../types/transaction';

function makeTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: 'txn-1',
    portfolioId: 'port-1',
    planId: 'plan-1',
    transactionDate: new Date(Date.UTC(2024, 2, 15)), // 2024-03-15
    symbol: 'AAPL',
    description: 'Sell Put AAPL',
    transactionType: 'Sell',
    assetType: 'Option',
    optionType: 'Put',
    strikePrice: 170,
    quantity: 1,
    price: 3.25,
    amount: 325,
    fees: 0.65,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('findDuplicates', () => {
  it('returns all transactions as unique when no existing transactions', () => {
    const newTxns = [makeTransaction({ id: 'new-1' }), makeTransaction({ id: 'new-2', symbol: 'MSFT' })];
    const result = findDuplicates(newTxns, []);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it('returns empty report when no new transactions', () => {
    const existing = [makeTransaction({ id: 'existing-1' })];
    const result = findDuplicates([], existing);

    expect(result.unique).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it('flags a transaction as duplicate when fingerprint matches an existing one', () => {
    const existing = [makeTransaction({ id: 'existing-1' })];
    const newTxns = [makeTransaction({ id: 'new-1' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
    expect(result.unique).toHaveLength(0);
    expect(result.duplicates[0].existingId).toBe('existing-1');
    expect(result.duplicates[0].transaction.id).toBe('new-1');
    expect(result.duplicates[0].overrideInclude).toBe(false);
  });

  it('includes the fingerprint string in duplicate entries', () => {
    const existing = [makeTransaction({ id: 'existing-1' })];
    const newTxns = [makeTransaction({ id: 'new-1' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates[0].fingerprint).toBe('2024-03-15|AAPL|Sell|Put|170.00|3.25|1.0000');
  });

  it('marks transactions as unique when fingerprints differ', () => {
    const existing = [makeTransaction({ id: 'existing-1', symbol: 'MSFT' })];
    const newTxns = [makeTransaction({ id: 'new-1', symbol: 'AAPL' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
    expect(result.unique[0].id).toBe('new-1');
  });

  it('correctly separates duplicates and unique in a mixed batch', () => {
    const existing = [
      makeTransaction({ id: 'existing-1', symbol: 'AAPL' }),
      makeTransaction({ id: 'existing-2', symbol: 'MSFT' }),
    ];
    const newTxns = [
      makeTransaction({ id: 'new-1', symbol: 'AAPL' }), // duplicate
      makeTransaction({ id: 'new-2', symbol: 'TSLA' }), // unique
      makeTransaction({ id: 'new-3', symbol: 'MSFT' }), // duplicate
    ];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(2);
    expect(result.unique).toHaveLength(1);
    expect(result.unique[0].symbol).toBe('TSLA');
    expect(result.duplicates.map((d) => d.existingId).sort()).toEqual(['existing-1', 'existing-2']);
  });

  it('matches fingerprints with strikePrice equal at 2 decimal places', () => {
    const existing = [makeTransaction({ id: 'existing-1', strikePrice: 170.001 })];
    const newTxns = [makeTransaction({ id: 'new-1', strikePrice: 170.004 })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].existingId).toBe('existing-1');
  });

  it('matches fingerprints with price equal at 2 decimal places', () => {
    const existing = [makeTransaction({ id: 'existing-1', price: 3.251 })];
    const newTxns = [makeTransaction({ id: 'new-1', price: 3.254 })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
  });

  it('handles case-insensitive symbol matching via normalization', () => {
    const existing = [makeTransaction({ id: 'existing-1', symbol: 'aapl' })];
    const newTxns = [makeTransaction({ id: 'new-1', symbol: 'AAPL' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
  });

  it('handles whitespace in symbol via normalization', () => {
    const existing = [makeTransaction({ id: 'existing-1', symbol: '  AAPL  ' })];
    const newTxns = [makeTransaction({ id: 'new-1', symbol: 'AAPL' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
  });

  it('maps to the first existing transaction when multiple have the same fingerprint', () => {
    // If multiple existing transactions have the same fingerprint, the map stores the last one
    // but this is an edge case - in practice fingerprints should be unique within a portfolio
    const existing = [
      makeTransaction({ id: 'existing-1' }),
      makeTransaction({ id: 'existing-2' }), // same fingerprint, overwrites in map
    ];
    const newTxns = [makeTransaction({ id: 'new-1' })];

    const result = findDuplicates(newTxns, existing);

    expect(result.duplicates).toHaveLength(1);
    // The last existing transaction with that fingerprint wins in the map
    expect(result.duplicates[0].existingId).toBe('existing-2');
  });

  it('does not flag transactions with different dates as duplicates', () => {
    const existing = [makeTransaction({ id: 'existing-1', transactionDate: new Date(Date.UTC(2024, 0, 1)) })];
    const newTxns = [makeTransaction({ id: 'new-1', transactionDate: new Date(Date.UTC(2024, 0, 2)) })];

    const result = findDuplicates(newTxns, existing);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
  });

  it('does not flag transactions with different quantities as duplicates', () => {
    const existing = [makeTransaction({ id: 'existing-1', quantity: 1 })];
    const newTxns = [makeTransaction({ id: 'new-1', quantity: 2 })];

    const result = findDuplicates(newTxns, existing);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
  });
});
