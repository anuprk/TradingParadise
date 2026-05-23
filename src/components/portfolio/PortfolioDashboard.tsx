import { useEffect, useMemo } from 'react';
import { usePortfolioStore } from '../../stores/portfolioStore';
import { useJournalStore } from '../../stores/journalStore';
import { usePlanStore } from '../../stores/planStore';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import PerformanceMetrics from './PerformanceMetrics';
import PerformanceChart from './PerformanceChart';
import PositionsList from './PositionsList';
import StrategyBreakdown from './StrategyBreakdown';
import { formatCurrency, formatProfitLoss } from '../../utils/formatters';

/**
 * Main portfolio dashboard displaying key metrics, performance,
 * open positions, strategy breakdown, and linked journal entries.
 *
 * Requirements: 17.3, 17.4, 17.5, 17.6, 17.8, 17.9, 17.12
 */

interface PortfolioDashboardProps {
  portfolioId: string;
}

export default function PortfolioDashboard({ portfolioId }: PortfolioDashboardProps) {
  const { currentPortfolio, metrics, isLoading, selectPortfolio } = usePortfolioStore();
  const entries = useJournalStore((s) => s.entries);
  const loadEntries = useJournalStore((s) => s.loadEntries);
  const currentPlan = usePlanStore((s) => s.currentPlan);

  useEffect(() => {
    selectPortfolio(portfolioId);
  }, [portfolioId, selectPortfolio]);

  // Load journal entries for this portfolio's plan
  useEffect(() => {
    if (currentPortfolio?.planId) {
      loadEntries(currentPortfolio.planId);
    }
  }, [currentPortfolio?.planId, loadEntries]);

  // Filter entries to this portfolio
  const portfolioEntries = useMemo(
    () => entries.filter((e) => e.portfolioId === portfolioId),
    [entries, portfolioId],
  );

  // Build strategy name map from the current plan
  const strategyNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (currentPlan) {
      for (const s of [...currentPlan.coreStrategies, ...currentPlan.speculativeStrategies]) {
        map[s.id] = s.name;
      }
    }
    return map;
  }, [currentPlan]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-secondary">Loading portfolio...</p>
      </div>
    );
  }

  if (!currentPortfolio || !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-secondary">Portfolio not found</p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Net Liquidation', value: formatCurrency(metrics.netLiquidation), variant: 'info' as const },
    { label: 'Realized P/L', value: formatProfitLoss(metrics.totalRealizedPL), variant: metrics.totalRealizedPL >= 0 ? 'success' as const : 'danger' as const },
    { label: 'Unrealized P/L', value: formatProfitLoss(metrics.totalUnrealizedPL), variant: metrics.totalUnrealizedPL >= 0 ? 'success' as const : 'danger' as const },
    { label: 'Total P/L', value: formatProfitLoss(metrics.totalPL), variant: metrics.totalPL >= 0 ? 'success' as const : 'danger' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Portfolio header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">{currentPortfolio.name}</h2>
        {currentPortfolio.description && (
          <p className="mt-1 text-sm text-text-secondary">{currentPortfolio.description}</p>
        )}
      </div>

      {/* Key metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <p className="text-xs text-text-secondary uppercase tracking-wide">{card.label}</p>
            <p className="mt-1 text-xl font-bold">
              <Badge variant={card.variant} className="text-base px-3 py-1">
                {card.value}
              </Badge>
            </p>
          </Card>
        ))}
      </div>

      {/* Performance metrics */}
      <PerformanceMetrics metrics={metrics} />

      {/* Performance chart */}
      <PerformanceChart
        monthlyReturns={metrics.monthlyReturns}
        initialBalance={currentPortfolio.initialBalance}
      />

      {/* Open positions */}
      <PositionsList entries={portfolioEntries} />

      {/* Strategy breakdown */}
      <StrategyBreakdown entries={portfolioEntries} strategyNames={strategyNames} />

      {/* Recent journal entries for this portfolio */}
      <Card title="Journal Entries">
        {portfolioEntries.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">No journal entries for this portfolio</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-tertiary">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Symbol</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Open Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Premium</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolioEntries.slice(0, 20).map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 font-medium text-text-primary">{entry.stockSymbol}</td>
                    <td className="px-3 py-2">
                      <Badge variant={entry.optionType === 'Call' ? 'info' : 'warning'}>{entry.optionType}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={entry.tradeStatus === 'Open' ? 'info' : entry.tradeStatus === 'Closed' ? 'neutral' : 'warning'}>
                        {entry.tradeStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {new Date(entry.openDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(entry.premium)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${(entry.profitLoss ?? entry.unrealizedPL ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {entry.profitLoss != null
                        ? formatCurrency(entry.profitLoss)
                        : entry.unrealizedPL != null
                          ? formatCurrency(entry.unrealizedPL)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {portfolioEntries.length > 20 && (
              <p className="text-xs text-text-secondary text-center mt-2">
                Showing 20 of {portfolioEntries.length} entries
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
