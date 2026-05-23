/**
 * Holdings computation utility.
 *
 * Computes current portfolio holdings by aggregating Buy/Sell transactions.
 * Groups transactions by composite key (symbol, assetType, optionType, strikePrice, expirationDate),
 * calculates net quantity, weighted average cost basis, and unrealized P/L.
 */

import type { Holding, PortfolioTransaction } from '../types/transaction';

/**
 * Builds a composite grouping key for a transaction.
 * Handles undefined optionType/strikePrice/expirationDate by using 'none' as placeholder.
 */
function buildGroupKey(txn: PortfolioTransaction): string {
  const symbol = txn.symbol.trim().toUpperCase();
  const assetType = txn.assetType;
  const optionType = txn.optionType ?? 'none';
  const strikePrice = txn.strikePrice != null ? txn.strikePrice.toFixed(2) : 'none';
  const expirationDate =
    txn.expirationDate != null ? txn.expirationDate.toISOString() : 'none';
  return `${symbol}|${assetType}|${optionType}|${strikePrice}|${expirationDate}`;
}

interface GroupAccumulator {
  symbol: string;
  assetType: PortfolioTransaction['assetType'];
  optionType?: PortfolioTransaction['optionType'];
  strikePrice?: number;
  expirationDate?: Date;
  totalBuyQuantity: number;
  totalBuyCost: number;
  totalSellQuantity: number;
  latestPrice: number;
  latestDate: Date;
}

/**
 * Computes holdings from a list of portfolio transactions.
 *
 * Algorithm:
 * 1. Filter transactions to only Buy and Sell types
 * 2. Group by composite key (symbol, assetType, optionType, strikePrice, expirationDate)
 * 3. For each group:
 *    - netQuantity = sum(Buy quantities) - sum(Sell quantities)
 *    - averageCostBasis = totalBuyCost / totalBuyQuantity (weighted average)
 *    - totalCostBasis = averageCostBasis * netQuantity
 *    - currentValue = netQuantity * latestPrice (most recent transaction price in group)
 *    - unrealizedPL = currentValue - totalCostBasis
 * 4. Exclude groups where netQuantity === 0
 * 5. Sort by symbol ascending
 */
export function computeHoldings(transactions: PortfolioTransaction[]): Holding[] {
  // Step 1: Filter to Buy/Sell only
  const buySellTransactions = transactions.filter(
    (txn) => txn.transactionType === 'Buy' || txn.transactionType === 'Sell',
  );

  // Step 2: Group by composite key
  const groups = new Map<string, GroupAccumulator>();

  for (const txn of buySellTransactions) {
    const key = buildGroupKey(txn);

    if (!groups.has(key)) {
      groups.set(key, {
        symbol: txn.symbol.trim().toUpperCase(),
        assetType: txn.assetType,
        optionType: txn.optionType,
        strikePrice: txn.strikePrice,
        expirationDate: txn.expirationDate,
        totalBuyQuantity: 0,
        totalBuyCost: 0,
        totalSellQuantity: 0,
        latestPrice: txn.price,
        latestDate: txn.transactionDate,
      });
    }

    const group = groups.get(key)!;

    // Track latest price by most recent transaction date
    if (txn.transactionDate >= group.latestDate) {
      group.latestPrice = txn.price;
      group.latestDate = txn.transactionDate;
    }

    if (txn.transactionType === 'Buy') {
      group.totalBuyQuantity += txn.quantity;
      group.totalBuyCost += txn.quantity * txn.price;
    } else {
      // Sell
      group.totalSellQuantity += txn.quantity;
    }
  }

  // Step 3 & 4: Compute holdings and exclude zero-quantity groups
  const holdings: Holding[] = [];

  for (const group of groups.values()) {
    const netQuantity = group.totalBuyQuantity - group.totalSellQuantity;

    // Step 4: Exclude groups with netQuantity === 0
    if (netQuantity === 0) {
      continue;
    }

    const averageCostBasis =
      group.totalBuyQuantity > 0 ? group.totalBuyCost / group.totalBuyQuantity : 0;
    const totalCostBasis = averageCostBasis * netQuantity;
    const currentValue = netQuantity * group.latestPrice;
    const unrealizedPL = currentValue - totalCostBasis;

    holdings.push({
      symbol: group.symbol,
      assetType: group.assetType,
      optionType: group.optionType,
      strikePrice: group.strikePrice,
      expirationDate: group.expirationDate,
      netQuantity,
      averageCostBasis,
      totalCostBasis,
      currentValue,
      unrealizedPL,
    });
  }

  // Step 5: Sort by symbol ascending
  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return holdings;
}
