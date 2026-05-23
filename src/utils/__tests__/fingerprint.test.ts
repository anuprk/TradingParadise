import { describe, it, expect } from 'vitest';
import { computeFingerprint } from '../fingerprint';
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

describe('computeFingerprint', () => {
  it('produces the expected format for an options transaction', () => {
    const txn = makeTransaction();
    const fp = computeFingerprint(txn);
    expect(fp).toBe('2024-03-15|AAPL|Sell|Put|170.00|3.25|1.0000');
  });

  it('normalizes symbol to uppercase and trimmed', () => {
    const txn = makeTransaction({ symbol: '  aapl  ' });
    const fp = computeFingerprint(txn);
    expect(fp).toContain('|AAPL|');
  });

  it('defaults optionType to None when undefined', () => {
    const txn = makeTransaction({ optionType: undefined });
    const fp = computeFingerprint(txn);
    expect(fp).toContain('|None|');
  });

  it('defaults strikePrice to 0.00 when undefined', () => {
    const txn = makeTransaction({ strikePrice: undefined, optionType: undefined });
    const fp = computeFingerprint(txn);
    expect(fp).toContain('|0.00|');
  });

  it('formats price to 2 decimal places', () => {
    const txn = makeTransaction({ price: 3.1 });
    const fp = computeFingerprint(txn);
    expect(fp).toContain('|3.10|');
  });

  it('formats quantity to 4 decimal places', () => {
    const txn = makeTransaction({ quantity: 0.5 });
    const fp = computeFingerprint(txn);
    expect(fp.endsWith('0.5000')).toBe(true);
  });

  it('formats date as YYYY-MM-DD using UTC', () => {
    const txn = makeTransaction({ transactionDate: new Date(Date.UTC(2023, 0, 5)) });
    const fp = computeFingerprint(txn);
    expect(fp).toMatch(/^2023-01-05\|/);
  });

  it('is deterministic (same input produces same output)', () => {
    const txn = makeTransaction();
    expect(computeFingerprint(txn)).toBe(computeFingerprint(txn));
  });

  it('produces different fingerprints for different symbols', () => {
    const txn1 = makeTransaction({ symbol: 'AAPL' });
    const txn2 = makeTransaction({ symbol: 'MSFT' });
    expect(computeFingerprint(txn1)).not.toBe(computeFingerprint(txn2));
  });

  it('produces different fingerprints for different transaction types', () => {
    const txn1 = makeTransaction({ transactionType: 'Buy' });
    const txn2 = makeTransaction({ transactionType: 'Sell' });
    expect(computeFingerprint(txn1)).not.toBe(computeFingerprint(txn2));
  });

  it('treats strikePrice values equal at 2dp as producing the same fingerprint', () => {
    const txn1 = makeTransaction({ strikePrice: 170.001 });
    const txn2 = makeTransaction({ strikePrice: 170.004 });
    expect(computeFingerprint(txn1)).toBe(computeFingerprint(txn2));
  });

  it('handles stock transactions without option fields', () => {
    const txn = makeTransaction({
      assetType: 'Stock',
      optionType: undefined,
      strikePrice: undefined,
      transactionType: 'Buy',
      symbol: 'TSLA',
      price: 250.5,
      quantity: 10,
    });
    const fp = computeFingerprint(txn);
    expect(fp).toBe('2024-03-15|TSLA|Buy|None|0.00|250.50|10.0000');
  });
});
