/**
 * Plan-level compliance engine.
 *
 * Evaluates current open trades against the full trading plan:
 * - Strategy allocation: Are core strategy trades at expected %?
 * - Position limits: Any strategy exceeding max positions?
 * - Account sizing: Is total capital deployed within bounds?
 * - Risk management: Are any trades violating max loss thresholds?
 */

import type { TradeJournalEntry } from '../types/journal';
import type { TradingPlan } from '../types/tradingPlan';

export type ComplianceSeverity = 'ok' | 'warning' | 'violation';

export interface ComplianceCheck {
  id: string;
  category: 'allocation' | 'position-limit' | 'risk' | 'trade-rule';
  label: string;
  description: string;
  severity: ComplianceSeverity;
  currentValue: string;
  expectedValue: string;
}

export interface PlanComplianceReport {
  overallSeverity: ComplianceSeverity;
  checks: ComplianceCheck[];
  openTradeCount: number;
  timestamp: Date;
}

/**
 * Compute the worst severity from a list of checks.
 */
function worstSeverity(checks: ComplianceCheck[]): ComplianceSeverity {
  if (checks.some((c) => c.severity === 'violation')) return 'violation';
  if (checks.some((c) => c.severity === 'warning')) return 'warning';
  return 'ok';
}

/**
 * Check strategy allocation compliance.
 * If the plan says 70% of capital should go to "Core Income",
 * verify that 70% (+/- tolerance) of open positions are in core strategies.
 */
function checkAllocationCompliance(
  openTrades: TradeJournalEntry[],
  plan: TradingPlan,
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  if (openTrades.length === 0 || plan.accountSizing.allocations.length === 0) {
    return checks;
  }

  const allStrategies = [...plan.coreStrategies, ...plan.speculativeStrategies];
  const coreStrategyIds = new Set(plan.coreStrategies.map((s) => s.id));
  const totalOpenTrades = openTrades.length;

  // Check core vs speculative ratio based on allocation categories
  // If there's a "Core" allocation, check that enough trades use core strategies
  const coreAllocation = plan.accountSizing.allocations.find(
    (a) => a.categoryName.toLowerCase().includes('core'),
  );

  if (coreAllocation) {
    const coreTradeCount = openTrades.filter((t) => coreStrategyIds.has(t.strategyId)).length;
    const actualCorePct = totalOpenTrades > 0 ? (coreTradeCount / totalOpenTrades) * 100 : 0;
    const expectedPct = coreAllocation.allocationPercentage;

    let severity: ComplianceSeverity = 'ok';
    if (actualCorePct < expectedPct - 20) severity = 'violation';
    else if (actualCorePct < expectedPct - 10) severity = 'warning';

    checks.push({
      id: 'allocation-core-ratio',
      category: 'allocation',
      label: 'Core Strategy Allocation',
      description: `${coreTradeCount} of ${totalOpenTrades} open trades use core strategies`,
      severity,
      currentValue: `${actualCorePct.toFixed(0)}%`,
      expectedValue: `≥ ${expectedPct}%`,
    });
  }

  // Check per-allocation position counts
  for (const alloc of plan.accountSizing.allocations) {
    if (alloc.numberOfPositions == null) continue;

    // Match strategies to allocation category by name similarity
    const matchingStrategies = allStrategies.filter(
      (s) => s.name.toLowerCase().includes(alloc.categoryName.toLowerCase()) ||
             alloc.categoryName.toLowerCase().includes(s.classification.toLowerCase()),
    );
    const matchingIds = new Set(matchingStrategies.map((s) => s.id));
    const posCount = openTrades.filter((t) => matchingIds.has(t.strategyId)).length;

    if (posCount > alloc.numberOfPositions) {
      checks.push({
        id: `allocation-positions-${alloc.id}`,
        category: 'allocation',
        label: `${alloc.categoryName} Position Count`,
        description: `Exceeds planned number of positions`,
        severity: 'violation',
        currentValue: `${posCount} positions`,
        expectedValue: `≤ ${alloc.numberOfPositions}`,
      });
    }
  }

  return checks;
}

/**
 * Check position limit compliance.
 * Ensures no strategy has more open positions than its defined max.
 */
function checkPositionLimits(
  openTrades: TradeJournalEntry[],
  plan: TradingPlan,
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  const { positionLimits } = plan.riskManagement;
  if (positionLimits.length === 0) return checks;

  const allStrategies = [...plan.coreStrategies, ...plan.speculativeStrategies];

  for (const limit of positionLimits) {
    // Find matching strategy by name
    const strategy = allStrategies.find(
      (s) => s.name.toLowerCase() === limit.strategyName.toLowerCase(),
    );
    const strategyId = strategy?.id;

    const matchingTrades = strategyId
      ? openTrades.filter((t) => t.strategyId === strategyId)
      : openTrades.filter((t) => {
          const s = allStrategies.find((st) => st.id === t.strategyId);
          return s?.name.toLowerCase() === limit.strategyName.toLowerCase();
        });

    // Check total position count
    if (matchingTrades.length > limit.maxPositions) {
      checks.push({
        id: `pos-limit-total-${limit.id}`,
        category: 'position-limit',
        label: `${limit.strategyName} Total Positions`,
        description: `Exceeds maximum allowed positions`,
        severity: 'violation',
        currentValue: `${matchingTrades.length}`,
        expectedValue: `≤ ${limit.maxPositions}`,
      });
    }

    // Check per-underlying limit
    const byUnderlying = new Map<string, number>();
    for (const trade of matchingTrades) {
      const count = (byUnderlying.get(trade.stockSymbol) ?? 0) + 1;
      byUnderlying.set(trade.stockSymbol, count);
    }

    for (const [symbol, count] of byUnderlying) {
      if (count > limit.maxPerUnderlying) {
        checks.push({
          id: `pos-limit-underlying-${limit.id}-${symbol}`,
          category: 'position-limit',
          label: `${limit.strategyName} per ${symbol}`,
          description: `Too many positions in a single underlying`,
          severity: 'violation',
          currentValue: `${count}`,
          expectedValue: `≤ ${limit.maxPerUnderlying}`,
        });
      }
    }
  }

  return checks;
}

/**
 * Check risk management compliance.
 * Validates max loss per trade/portfolio and buying power usage.
 */
function checkRiskCompliance(
  openTrades: TradeJournalEntry[],
  plan: TradingPlan,
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];
  const { maxLossPerTrade, maxLossPerPortfolio } = plan.riskManagement;

  // Check individual trade max loss
  if (maxLossPerTrade != null && maxLossPerTrade > 0) {
    const violatingTrades = openTrades.filter(
      (t) => t.unrealizedPL != null && t.unrealizedPL < -maxLossPerTrade,
    );

    if (violatingTrades.length > 0) {
      const worstLoss = Math.min(...violatingTrades.map((t) => t.unrealizedPL ?? 0));
      checks.push({
        id: 'risk-max-loss-per-trade',
        category: 'risk',
        label: 'Max Loss Per Trade',
        description: `${violatingTrades.length} trade(s) exceed max loss threshold`,
        severity: 'violation',
        currentValue: `$${Math.abs(worstLoss).toFixed(0)} (worst)`,
        expectedValue: `≤ $${maxLossPerTrade}`,
      });
    } else {
      checks.push({
        id: 'risk-max-loss-per-trade',
        category: 'risk',
        label: 'Max Loss Per Trade',
        description: 'All trades within max loss threshold',
        severity: 'ok',
        currentValue: 'Within limits',
        expectedValue: `≤ $${maxLossPerTrade}`,
      });
    }
  }

  // Check portfolio-level max loss
  if (maxLossPerPortfolio != null && maxLossPerPortfolio > 0) {
    const totalUnrealizedPL = openTrades.reduce(
      (sum, t) => sum + (t.unrealizedPL ?? 0),
      0,
    );

    if (totalUnrealizedPL < -maxLossPerPortfolio) {
      checks.push({
        id: 'risk-max-loss-portfolio',
        category: 'risk',
        label: 'Max Portfolio Loss',
        description: 'Total unrealized loss exceeds portfolio max',
        severity: 'violation',
        currentValue: `$${Math.abs(totalUnrealizedPL).toFixed(0)}`,
        expectedValue: `≤ $${maxLossPerPortfolio}`,
      });
    } else {
      const severity: ComplianceSeverity =
        totalUnrealizedPL < -(maxLossPerPortfolio * 0.8) ? 'warning' : 'ok';
      checks.push({
        id: 'risk-max-loss-portfolio',
        category: 'risk',
        label: 'Max Portfolio Loss',
        description: severity === 'warning'
          ? 'Approaching portfolio max loss threshold'
          : 'Portfolio loss within acceptable range',
        severity,
        currentValue: totalUnrealizedPL < 0
          ? `$${Math.abs(totalUnrealizedPL).toFixed(0)}`
          : '$0',
        expectedValue: `≤ $${maxLossPerPortfolio}`,
      });
    }
  }

  // Check buying power usage (based on total cash reserves deployed)
  if (plan.accountSizing.totalAccountSize > 0 && plan.riskManagement.bpThresholds.length > 0) {
    const totalCashDeployed = openTrades.reduce(
      (sum, t) => sum + t.cashReserve * (t.contracts ?? 1),
      0,
    );
    const bpUsagePct = (totalCashDeployed / plan.accountSizing.totalAccountSize) * 100;

    // Find the highest threshold exceeded
    const sortedThresholds = [...plan.riskManagement.bpThresholds].sort(
      (a, b) => b.percentage - a.percentage,
    );
    const exceededThreshold = sortedThresholds.find((t) => bpUsagePct >= t.percentage);

    if (exceededThreshold) {
      const isHighest = exceededThreshold === sortedThresholds[0];
      checks.push({
        id: 'risk-bp-usage',
        category: 'risk',
        label: 'Buying Power Usage',
        description: `Action needed: ${exceededThreshold.actionDescription}`,
        severity: isHighest ? 'violation' : 'warning',
        currentValue: `${bpUsagePct.toFixed(1)}%`,
        expectedValue: `< ${exceededThreshold.percentage}%`,
      });
    } else {
      checks.push({
        id: 'risk-bp-usage',
        category: 'risk',
        label: 'Buying Power Usage',
        description: 'Within acceptable buying power limits',
        severity: 'ok',
        currentValue: `${bpUsagePct.toFixed(1)}%`,
        expectedValue: `< ${sortedThresholds[sortedThresholds.length - 1]?.percentage ?? 100}%`,
      });
    }
  }

  return checks;
}

/**
 * Run the full plan compliance evaluation.
 */
export function evaluatePlanCompliance(
  openTrades: TradeJournalEntry[],
  plan: TradingPlan,
): PlanComplianceReport {
  const allChecks: ComplianceCheck[] = [
    ...checkAllocationCompliance(openTrades, plan),
    ...checkPositionLimits(openTrades, plan),
    ...checkRiskCompliance(openTrades, plan),
  ];

  return {
    overallSeverity: worstSeverity(allChecks),
    checks: allChecks,
    openTradeCount: openTrades.length,
    timestamp: new Date(),
  };
}
