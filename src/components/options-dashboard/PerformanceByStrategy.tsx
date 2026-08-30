import { useMemo } from 'react';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';
import { computePerformanceByStrategy } from '../../utils/optionsDashboard';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useTableSort } from '../../hooks/useTableSort';
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

  const s = useTableSort<typeof breakdown[number], 'strategyName' | 'totalTrades' | 'winRate' | 'totalPL' | 'avgAnnualizedROR'>(
    breakdown,
    (row, key) => row[key],
    { initialKey: 'strategyName', initialDir: 'asc', defaultDirForKey: { totalTrades: 'desc', winRate: 'desc', totalPL: 'desc', avgAnnualizedROR: 'desc' } },
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
            <tr className="[&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
              <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('strategyName')}>Strategy{s.sortIndicator('strategyName')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('totalTrades')}>Trades{s.sortIndicator('totalTrades')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('winRate')}>Win Rate{s.sortIndicator('winRate')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('totalPL')}>Total P/L{s.sortIndicator('totalPL')}</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('avgAnnualizedROR')}>Avg Ann. ROR{s.sortIndicator('avgAnnualizedROR')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {s.sorted.map((row) => (
              <tr key={row.strategyId}>
                <td className="px-3 py-2 font-medium text-text-primary">{row.strategyName}</td>
                <td className="px-3 py-2 text-right">{formatNumber(row.totalTrades, 0)}</td>
                <td className="px-3 py-2 text-right">{formatPercentage(row.winRate)}</td>
                <td className="px-3 py-2 text-right">
                  <Badge variant={row.totalPL >= 0 ? 'success' : 'danger'}>
                    {formatCurrency(row.totalPL)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{formatPercentage(row.avgAnnualizedROR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {s.sorted.map((row) => (
          <div key={row.strategyId} className="bg-surface-tertiary rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-text-primary">{row.strategyName}</span>
              <Badge variant={row.totalPL >= 0 ? 'success' : 'danger'}>
                {formatCurrency(row.totalPL)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Trades</span>
              <span>{row.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Win Rate</span>
              <span>{formatPercentage(row.winRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Avg Ann. ROR</span>
              <span>{formatPercentage(row.avgAnnualizedROR)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
