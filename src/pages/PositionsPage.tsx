import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { filterJournalEntries } from '../db/journalRepository';
import { formatCurrency } from '../utils/formatters';
import type { TradeJournalEntry } from '../types/journal';

export default function PositionsPage() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const { plan } = useTradingPlan();
  const [positions, setPositions] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const strategies = useMemo(() => {
    if (!plan) return new Map<string, string>();
    return new Map([...plan.coreStrategies, ...plan.speculativeStrategies].map((s) => [s.id, s.name]));
  }, [plan]);

  useEffect(() => {
    if (!activePlanId) { setIsLoading(false); return; }
    setIsLoading(true);
    filterJournalEntries({ planId: activePlanId, tradeStatus: 'Open' }, 0, 500)
      .then(({ entries }) => setPositions(entries))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activePlanId]);

  // Group by symbol
  const bySymbol = useMemo(() => {
    const map = new Map<string, TradeJournalEntry[]>();
    for (const p of positions) {
      const arr = map.get(p.stockSymbol) ?? [];
      arr.push(p);
      map.set(p.stockSymbol, arr);
    }
    return Array.from(map.entries())
      .map(([symbol, trades]) => ({
        symbol,
        trades,
        totalMargin: trades.reduce((s, t) => s + (t.marginCashReserve ?? 0), 0),
        totalPremium: trades.reduce((s, t) => s + t.premium * (t.contracts || 1) * 100, 0),
        count: trades.length,
      }))
      .sort((a, b) => b.totalMargin - a.totalMargin);
  }, [positions]);

  const totalMargin = positions.reduce((s, p) => s + (p.marginCashReserve ?? 0), 0);
  const totalPremium = positions.reduce((s, p) => s + p.premium * (p.contracts || 1) * 100, 0);

  if (!activePlanId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Open Positions</h1>
        <p className="mt-2 text-text-secondary">Select a trading plan first.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-center text-text-secondary">Loading positions...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Open Positions</h1>
        <Link to="/journal" className="text-sm text-text-accent hover:underline">Full Journal →</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Open Trades</p>
          <p className="text-lg font-bold text-text-primary">{positions.length}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Symbols</p>
          <p className="text-lg font-bold text-text-primary">{bySymbol.length}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Total Margin</p>
          <p className="text-lg font-bold text-text-primary">{formatCurrency(totalMargin)}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Premium Collected</p>
          <p className="text-lg font-bold text-success">{formatCurrency(totalPremium)}</p>
        </div>
      </div>

      {/* Positions by Symbol */}
      {positions.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">No open positions</p>
      ) : (
        <div className="space-y-3">
          {bySymbol.map(({ symbol, trades, totalMargin: symMargin, totalPremium: symPrem, count }) => (
            <div key={symbol} className="bg-surface-secondary border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <a href={`https://finance.yahoo.com/quote/${symbol}/`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-text-accent hover:underline">{symbol}</a>
                  <span className="text-xs text-text-secondary">{count} position{count > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span>Margin: {formatCurrency(symMargin)}</span>
                  <span>Premium: {formatCurrency(symPrem)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="pb-1 pr-3">Type</th>
                      <th className="pb-1 pr-3">Strategy</th>
                      <th className="pb-1 pr-3">Strike</th>
                      <th className="pb-1 pr-3">Exp</th>
                      <th className="pb-1 pr-3">DTE</th>
                      <th className="pb-1 pr-3">Premium</th>
                      <th className="pb-1 pr-3">#</th>
                      <th className="pb-1 pr-3">Prem Rcvd</th>
                      <th className="pb-1">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => {
                      const now = new Date();
                      const exp = t.expirationDate ? new Date(t.expirationDate) : null;
                      const dte = exp ? Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      const isNearExpiry = dte <= 7 && dte >= 0;
                      return (
                        <tr key={t.id} className={`border-t border-border/50 ${isNearExpiry ? 'bg-warning/10' : ''}`}>
                          <td className="py-1 pr-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.instrumentType === 'Stock' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                              {t.optionType} {t.direction}
                            </span>
                          </td>
                          <td className="py-1 pr-3 text-text-primary">{strategies.get(t.strategyId) || '—'}</td>
                          <td className="py-1 pr-3">${t.strikePrice}</td>
                          <td className="py-1 pr-3">{exp ? exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                          <td className={`py-1 pr-3 font-medium ${isNearExpiry ? 'text-warning' : ''}`}>{dte}</td>
                          <td className="py-1 pr-3">{t.premium.toFixed(2)}</td>
                          <td className="py-1 pr-3">{t.contracts || 1}</td>
                          <td className="py-1 pr-3 text-success">{formatCurrency(t.premium * (t.contracts || 1) * 100)}</td>
                          <td className="py-1">{t.marginCashReserve ? formatCurrency(t.marginCashReserve) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text-secondary text-center pt-4">
        Real-time P/L monitoring via TastyTrade API coming soon.
      </p>
    </div>
  );
}
