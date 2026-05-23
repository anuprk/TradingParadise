import { describe, it, expect } from 'vitest';
import {
  calculateDTE,
  calculateDITC,
  calculateBreakEvenPrice,
  calculateAnnualizedROR,
  calculateMarginAnnualizedROR,
  calculateProfitLoss,
  calculateWinLoss,
  calculateDaysHeld,
} from '../calculations';

describe('calculateDTE', () => {
  it('returns 0 for same-day open and expiration', () => {
    const date = new Date(2025, 0, 15);
    expect(calculateDTE(date, date)).toBe(0);
  });

  it('returns correct calendar days between dates', () => {
    const open = new Date(2025, 0, 1);
    const exp = new Date(2025, 1, 14); // 44 days later
    expect(calculateDTE(open, exp)).toBe(44);
  });

  it('returns negative when expiration is before open date', () => {
    const open = new Date(2025, 1, 14);
    const exp = new Date(2025, 0, 1);
    expect(calculateDTE(open, exp)).toBe(-44);
  });
});

describe('calculateDITC', () => {
  it('returns 0 when openDate is today', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(calculateDITC(today)).toBe(0);
  });
});

describe('calculateBreakEvenPrice', () => {
  it('calculates Put break-even as strike - premium', () => {
    expect(calculateBreakEvenPrice(100, 3, 'Put')).toBe(97);
  });

  it('calculates Call break-even as strike + premium', () => {
    expect(calculateBreakEvenPrice(100, 3, 'Call')).toBe(103);
  });

  it('handles decimal values', () => {
    expect(calculateBreakEvenPrice(250.5, 4.75, 'Put')).toBeCloseTo(245.75);
    expect(calculateBreakEvenPrice(250.5, 4.75, 'Call')).toBeCloseTo(255.25);
  });
});

describe('calculateAnnualizedROR', () => {
  it('returns 0 when cashReserve is 0', () => {
    expect(calculateAnnualizedROR(100, 0, 30)).toBe(0);
  });

  it('returns 0 when daysHeld is 0', () => {
    expect(calculateAnnualizedROR(100, 5000, 0)).toBe(0);
  });

  it('calculates correctly with valid inputs', () => {
    // (150 / 5000) * (365 / 45) * 100 = 24.333...
    const result = calculateAnnualizedROR(150, 5000, 45);
    expect(result).toBeCloseTo(24.3333, 2);
  });
});

describe('calculateMarginAnnualizedROR', () => {
  it('returns 0 when marginCashReserve is 0', () => {
    expect(calculateMarginAnnualizedROR(100, 0, 30)).toBe(0);
  });

  it('returns 0 when daysHeld is 0', () => {
    expect(calculateMarginAnnualizedROR(100, 2500, 0)).toBe(0);
  });

  it('calculates correctly with valid inputs', () => {
    // (150 / 2500) * (365 / 45) * 100 = 48.666...
    const result = calculateMarginAnnualizedROR(150, 2500, 45);
    expect(result).toBeCloseTo(48.6667, 2);
  });
});

describe('calculateProfitLoss', () => {
  it('calculates Sell P/L as entryPremium - exitPrice - fees', () => {
    // 3.00 - 1.00 - 0.50 = 1.50
    expect(calculateProfitLoss(3, 1, 'Sell', 0.5)).toBeCloseTo(1.5);
  });

  it('calculates Buy P/L as exitPrice - entryPremium - fees', () => {
    // 5.00 - 3.00 - 0.50 = 1.50
    expect(calculateProfitLoss(3, 5, 'Buy', 0.5)).toBeCloseTo(1.5);
  });

  it('returns negative for a losing Sell trade', () => {
    // 2.00 - 4.00 - 0.50 = -2.50
    expect(calculateProfitLoss(2, 4, 'Sell', 0.5)).toBeCloseTo(-2.5);
  });

  it('returns negative for a losing Buy trade', () => {
    // 1.00 - 3.00 - 0.50 = -2.50
    expect(calculateProfitLoss(3, 1, 'Buy', 0.5)).toBeCloseTo(-2.5);
  });

  it('handles zero fees', () => {
    expect(calculateProfitLoss(5, 2, 'Sell', 0)).toBe(3);
  });
});

describe('calculateWinLoss', () => {
  it('returns Win for positive P/L', () => {
    expect(calculateWinLoss(100)).toBe('Win');
    expect(calculateWinLoss(0.01)).toBe('Win');
  });

  it('returns Loss for zero P/L', () => {
    expect(calculateWinLoss(0)).toBe('Loss');
  });

  it('returns Loss for negative P/L', () => {
    expect(calculateWinLoss(-50)).toBe('Loss');
  });
});

describe('calculateDaysHeld', () => {
  it('returns 0 for same-day open and close', () => {
    const date = new Date(2025, 0, 15);
    expect(calculateDaysHeld(date, date)).toBe(0);
  });

  it('returns correct calendar days held', () => {
    const open = new Date(2025, 0, 1);
    const close = new Date(2025, 0, 31);
    expect(calculateDaysHeld(open, close)).toBe(30);
  });
});
