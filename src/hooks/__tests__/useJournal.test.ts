import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock Supabase client to avoid env var requirement
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.update = vi.fn(() => chain);
      chain.delete = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.range = vi.fn(() => chain);
      chain.ilike = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.lte = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
      chain.then = (resolve: any) => resolve({ data: [], error: null, count: 0 });
      return chain;
    }),
  },
}));

import { useJournal } from '../useJournal';

describe('useJournal', () => {
  describe('autoCalculate', () => {
    it('calculates DTE from openDate and expirationDate', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2025-01-01'),
        expirationDate: new Date('2025-02-14'),
      });
      expect(computed.dte).toBe(44);
    });

    it('calculates DITC for open trades', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2020-01-01'),
        tradeStatus: 'Open',
      });
      expect(computed.ditc).toBeGreaterThan(0);
    });

    it('does not calculate DITC for closed trades', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2025-01-01'),
        tradeStatus: 'Closed',
      });
      expect(computed.ditc).toBeUndefined();
    });

    it('calculates break-even price for Put', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        strikePrice: 100,
        premium: 5,
        optionType: 'Put',
      });
      expect(computed.breakEvenPrice).toBe(95);
    });

    it('calculates break-even price for Call', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        strikePrice: 100,
        premium: 5,
        optionType: 'Call',
      });
      expect(computed.breakEvenPrice).toBe(105);
    });

    it('calculates P/L and Win/Loss for a winning Sell trade', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        premium: 10,
        exitPrice: 3,
        direction: 'Sell',
        fees: 1,
      });
      // gross = 10 - 3 = 7, net = 7 - 1 = 6
      expect(computed.profitLoss).toBe(6);
      expect(computed.winLoss).toBe('Win');
    });

    it('calculates P/L and Win/Loss for a losing Buy trade', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        premium: 5,
        exitPrice: 3,
        direction: 'Buy',
        fees: 1,
      });
      // gross = 3 - 5 = -2, net = -2 - 1 = -3
      expect(computed.profitLoss).toBe(-3);
      expect(computed.winLoss).toBe('Loss');
    });

    it('calculates daysHeld for closed trades', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2025-01-01'),
        closeDate: new Date('2025-01-31'),
      });
      expect(computed.daysHeld).toBe(30);
    });

    it('calculates annualizedROR', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2025-01-01'),
        closeDate: new Date('2025-01-31'),
        premium: 100,
        cashReserve: 5000,
        direction: 'Sell',
        exitPrice: 0,
        fees: 0,
      });
      // daysHeld = 30, ROR = (100/5000) * (365/30) * 100 = 24.333...
      expect(computed.annualizedROR).toBeCloseTo(24.333, 1);
    });

    it('calculates marginAnnualizedROR', () => {
      const { result } = renderHook(() => useJournal());
      const computed = result.current.autoCalculate({
        openDate: new Date('2025-01-01'),
        closeDate: new Date('2025-01-31'),
        premium: 100,
        cashReserve: 5000,
        marginCashReserve: 2500,
        direction: 'Sell',
        exitPrice: 0,
        fees: 0,
      });
      // daysHeld = 30, marginROR = (100/2500) * (365/30) * 100 = 48.666...
      expect(computed.marginAnnualizedROR).toBeCloseTo(48.667, 1);
    });
  });
});
