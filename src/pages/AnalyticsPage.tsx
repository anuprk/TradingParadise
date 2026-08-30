import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { useAppStore } from '../stores/appStore';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { useTableSort } from '../hooks/useTableSort';
import { listJournalEntries } from '../db/journalRepository';
import { formatProfitLoss } from '../utils/formatters';
import Card from '../components/ui/Card';
import type { TradeJournalEntry } from '../types/journal';

type DrillDown = null | { type: 'campaign'; value: string } | { type: 'symbol'; value: string } | { type: 'strategy'; value: string };

export default function AnalyticsPage() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const { plan } = useTradingPlan();
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  const strategies = useMemo(() => {
    if (!plan) return new Map<string, string>();
    return new Map([...plan.coreStrategies, ...plan.speculativeStrategies].map((s) => [s.id, s.name]));
  }, [plan]);

  useEffect(() => {
    if (!activePlanId) { setIsLoading(false); return; }
    setIsLoading(true);
    listJournalEntries(activePlanId)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activePlanId]);

  const closedTrades = useMemo(() =>
    entries.filter((e) => e.tradeStatus !== 'Open' && e.profitLoss != null),
    [entries]
  );

  // Apply drill-down filter
  const filteredTrades = useMemo(() => {
    if (!drillDown) return closedTrades;
    switch (drillDown.type) {
      case 'campaign': return closedTrades.filter((t) => (t.campaign || '').trim() === drillDown.value);
      case 'symbol': return closedTrades.filter((t) => t.stockSymbol === drillDown.value);
      case 'strategy': return closedTrades.filter((t) => (strategies.get(t.strategyId) || 'Unknown') === drillDown.value);
      default: return closedTrades;
    }
  }, [closedTrades, drillDown, strategies]);

  // Overall stats
  const stats = useMemo(() => {
    if (filteredTrades.length === 0) return null;
    const totalPL = filteredTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
    const wins = filteredTrades.filter((t) => t.winLoss === 'Win');
    const losses = filteredTrades.filter((t) => t.winLoss === 'Loss');
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / losses.length : 0;
    const winRate = (wins.length / filteredTrades.length) * 100;
    const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0;
    const best = filteredTrades.reduce((b, t) => (t.profitLoss ?? 0) > b ? (t.profitLoss ?? 0) : b, -Infinity);
    const worst = filteredTrades.reduce((w, t) => (t.profitLoss ?? 0) < w ? (t.profitLoss ?? 0) : w, Infinity);

    // Behavioral insights
    const avgDaysHeldWins = wins.filter((t) => t.daysHeld).length > 0
      ? wins.filter((t) => t.daysHeld).reduce((s, t) => s + (t.daysHeld ?? 0), 0) / wins.filter((t) => t.daysHeld).length : 0;
    const avgDaysHeldLosses = losses.filter((t) => t.daysHeld).length > 0
      ? losses.filter((t) => t.daysHeld).reduce((s, t) => s + (t.daysHeld ?? 0), 0) / losses.filter((t) => t.daysHeld).length : 0;

    // Trades per week (overtrading check)
    const dates = filteredTrades.filter((t) => t.closeDate).map((t) => new Date(t.closeDate!).getTime());
    const weekSpan = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / (7 * 24 * 60 * 60 * 1000) : 1;
    const tradesPerWeek = weekSpan > 0 ? filteredTrades.length / weekSpan : filteredTrades.length;

    // Premium captured ratio (for options)
    const optionTrades = filteredTrades.filter((t) => t.instrumentType !== 'Stock' && t.premium > 0);
    const avgPremiumCaptured = optionTrades.length > 0
      ? optionTrades.reduce((s, t) => {
          const premRcvd = t.premium * (t.contracts || 1) * 100;
          const pct = premRcvd > 0 ? ((t.profitLoss ?? 0) / premRcvd) * 100 : 0;
          return s + pct;
        }, 0) / optionTrades.length
      : 0;

    return { totalPL, winRate, avgWin, avgLoss, profitFactor, best, worst, totalTrades: filteredTrades.length, wins: wins.length, losses: losses.length, avgDaysHeldWins, avgDaysHeldLosses, tradesPerWeek, avgPremiumCaptured };
  }, [filteredTrades]);

  // Cumulative P/L over time
  const cumulativeData = useMemo(() => {
    const sorted = [...filteredTrades]
      .filter((e) => e.closeDate)
      .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime());
    let cum = 0;
    return sorted.map((e) => {
      cum += e.profitLoss ?? 0;
      return { date: new Date(e.closeDate!).toISOString().split('T')[0], cumulative: cum };
    });
  }, [filteredTrades]);

  // Grouped breakdowns for drill-down
  const campaignBreakdown = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; totalPL: number; trades: number }>();
    for (const t of closedTrades) {
      const key = (t.campaign || '').trim() || 'No Campaign';
      const existing = map.get(key) ?? { wins: 0, losses: 0, totalPL: 0, trades: 0 };
      existing.trades++; existing.totalPL += t.profitLoss ?? 0;
      if (t.winLoss === 'Win') existing.wins++; else existing.losses++;
      map.set(key, existing);
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d, winRate: (d.wins / d.trades) * 100 })).sort((a, b) => b.totalPL - a.totalPL);
  }, [closedTrades]);

  const symbolBreakdown = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; totalPL: number; trades: number }>();
    for (const t of closedTrades) {
      const existing = map.get(t.stockSymbol) ?? { wins: 0, losses: 0, totalPL: 0, trades: 0 };
      existing.trades++; existing.totalPL += t.profitLoss ?? 0;
      if (t.winLoss === 'Win') existing.wins++; else existing.losses++;
      map.set(t.stockSymbol, existing);
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d, winRate: (d.wins / d.trades) * 100 })).sort((a, b) => b.totalPL - a.totalPL);
  }, [closedTrades]);

  const strategyBreakdown = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; totalPL: number; trades: number }>();
    for (const t of closedTrades) {
      const key = strategies.get(t.strategyId) || 'Unknown';
      const existing = map.get(key) ?? { wins: 0, losses: 0, totalPL: 0, trades: 0 };
      existing.trades++; existing.totalPL += t.profitLoss ?? 0;
      if (t.winLoss === 'Win') existing.wins++; else existing.losses++;
      map.set(key, existing);
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d, winRate: (d.wins / d.trades) * 100 })).sort((a, b) => b.totalPL - a.totalPL);
  }, [closedTrades, strategies]);

  // Recent performance (last 20 trades)
  const recentTrades = useMemo(() => {
    return [...filteredTrades]
      .filter((t) => t.closeDate)
      .sort((a, b) => new Date(b.closeDate!).getTime() - new Date(a.closeDate!).getTime())
      .slice(0, 20);
  }, [filteredTrades]);

  // Sortable "Recent Closed Trades" table — default to Symbol ascending.
  const recentSort = useTableSort<TradeJournalEntry, 'closeDate' | 'stockSymbol' | 'strategy' | 'profitLoss' | 'daysHeld' | 'campaign'>(
    recentTrades,
    (row, key) => {
      switch (key) {
        case 'closeDate': return row.closeDate ? new Date(row.closeDate).getTime() : null;
        case 'strategy': return strategies.get(row.strategyId) || '';
        case 'profitLoss': return row.profitLoss ?? null;
        case 'campaign': return (row.campaign || '').trim();
        default: return row[key] as string | number | null | undefined;
      }
    },
    { initialKey: 'stockSymbol', initialDir: 'asc', defaultDirForKey: { closeDate: 'desc', profitLoss: 'desc', daysHeld: 'desc' } },
  );

  if (!activePlanId) {
    return <div className="p-6"><h1 className="text-2xl font-bold text-text-primary">Analytics</h1><p className="mt-2 text-text-secondary">Select a plan from the sidebar.</p></div>;
  }
  if (isLoading) return <div className="p-6 text-center text-text-secondary">Loading...</div>;
  if (closedTrades.length === 0) return <div className="p-6"><h1 className="text-2xl font-bold text-text-primary">Analytics</h1><p className="mt-4 text-text-secondary">No closed trades to analyze.</p></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        {drillDown && (
          <button onClick={() => setDrillDown(null)} className="text-sm text-text-accent hover:underline">
            ← Back to Overview
          </button>
        )}
      </div>

      {/* Drill-down breadcrumb */}
      {drillDown && (
        <div className="bg-surface-tertiary rounded px-3 py-1.5 text-xs text-text-primary">
          Viewing: <span className="font-bold text-text-accent">{drillDown.type}</span> → {drillDown.value}
          <span className="text-text-secondary ml-2">({filteredTrades.length} trades)</span>
        </div>
      )}

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Total P/L" value={formatProfitLoss(stats.totalPL)} color={stats.totalPL >= 0 ? 'green' : 'red'} />
          <Stat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
          <Stat label="Profit Factor" value={stats.profitFactor.toFixed(2)} />
          <Stat label="Avg Win" value={formatProfitLoss(stats.avgWin)} color="green" />
          <Stat label="Avg Loss" value={formatProfitLoss(stats.avgLoss)} color="red" />
        </div>
      )}

      {/* Behavioral Insights */}
      {stats && (
        <Card title="Behavioral Insights">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <InsightCard
              question="Closing winners too early?"
              value={`Avg ${stats.avgDaysHeldWins.toFixed(0)} days`}
              detail={stats.avgPremiumCaptured > 0 ? `Capturing ${stats.avgPremiumCaptured.toFixed(0)}% of premium` : undefined}
              status={stats.avgPremiumCaptured > 40 ? 'good' : stats.avgPremiumCaptured > 20 ? 'neutral' : 'warning'}
            />
            <InsightCard
              question="Holding losers too long?"
              value={`Avg ${stats.avgDaysHeldLosses.toFixed(0)} days`}
              detail={stats.avgDaysHeldLosses > stats.avgDaysHeldWins * 1.5 ? 'Losers held longer than winners' : 'Reasonable loss duration'}
              status={stats.avgDaysHeldLosses > stats.avgDaysHeldWins * 1.5 ? 'warning' : 'good'}
            />
            <InsightCard
              question="Over-trading?"
              value={`${stats.tradesPerWeek.toFixed(1)} trades/week`}
              detail={stats.tradesPerWeek > 10 ? 'High frequency — watch for churning' : 'Moderate frequency'}
              status={stats.tradesPerWeek > 10 ? 'warning' : 'good'}
            />
            <InsightCard
              question="Best trade"
              value={formatProfitLoss(stats.best)}
              detail={`Worst: ${formatProfitLoss(stats.worst)}`}
              status="neutral"
            />
          </div>
        </Card>
      )}

      {/* Cumulative P/L Chart */}
      {cumulativeData.length > 0 && (
        <Card title="Cumulative P/L">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatProfitLoss(Number(v))} />
                <Line type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} dot={false} />
                {cumulativeData.length > 30 && <Brush dataKey="date" height={18} stroke="#38bdf8" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Drill-down Tables */}
      {!drillDown && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BreakdownTable title="By Strategy" data={strategyBreakdown} onDrillDown={(name) => setDrillDown({ type: 'strategy', value: name })} />
          <BreakdownTable title="By Symbol" data={symbolBreakdown} onDrillDown={(name) => setDrillDown({ type: 'symbol', value: name })} />
          <BreakdownTable title="By Campaign" data={campaignBreakdown} onDrillDown={(name) => setDrillDown({ type: 'campaign', value: name })} />
        </div>
      )}

      {/* Recent Trades */}
      <Card title="Recent Closed Trades">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-secondary"><tr className="text-left text-text-secondary border-b border-border [&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
              <th className="pb-1 pr-2" onClick={() => recentSort.handleSort('closeDate')}>Date{recentSort.sortIndicator('closeDate')}</th><th className="pb-1 pr-2" onClick={() => recentSort.handleSort('stockSymbol')}>Symbol{recentSort.sortIndicator('stockSymbol')}</th><th className="pb-1 pr-2" onClick={() => recentSort.handleSort('strategy')}>Strategy{recentSort.sortIndicator('strategy')}</th><th className="pb-1 pr-2" onClick={() => recentSort.handleSort('profitLoss')}>P/L{recentSort.sortIndicator('profitLoss')}</th><th className="pb-1 pr-2" onClick={() => recentSort.handleSort('daysHeld')}>Days{recentSort.sortIndicator('daysHeld')}</th><th className="pb-1" onClick={() => recentSort.handleSort('campaign')}>Campaign{recentSort.sortIndicator('campaign')}</th>
            </tr></thead>
            <tbody>{recentSort.sorted.map((t) => (
              <tr key={t.id} className="border-t border-border/50">
                <td className="py-1 pr-2 text-text-secondary">{t.closeDate ? new Date(t.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                <td className="py-1 pr-2 font-medium text-text-primary">{t.stockSymbol}</td>
                <td className="py-1 pr-2 text-text-secondary">{strategies.get(t.strategyId) || '—'}</td>
                <td className={`py-1 pr-2 font-medium ${(t.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(t.profitLoss ?? 0)}</td>
                <td className="py-1 pr-2 text-text-secondary">{t.daysHeld ?? '—'}</td>
                <td className="py-1 text-text-secondary">{t.campaign || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const c = color === 'green' ? 'text-success' : color === 'red' ? 'text-error' : 'text-text-primary';
  return (
    <div className="bg-surface-tertiary rounded-lg p-2.5 text-center">
      <p className="text-[9px] text-text-secondary uppercase">{label}</p>
      <p className={`text-sm font-bold ${c}`}>{value}</p>
    </div>
  );
}

function InsightCard({ question, value, detail, status }: { question: string; value: string; detail?: string; status: 'good' | 'warning' | 'neutral' }) {
  const borderColor = status === 'good' ? 'border-l-success' : status === 'warning' ? 'border-l-warning' : 'border-l-text-accent';
  return (
    <div className={`p-3 bg-surface-tertiary rounded border-l-4 ${borderColor}`}>
      <p className="text-text-secondary text-[10px] mb-1">{question}</p>
      <p className="text-text-primary font-bold text-sm">{value}</p>
      {detail && <p className="text-text-secondary text-[10px] mt-0.5">{detail}</p>}
    </div>
  );
}

function BreakdownTable({ title, data, onDrillDown }: { title: string; data: { name: string; trades: number; winRate: number; totalPL: number }[]; onDrillDown: (name: string) => void }) {
  const s = useTableSort<typeof data[number], 'name' | 'winRate' | 'totalPL'>(
    data,
    (row, key) => row[key],
    { initialKey: 'name', initialDir: 'asc', defaultDirForKey: { winRate: 'desc', totalPL: 'desc' } },
  );
  return (
    <Card title={title}>
      <div className="overflow-y-auto max-h-48">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-text-secondary border-b border-border [&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
            <th className="pb-1 pr-2" onClick={() => s.handleSort('name')}>Name{s.sortIndicator('name')}</th><th className="pb-1 pr-2" onClick={() => s.handleSort('winRate')}>Win%{s.sortIndicator('winRate')}</th><th className="pb-1" onClick={() => s.handleSort('totalPL')}>P/L{s.sortIndicator('totalPL')}</th>
          </tr></thead>
          <tbody>{s.sorted.map((row) => (
            <tr key={row.name} className="border-t border-border/50 cursor-pointer hover:bg-surface-tertiary" onClick={() => onDrillDown(row.name)}>
              <td className="py-1 pr-2 font-medium text-text-accent">{row.name}</td>
              <td className="py-1 pr-2">{row.winRate.toFixed(0)}%</td>
              <td className={`py-1 font-medium ${row.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.totalPL)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}
