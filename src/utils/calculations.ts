/**
 * Trade calculation utilities for the TradingParadise application.
 *
 * Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */

import { differenceInCalendarDays } from 'date-fns';
import type { OptionType, TradeDirection, WinLoss } from '../types/journal';

/**
 * Calculates Days to Expiration (DTE) — calendar days between openDate and expirationDate.
 * Requirement 13.4
 */
export function calculateDTE(openDate: Date, expirationDate: Date): number {
  return differenceInCalendarDays(expirationDate, openDate);
}

/**
 * Calculates Days in the Contract (DITC) — calendar days from openDate to current date.
 * Requirement 13.5
 */
export function calculateDITC(openDate: Date): number {
  return differenceInCalendarDays(new Date(), openDate);
}

/**
 * Calculates the break-even price for an option.
 * Put: strike - premium
 * Call: strike + premium
 * Requirement 13.6
 */
export function calculateBreakEvenPrice(
  strikePrice: number,
  premium: number,
  optionType: OptionType,
): number {
  return optionType === 'Put'
    ? strikePrice - premium
    : strikePrice + premium;
}

/**
 * Calculates the annualized rate of return based on cash reserve.
 * Formula: (premium / cashReserve) * (365 / daysHeld) * 100
 * Returns 0 when cashReserve or daysHeld is 0 to avoid division by zero.
 * Requirement 13.7
 */
export function calculateAnnualizedROR(
  premium: number,
  cashReserve: number,
  daysHeld: number,
): number {
  if (cashReserve === 0 || daysHeld === 0) return 0;
  return (premium / cashReserve) * (365 / daysHeld) * 100;
}

/**
 * Calculates the annualized rate of return based on margin cash reserve.
 * Formula: (premium / marginCashReserve) * (365 / daysHeld) * 100
 * Returns 0 when marginCashReserve or daysHeld is 0 to avoid division by zero.
 * Requirement 13.8
 */
export function calculateMarginAnnualizedROR(
  premium: number,
  marginCashReserve: number,
  daysHeld: number,
): number {
  if (marginCashReserve === 0 || daysHeld === 0) return 0;
  return (premium / marginCashReserve) * (365 / daysHeld) * 100;
}

/**
 * Calculates profit/loss for a closed option trade.
 * Sell direction: entryPremium - exitPrice - fees
 * Buy direction: exitPrice - entryPremium - fees
 * Requirement 13.10
 */
export function calculateProfitLoss(
  entryPremium: number,
  exitPrice: number,
  direction: TradeDirection,
  fees: number,
): number {
  const gross =
    direction === 'Sell'
      ? entryPremium - exitPrice
      : exitPrice - entryPremium;
  return gross - fees;
}

/**
 * Calculates profit/loss for a closed stock trade.
 * Buy: (exitPrice - entryPrice) * quantity - fees
 * Sell (short): (entryPrice - exitPrice) * quantity - fees
 */
export function calculateStockProfitLoss(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  direction: TradeDirection,
  fees: number,
): number {
  const gross =
    direction === 'Buy'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
  return gross - fees;
}

/**
 * Calculates unrealized P/L for an open stock position.
 * Buy: (currentPrice - entryPrice) * quantity
 * Sell (short): (entryPrice - currentPrice) * quantity
 */
export function calculateStockUnrealizedPL(
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  direction: TradeDirection,
): number {
  return direction === 'Buy'
    ? (currentPrice - entryPrice) * quantity
    : (entryPrice - currentPrice) * quantity;
}

/**
 * Calculates annualized return for a stock trade.
 * Formula: ((profitLoss) / costBasis) * (365 / daysHeld) * 100
 */
export function calculateStockAnnualizedROR(
  profitLoss: number,
  costBasis: number,
  daysHeld: number,
): number {
  if (costBasis === 0 || daysHeld === 0) return 0;
  return (profitLoss / costBasis) * (365 / daysHeld) * 100;
}

/**
 * Determines Win or Loss based on profit/loss value.
 * profitLoss > 0 → 'Win', otherwise → 'Loss'
 * Requirement 13.10
 */
export function calculateWinLoss(profitLoss: number): WinLoss {
  return profitLoss > 0 ? 'Win' : 'Loss';
}

/**
 * Calculates the number of calendar days a position was held.
 * Requirement 13.10
 */
export function calculateDaysHeld(openDate: Date, closeDate: Date): number {
  return differenceInCalendarDays(closeDate, openDate);
}
