/**
 * Formatting utilities for currency, percentages, and numbers.
 */

/**
 * Formats a number as USD currency (e.g., "$1,234.56").
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number as a percentage string (e.g., "12.34%").
 */
export function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats a number with commas and optional decimal places (e.g., "1,234.5").
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a number as a signed P/L string with currency (e.g., "+$500.00" or "-$200.00").
 */
export function formatProfitLoss(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
}
