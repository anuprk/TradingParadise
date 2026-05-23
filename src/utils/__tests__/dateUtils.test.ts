import { describe, it, expect } from 'vitest';
import { calendarDaysBetween, calendarDaysFromToday, toStartOfDay } from '../dateUtils';

describe('calendarDaysBetween', () => {
  it('returns 0 for the same date', () => {
    const date = new Date(2025, 5, 15);
    expect(calendarDaysBetween(date, date)).toBe(0);
  });

  it('returns positive value regardless of order', () => {
    const a = new Date(2025, 0, 1);
    const b = new Date(2025, 0, 10);
    expect(calendarDaysBetween(a, b)).toBe(9);
    expect(calendarDaysBetween(b, a)).toBe(9);
  });
});

describe('calendarDaysFromToday', () => {
  it('returns 0 for today', () => {
    const today = new Date();
    expect(calendarDaysFromToday(today)).toBe(0);
  });
});

describe('toStartOfDay', () => {
  it('sets time to midnight', () => {
    const date = new Date(2025, 5, 15, 14, 30, 45);
    const result = toStartOfDay(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('preserves the date', () => {
    const date = new Date(2025, 5, 15, 14, 30, 45);
    const result = toStartOfDay(date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });
});
