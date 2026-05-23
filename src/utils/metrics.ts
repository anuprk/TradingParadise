/**
 * Performance metrics computation utility for portfolio dashboards.
 *
 * Computes realized P/L from matching Buy/Sell pairs, unrealized P/L from
 * open holdings, total portfolio value, overall return percentage, and win rate.
 */

import type { PortfolioTransaction, PerformanceSummaryData, Holding } from '../types/transaction';

/**
 * Builds a composite key for grouping transactions by position.
 * Groups by: symbol, assetType, optionType, strikePrice, expirationDate.
 */
function buildPositionKey(txn: PortfolioTransaction): string {
  const symbol = txn.symbol.trim().toUpperCase();
  const assetType = txn.assetType;
  const optionType = txn.optionType ?? 'None';
  const strike = (txn.strikePrice ?? 0).toFixed(2);
  const expiration = txn.expirationDate
    ? txn.expirationDate.toISOString().split('T')[0]
    : 'None';
  return `${symbol}|${assetType}|${optionType}|${strike}|${expiration}`;
}

interface PositionGroup {
  buys: PortfolioTransaction[];
  sells: PortfolioTransaction[];
}

/**
 * Computes realized P/L for a single position group.
 * Realized P/L = sell revenue - proportional cost basis of sold shares.
 * Returns { realizedPL, isWin } where isWin indicates positive P/L.
 */
function computeRealizedPLForGroup(group: PositionGroup): { realizedPL: number; isWin: boolean } {
  const totalBuyQuantity = group.buys.reduce((sum, t) => sum + t.quantity, 0);
  const totalBuyCost = group.buys.reduce((sum, t) => sum + t.quantity * t.price, 0);

  const totalSellQuantity = group.sells.reduce((sum, t) => sum + t.quantity, 0);
  const totalSellRevenue = group.sells.reduce((sum, t) => sum + t.quantity * t.price, 0);

  if (totalBuyQuantity === 0 || totalSellQuantity === 0) {
    return { realizedPL: 0, isWin: false };
  }

  // Average cost basis per unit from buys
  const avgCostBasis = totalBuyCost / totalBuyQuantity;

  // Proportional cost basis for the sold quantity
  const soldQuantity = Math.min(totalSellQuantity, totalBuyQuantity);
  const proportionalCostBasis = avgCostBasis * soldQuantity;

  // Realized P/L = sell revenue (capped to sold quantity) - proportional cost basis
  // If sells exceed buys, only count revenue up to the buy quantity
  const effectiveSellRevenue =
    totalSellQuantity <= totalBuyQuantity
      ? totalSellRevenue
      : (totalSellRevenue / totalSellQuantity) * soldQuantity;

  const realizedPL = effectiveSellRevenue - proportionalCostBasis;
  return { realizedPL, isWin: realizedPL > 0 };
}

/**
 * Computes holdings (open positions) from transactions for unrealized P/L calculation.
 * This is a simplified inline computation matching the holdings algorithm from the design.
 */
function computeHoldingsFromTransactions(transactions: PortfolioTransaction[]): Holding[] {
  const buySellTransactions = transactions.filter(
    (t) => t.transactionType === 'Buy' || t.transactionType === 'Sell',
  );

  const groups = new Map<string, PositionGroup>();

  for (const txn of buySellTransactions) {
    const key = buildPositionKey(txn);
    if (!groups.has(key)) {
      groups.set(key, { buys: [], sells: [] });
    }
    const group = groups.get(key)!;
    if (txn.transactionType === 'Buy') {
      group.buys.push(txn);
    } else {
      group.sells.push(txn);
    }
  }

  const holdings: Holding[] = [];

  for (const [, group] of groups) {
    const totalBuyQty = group.buys.reduce((sum, t) => sum + t.quantity, 0);
    const totalSellQty = group.sells.reduce((sum, t) => sum + t.quantity, 0);
    const netQuantity = totalBuyQty - totalSellQty;

    if (netQuantity === 0) continue;

    const totalBuyCost = group.buys.reduce((sum, t) => sum + t.quantity * t.price, 0);
    const averageCostBasis = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
    const totalCostBasis = averageCostBasis * netQuantity;

    // Use the most recent transaction price as current price estimate
    const allTransactions = [...group.buys, ...group.sells].sort(
      (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime(),
    );
    const latestPrice = allTransactions[0]?.price ?? 0;
    const currentValue = netQuantity * latestPrice;
    const unrealizedPL = currentValue - totalCostBasis;

    const representative = group.buys[0] ?? group.sells[0];
    holdings.push({
      symbol: representative.symbol.trim().toUpperCase(),
      assetType: representative.assetType,
      optionType: representative.optionType,
      strikePrice: representative.strikePrice,
      expirationDate: representative.expirationDate,
      netQuantity,
      averageCostBasis,
      totalCostBasis,
      currentValue,
      unrealizedPL,
    });
  }

  return holdings;
}

/**
 * Computes the full performance summary for a portfolio.
 *
 * @param transactions - All transactions in the portfolio
 * @param initialBalance - The portfolio's initial balance
 * @returns PerformanceSummaryData with all computed metrics
 *
 * Edge cases:
 * - Zero initial balance → overallReturnPercentage = 0 (avoids division by zero)
 * - No transactions → all metrics are 0
 * - No closed positions → winRate = 0
 */
export function computePerformanceSummary(
  transactions: PortfolioTransaction[],
  initialBalance: number,
): PerformanceSummaryData {
  // Edge case: no transactions
  if (transactions.length === 0) {
    return {
      totalPortfolioValue: initialBalance,
      totalRealizedPL: 0,
      totalUnrealizedPL: 0,
      overallReturnPercentage: 0,
      winRate: 0,
      totalTransactions: 0,
    };
  }

  // Group Buy/Sell transactions by position key for realized P/L
  const buySellTransactions = transactions.filter(
    (t) => t.transactionType === 'Buy' || t.transactionType === 'Sell',
  );

  const groups = new Map<string, PositionGroup>();
  for (const txn of buySellTransactions) {
    const key = buildPositionKey(txn);
    if (!groups.has(key)) {
      groups.set(key, { buys: [], sells: [] });
    }
    const group = groups.get(key)!;
    if (txn.transactionType === 'Buy') {
      group.buys.push(txn);
    } else {
      group.sells.push(txn);
    }
  }

  // Compute realized P/L and win rate from closed positions (groups with sells)
  let totalRealizedPL = 0;
  let closedPositionCount = 0;
  let winningPositionCount = 0;

  for (const [, group] of groups) {
    if (group.sells.length === 0) continue;

    const { realizedPL, isWin } = computeRealizedPLForGroup(group);
    totalRealizedPL += realizedPL;
    closedPositionCount++;
    if (isWin) {
      winningPositionCount++;
    }
  }

  // Compute unrealized P/L from open holdings
  const holdings = computeHoldingsFromTransactions(transactions);
  const totalUnrealizedPL = holdings.reduce((sum, h) => sum + h.unrealizedPL, 0);

  // Sum dividends and fees
  const totalDividends = transactions
    .filter((t) => t.transactionType === 'Dividend')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFees = transactions.reduce((sum, t) => sum + t.fees, 0);

  // Compute total portfolio value
  const totalPortfolioValue =
    initialBalance + totalRealizedPL + totalUnrealizedPL + totalDividends - totalFees;

  // Compute overall return percentage (avoid division by zero)
  const overallReturnPercentage =
    initialBalance === 0
      ? 0
      : ((totalPortfolioValue - initialBalance) / initialBalance) * 100;

  // Compute win rate
  const winRate = closedPositionCount === 0 ? 0 : (winningPositionCount / closedPositionCount) * 100;

  return {
    totalPortfolioValue,
    totalRealizedPL,
    totalUnrealizedPL,
    overallReturnPercentage,
    winRate,
    totalTransactions: transactions.length,
  };
}
