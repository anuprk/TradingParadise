import { useMemo } from 'react';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';
import { computePerformanceByStrategy } from '../../utils/optionsDashboard';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';

/**
 * Per-strategy performance breakdown table.
 *
 * Requirements: 18.7
 */

interface PerformanceByStrategyProps {
  entries: TradeJournalEntry[];
  strategies: Strategy[];
}

export default function PerformanceByStrategy({ entries, strategies }: PerformanceByStrategyProps) {
  const breakdown = useMemo(
    () => computePerformanceByStrategy(entries, strategies),
    [entries, strategies],
  );

  if (breakdown.length === 0) {
    return (
      <Card title="Performance by Strategy">
        <p className="text-sm text-text-secondary text-center py-6">No closed trades to analyze</p>
      </Card>
    );
  }

  return (
    <Card title="Performance by Strategy">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-tertiary">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Strategy</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Trades</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Win Rate</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Total P/L</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Avg Ann. ROR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {breakdown.map((s) => (
              <tr key={s.strategyId}>
                <td className="px-3 py-2 font-medium text-text-primary">{s.strategyName}</td>
                <td className="px-3 py-2 text-right">{formatNumber(s.totalTrades, 0)}</td>
                <td className="px-3 py-2 text-right">{formatPercentage(s.winRate)}</td>
                <td className="px-3 py-2 text-right">
                  <Badge variant={s.totalPL >= 0 ? 'success' : 'danger'}>
                    {formatCurrency(s.totalPL)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{formatPercentage(s.avgAnnualizedROR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {breakdown.map((s) => (
          <div key={s.strategyId} className="bg-surface-tertiary rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-text-primary">{s.strategyName}</span>
              <Badge variant={s.totalPL >= 0 ? 'success' : 'danger'}>
                {formatCurrency(s.totalPL)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Trades</span>
              <span>{s.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Win Rate</span>
              <span>{formatPercentage(s.winRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Avg Ann. ROR</span>
              <span>{formatPercentage(s.avgAnnualizedROR)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
