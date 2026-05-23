/**
 * Date helper utilities for the TradingParadise application.
 * Uses date-fns for calendar day calculations.
 */

import { differenceInCalendarDays, startOfDay } from 'date-fns';

/**
 * Returns the number of calendar days between two dates.
 * Result is always non-negative (uses absolute difference).
 */
export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.abs(differenceInCalendarDays(end, start));
}

/**
 * Returns the number of calendar days from a given date to today.
 */
export function calendarDaysFromToday(date: Date): number {
  return differenceInCalendarDays(startOfDay(new Date()), startOfDay(date));
}

/**
 * Normalizes a date to the start of the day (midnight).
 */
export function toStartOfDay(date: Date): Date {
  return startOfDay(date);
}
