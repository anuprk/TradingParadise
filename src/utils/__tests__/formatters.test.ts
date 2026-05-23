import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage, formatNumber, formatProfitLoss } from '../formatters';

describe('formatCurrency', () => {
  it('formats positive values', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-500.1)).toBe('-$500.10');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(99.999)).toBe('$100.00');
  });
});

describe('formatPercentage', () => {
  it('formats with default 2 decimals', () => {
    expect(formatPercentage(12.3456)).toBe('12.35%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercentage(12.3, 0)).toBe('12%');
    expect(formatPercentage(12.3, 1)).toBe('12.3%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });
});

describe('formatNumber', () => {
  it('formats with commas and default 2 decimals', () => {
    expect(formatNumber(1234567.89)).toBe('1,234,567.89');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234.5, 0)).toBe('1,235');
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
  });
});

describe('formatProfitLoss', () => {
  it('formats positive P/L with + prefix', () => {
    expect(formatProfitLoss(500)).toBe('+$500.00');
  });

  it('formats zero P/L with + prefix', () => {
    expect(formatProfitLoss(0)).toBe('+$0.00');
  });

  it('formats negative P/L with - prefix', () => {
    expect(formatProfitLoss(-200.5)).toBe('-$200.50');
  });
});
