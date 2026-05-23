/**
 * Transaction fingerprint utility for de-duplication during import.
 *
 * A fingerprint is a deterministic string derived from transaction attributes.
 * Format: "YYYY-MM-DD|SYMBOL|TYPE|OPTION_TYPE|STRIKE(2dp)|PRICE(2dp)|QTY(4dp)"
 * Example: "2024-03-15|AAPL|Sell|Put|170.00|3.25|1.0000"
 */

import type { PortfolioTransaction } from '../types/transaction';

/**
 * Formats a Date object as an ISO date string (YYYY-MM-DD) using UTC values.
 */
function formatDateISO(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes a deterministic fingerprint string for a portfolio transaction.
 * Used for de-duplication: two transactions with the same fingerprint are
 * considered duplicates within the same portfolio.
 *
 * Normalization rules:
 * - Symbol is trimmed and uppercased
 * - optionType defaults to 'None' when undefined
 * - strikePrice defaults to 0.00 when undefined
 * - price is formatted to 2 decimal places
 * - quantity is formatted to 4 decimal places (supports fractional shares)
 */
export function computeFingerprint(txn: PortfolioTransaction): string {
  const dateStr = formatDateISO(txn.transactionDate);
  const symbol = txn.symbol.trim().toUpperCase();
  const type = txn.transactionType;
  const optType = txn.optionType ?? 'None';
  const strike = (txn.strikePrice ?? 0).toFixed(2);
  const price = txn.price.toFixed(2);
  const qty = txn.quantity.toFixed(4);
  return `${dateStr}|${symbol}|${type}|${optType}|${strike}|${price}|${qty}`;
}
