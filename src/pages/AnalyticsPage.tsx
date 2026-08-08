import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { useAppStore } from '../stores/appStore';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { listJournalEntries } from '../db/journalRepository';
import { formatProfitLoss } from '../utils/formatters';
import Card from '../components/ui/Card';
import type { TradeJournalEntry } from '../types/journal';

export default function AnalyticsPage() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const { plan } = useTradingPlan();
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Overall stats
  const stats = useMemo(() => {
    if (closedTrades.length === 0) return null;
    const totalPL = closedTrades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
    const wins = closedTrades.filter((t) => t.winLoss === 'Win');
    const losses = closedTrades.filter((t) => t.winLoss === 'Loss');
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.profitLoss ?? 0), 0) / losses.length : 0;
    const winRate = (wins.length / closedTrades.length) * 100;
    const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0;
    const best = closedTrades.reduce((b, t) => (t.profitLoss ?? 0) > b ? (t.profitLoss ?? 0) : b, -Infinity);
    const worst = closedTrades.reduce((w, t) => (t.profitLoss ?? 0) < w ? (t.profitLoss ?? 0) : w, Infinity);
    return { totalPL, winRate, avgWin, avgLoss, profitFactor, best, worst, totalTrades: closedTrades.length, wins: wins.length, losses: losses.length };
  }, [closedTrades]);

  // Cumulative P/L over time
  const cumulativeData = useMemo(() => {
    const sorted = [...closedTrades]
      .filter((e) => e.closeDate)
      .sort((a, b) => new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime());
    let cum = 0;
    return sorted.map((e) => {
      cum += e.profitLoss ?? 0;
      return { date: new Date(e.closeDate!).toISOString().split('T')[0], cumulative: cum, pl: e.profitLoss ?? 0 };
    });
  }, [closedTrades]);

  // Strategy breakdown
  const strategyBreakdown = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; totalPL: number; trades: number }>();
    for (const t of closedTrades) {
      const name = strategies.get(t.strategyId) || 'Unknown';
      const existing = map.get(name) ?? { wins: 0, losses: 0, totalPL: 0, trades: 0 };
      existing.trades++;
      existing.totalPL += t.profitLoss ?? 0;
      if (t.winLoss === 'Win') existing.wins++;
      else existing.losses++;
      map.set(name, existing);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, winRate: (data.wins / data.trades) * 100, avgPL: data.totalPL / data.trades }))
      .sort((a, b) => b.totalPL - a.totalPL);
  }, [closedTrades, strategies]);

  // Best and worst performers (by symbol)
  const symbolPerf = useMemo(() => {
    const map = new Map<string, { totalPL: number; trades: number; wins: number }>();
    for (const t of closedTrades) {
      const existing = map.get(t.stockSymbol) ?? { totalPL: 0, trades: 0, wins: 0 };
      existing.totalPL += t.profitLoss ?? 0;
      existing.trades++;
      if (t.winLoss === 'Win') existing.wins++;
      map.set(t.stockSymbol, existing);
    }
    return Array.from(map.entries())
      .map(([symbol, data]) => ({ symbol, ...data, winRate: (data.wins / data.trades) * 100 }))
      .sort((a, b) => b.totalPL - a.totalPL);
  }, [closedTrades]);

  // P/L distribution (histogram buckets)
  const distribution = useMemo(() => {
    if (closedTrades.length === 0) return [];
    const pls = closedTrades.map((t) => t.profitLoss ?? 0);
    const min = Math.min(...pls);
    const max = Math.max(...pls);
    const range = max - min;
    if (range === 0) return [{ bucket: '0', count: pls.length }];
    const bucketSize = range / 10;
    const buckets = new Array(10).fill(0);
    for (const pl of pls) {
      const idx = Math.min(9, Math.floor((pl - min) / bucketSize));
      buckets[idx]++;
    }
    return buckets.map((count, i) => ({
      bucket: `$${(min + i * bucketSize).toFixed(0)}`,
      count,
    }));
  }, [closedTrades]);

  if (!activePlanId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="mt-2 text-text-secondary">Select a trading plan first.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-center text-text-secondary">Loading analytics...</div>;
  }

  if (!stats || closedTrades.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="mt-4 text-text-secondary">No closed trades to analyze yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Total P/L" value={formatProfitLoss(stats.totalPL)} color={stats.totalPL >= 0 ? 'green' : 'red'} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} />
        <StatCard label="Avg Win" value={formatProfitLoss(stats.avgWin)} color="green" />
        <StatCard label="Avg Loss" value={formatProfitLoss(stats.avgLoss)} color="red" />
        <StatCard label="Best Trade" value={formatProfitLoss(stats.best)} color="green" />
        <StatCard label="Worst Trade" value={formatProfitLoss(stats.worst)} color="red" />
        <StatCard label="Total Trades" value={String(stats.totalTrades)} />
        <StatCard label="Wins" value={String(stats.wins)} color="green" />
        <StatCard label="Losses" value={String(stats.losses)} color="red" />
      </div>

      {/* Cumulative P/L Chart */}
      <Card title="Cumulative P/L (Full History)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatProfitLoss(Number(v))} />
              <Line type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} dot={false} />
              {cumulativeData.length > 30 && <Brush dataKey="date" height={20} stroke="#38bdf8" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 2-column: Strategy + Symbol Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strategy Breakdown */}
        <Card title="Strategy Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-text-secondary border-b border-border">
                <th className="pb-1 pr-3">Strategy</th>
                <th className="pb-1 pr-3">Trades</th>
                <th className="pb-1 pr-3">Win Rate</th>
                <th className="pb-1 pr-3">Total P/L</th>
                <th className="pb-1">Avg P/L</th>
              </tr></thead>
              <tbody>{strategyBreakdown.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-medium text-text-primary">{row.name}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">{row.trades}</td>
                  <td className="py-1.5 pr-3">{row.winRate.toFixed(1)}%</td>
                  <td className={`py-1.5 pr-3 font-medium ${row.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.totalPL)}</td>
                  <td className={`py-1.5 ${row.avgPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.avgPL)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>

        {/* Best/Worst Performers */}
        <Card title="Performance by Symbol">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-secondary"><tr className="text-left text-text-secondary border-b border-border">
                <th className="pb-1 pr-3">Symbol</th>
                <th className="pb-1 pr-3">Trades</th>
                <th className="pb-1 pr-3">Win Rate</th>
                <th className="pb-1">Total P/L</th>
              </tr></thead>
              <tbody>{symbolPerf.map((row) => (
                <tr key={row.symbol} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-medium text-text-primary">
                    <a href={`https://finance.yahoo.com/quote/${row.symbol}/`} target="_blank" rel="noopener noreferrer" className="text-text-accent hover:underline">{row.symbol}</a>
                  </td>
                  <td className="py-1.5 pr-3 text-text-secondary">{row.trades}</td>
                  <td className="py-1.5 pr-3">{row.winRate.toFixed(1)}%</td>
                  <td className={`py-1.5 font-medium ${row.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.totalPL)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* P/L Distribution */}
      {distribution.length > 0 && (
        <Card title="P/L Distribution">
          <div className="flex items-end gap-1 h-32">
            {distribution.map((b, i) => {
              const maxCount = Math.max(...distribution.map((d) => d.count));
              const height = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-text-accent/30 rounded-t" style={{ height: `${height}%` }} title={`${b.bucket}: ${b.count} trades`} />
                  <p className="text-[8px] text-text-secondary mt-1 truncate w-full text-center">{b.bucket}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const colorClass = color === 'green' ? 'text-success' : color === 'red' ? 'text-error' : 'text-text-primary';
  return (
    <div className="bg-surface-tertiary rounded-lg p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
