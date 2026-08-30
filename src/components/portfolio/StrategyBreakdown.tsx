import { useMemo } from 'react';
import type { TradeJournalEntry } from '../../types/journal';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useTableSort } from '../../hooks/useTableSort';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';

/**
 * Displays P/L breakdown by strategy for a portfolio's journal entries.
 *
 * Requirements: 17.9
 */

interface StrategyBreakdownProps {
  entries: TradeJournalEntry[];
  /** Map of strategyId → strategy name for display */
  strategyNames: Record<string, string>;
}

interface StrategyStats {
  strategyId: string;
  name: string;
  totalTrades: number;
  wins: number;
  winRate: number;
  totalPL: number;
}

export default function StrategyBreakdown({ entries, strategyNames }: StrategyBreakdownProps) {
  const breakdown = useMemo(() => {
    const closedEntries = entries.filter((e) => e.tradeStatus === 'Closed');
    const map = new Map<string, StrategyStats>();

    for (const entry of closedEntries) {
      const sid = entry.strategyId;
      if (!map.has(sid)) {
        map.set(sid, {
          strategyId: sid,
          name: strategyNames[sid] || 'Unknown Strategy',
          totalTrades: 0,
          wins: 0,
          winRate: 0,
          totalPL: 0,
        });
      }
      const stats = map.get(sid)!;
      stats.totalTrades += 1;
      if (entry.winLoss === 'Win') stats.wins += 1;
      stats.totalPL += entry.profitLoss ?? 0;
    }

    for (const stats of map.values()) {
      stats.winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.totalPL - a.totalPL);
  }, [entries, strategyNames]);

  const s = useTableSort<StrategyStats, 'name' | 'totalTrades' | 'winRate' | 'totalPL'>(
    breakdown,
    (row, key) => row[key],
    { initialKey: 'name', initialDir: 'asc', defaultDirForKey: { totalTrades: 'desc', winRate: 'desc', totalPL: 'desc' } },
  );

  return (
    <Card title="P/L by Strategy">
      {breakdown.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-6">No closed trades to analyze</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-tertiary">
                <tr className="[&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('name')}>Strategy{s.sortIndicator('name')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('totalTrades')}>Trades{s.sortIndicator('totalTrades')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('winRate')}>Win Rate{s.sortIndicator('winRate')}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase" onClick={() => s.handleSort('totalPL')}>Total P/L{s.sortIndicator('totalPL')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.sorted.map((row) => (
                  <tr key={row.strategyId}>
                    <td className="px-3 py-2 font-medium text-text-primary">{row.name}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.totalTrades, 0)}</td>
                    <td className="px-3 py-2 text-right">{formatPercentage(row.winRate)}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={row.totalPL >= 0 ? 'success' : 'danger'}>
                        {formatCurrency(row.totalPL)}
                      </Badge>
                    </td>
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
                  <span className="font-medium text-text-primary">{row.name}</span>
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
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
