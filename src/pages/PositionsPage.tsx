import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { useTableSort } from '../hooks/useTableSort';
import { filterJournalEntries } from '../db/journalRepository';
import { formatCurrency, formatProfitLoss } from '../utils/formatters';
import { buildOccSymbol, fetchOptionQuotes, hasTastyTradeToken, getTastyTradeToken } from '../utils/tastytrade';
import Card from '../components/ui/Card';
import type { TradeJournalEntry } from '../types/journal';

const CONCENTRATION_THRESHOLD = 30; // Warn if >30% in one symbol/strategy/campaign

export default function PositionsPage() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const { plan } = useTradingPlan();
  const [positions, setPositions] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveQuotes, setLiveQuotes] = useState<Map<string, { bid: number; ask: number; mid: number }>>(new Map());
  const [quotesLoading, setQuotesLoading] = useState(false);

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

  // Fetch live quotes from TastyTrade
  const refreshQuotes = useCallback(async () => {
    if (!hasTastyTradeToken() || positions.length === 0) return;
    setQuotesLoading(true);
    try {
      const occSymbols = positions
        .filter((p) => p.instrumentType !== 'Stock' && p.strikePrice > 0 && p.expirationDate)
        .map((p) => buildOccSymbol(p.stockSymbol, new Date(p.expirationDate), p.optionType, p.strikePrice));

      const quotes = await fetchOptionQuotes(occSymbols, getTastyTradeToken());
      const mapped = new Map<string, { bid: number; ask: number; mid: number }>();
      for (const [sym, q] of quotes) {
        mapped.set(sym, { bid: q.bid, ask: q.ask, mid: q.mid });
      }
      setLiveQuotes(mapped);
    } catch {}
    setQuotesLoading(false);
  }, [positions]);

  // Totals
  const totalMargin = positions.reduce((s, p) => s + (p.marginCashReserve ?? 0), 0);
  const totalPremium = positions.reduce((s, p) => s + p.premium * (p.contracts || 1) * 100, 0);
  const totalCount = positions.length;

  // Allocation by symbol
  const symbolAlloc = useMemo(() => {
    const map = new Map<string, { count: number; margin: number; premium: number }>();
    for (const p of positions) {
      const existing = map.get(p.stockSymbol) ?? { count: 0, margin: 0, premium: 0 };
      existing.count++;
      existing.margin += p.marginCashReserve ?? 0;
      existing.premium += p.premium * (p.contracts || 1) * 100;
      map.set(p.stockSymbol, existing);
    }
    return Array.from(map.entries())
      .map(([symbol, d]) => ({ symbol, ...d, pct: totalCount > 0 ? (d.count / totalCount) * 100 : 0, marginPct: totalMargin > 0 ? (d.margin / totalMargin) * 100 : 0 }))
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [positions, totalCount, totalMargin]);

  // Allocation by strategy
  const strategyAlloc = useMemo(() => {
    const map = new Map<string, { count: number; margin: number }>();
    for (const p of positions) {
      const name = strategies.get(p.strategyId) || 'Unknown';
      const existing = map.get(name) ?? { count: 0, margin: 0 };
      existing.count++;
      existing.margin += p.marginCashReserve ?? 0;
      map.set(name, existing);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, pct: totalCount > 0 ? (d.count / totalCount) * 100 : 0, marginPct: totalMargin > 0 ? (d.margin / totalMargin) * 100 : 0 }))
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [positions, totalCount, totalMargin, strategies]);

  // Allocation by campaign
  const campaignAlloc = useMemo(() => {
    const map = new Map<string, { count: number; margin: number }>();
    for (const p of positions) {
      const name = (p.campaign || '').trim() || 'No Campaign';
      const existing = map.get(name) ?? { count: 0, margin: 0 };
      existing.count++;
      existing.margin += p.marginCashReserve ?? 0;
      map.set(name, existing);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, pct: totalCount > 0 ? (d.count / totalCount) * 100 : 0, marginPct: totalMargin > 0 ? (d.margin / totalMargin) * 100 : 0 }))
      .sort((a, b) => b.marginPct - a.marginPct);
  }, [positions, totalCount, totalMargin]);

  // Concentration warnings
  const concentrationWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const s of symbolAlloc) {
      if (s.marginPct > CONCENTRATION_THRESHOLD) warnings.push(`${s.symbol}: ${s.marginPct.toFixed(0)}% of margin`);
    }
    for (const s of strategyAlloc) {
      if (s.pct > 80) warnings.push(`${s.name}: ${s.pct.toFixed(0)}% of positions`);
    }
    return warnings;
  }, [symbolAlloc, strategyAlloc]);

  // Positions with P/L targets
  const positionsWithTargets = useMemo(() => {
    return positions.map((p) => {
      const premRcvd = p.premium * (p.contracts || 1) * 100;
      const profitTarget = premRcvd * 0.5; // 50% of premium
      const stopLoss = -premRcvd; // 100% of premium (loss = giving back all premium)

      // Check live quote for current P/L
      const occSym = p.instrumentType !== 'Stock' && p.strikePrice > 0 && p.expirationDate
        ? buildOccSymbol(p.stockSymbol, new Date(p.expirationDate), p.optionType, p.strikePrice)
        : null;
      const quote = occSym ? liveQuotes.get(occSym) : undefined;
      const currentPrice = quote?.mid;
      const unrealizedPL = currentPrice != null
        ? (p.direction === 'Sell'
            ? (p.premium - currentPrice) * (p.contracts || 1) * 100
            : (currentPrice - p.premium) * (p.contracts || 1) * 100)
        : undefined;

      const atProfitTarget = unrealizedPL != null && unrealizedPL >= profitTarget;
      const atStopLoss = unrealizedPL != null && unrealizedPL <= stopLoss;

      const exp = p.expirationDate ? new Date(p.expirationDate) : null;
      const dte = exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

      return { ...p, premRcvd, profitTarget, stopLoss, currentPrice, unrealizedPL, atProfitTarget, atStopLoss, dte };
    });
  }, [positions, liveQuotes]);

  // Sortable "All Open Positions" table — default to Symbol ascending.
  type PositionRow = typeof positionsWithTargets[number];
  type PositionSortKey =
    | 'stockSymbol' | 'type' | 'strategy' | 'strikePrice' | 'expirationDate'
    | 'dte' | 'premium' | 'premRcvd' | 'profitTarget' | 'stopLoss' | 'currentPrice' | 'unrealizedPL';
  const positionsSort = useTableSort<PositionRow, PositionSortKey>(
    positionsWithTargets,
    (row, key) => {
      switch (key) {
        case 'type': return `${row.optionType} ${row.direction}`;
        case 'strategy': return strategies.get(row.strategyId) || '';
        case 'expirationDate': return row.expirationDate ? new Date(row.expirationDate).getTime() : null;
        default: return row[key] as string | number | null | undefined;
      }
    },
    {
      initialKey: 'stockSymbol',
      initialDir: 'asc',
      defaultDirForKey: {
        strikePrice: 'desc', expirationDate: 'desc', dte: 'desc', premium: 'desc',
        premRcvd: 'desc', profitTarget: 'desc', stopLoss: 'desc', currentPrice: 'desc', unrealizedPL: 'desc',
      },
    },
  );

  if (!activePlanId) {
    return <div className="p-6"><h1 className="text-2xl font-bold text-text-primary">Positions</h1><p className="mt-2 text-text-secondary">Select a plan from the sidebar.</p></div>;
  }
  if (isLoading) return <div className="p-6 text-center text-text-secondary">Loading positions...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Open Positions</h1>
        <div className="flex items-center gap-2">
          {hasTastyTradeToken() && (
            <button onClick={refreshQuotes} disabled={quotesLoading} className="px-3 py-1 text-xs bg-surface-tertiary border border-border rounded text-text-primary hover:bg-text-accent/10 disabled:opacity-50">
              {quotesLoading ? 'Loading...' : '↻ Live Prices'}
            </button>
          )}
          <Link to="/journal" className="text-sm text-text-accent hover:underline">Full Journal →</Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Open Trades" value={String(totalCount)} />
        <StatCard label="Symbols" value={String(symbolAlloc.length)} />
        <StatCard label="Total Margin" value={formatCurrency(totalMargin)} />
        <StatCard label="Premium Collected" value={formatCurrency(totalPremium)} color="green" />
      </div>

      {/* Concentration Warnings */}
      {concentrationWarnings.length > 0 && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <p className="text-xs font-bold text-warning mb-1">⚠ Concentration Risk</p>
          {concentrationWarnings.map((w, i) => (
            <p key={i} className="text-xs text-text-primary">{w}</p>
          ))}
        </div>
      )}

      {/* Allocation Charts (3-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="By Symbol">
          <div className="space-y-1.5">
            {symbolAlloc.map((s) => (
              <div key={s.symbol} className="flex items-center gap-2 text-xs">
                <span className="w-12 font-medium text-text-primary">{s.symbol}</span>
                <div className="flex-1 h-3 bg-surface-tertiary rounded overflow-hidden">
                  <div className={`h-full rounded ${s.marginPct > CONCENTRATION_THRESHOLD ? 'bg-warning' : 'bg-text-accent/60'}`} style={{ width: `${Math.min(s.marginPct, 100)}%` }} />
                </div>
                <span className={`w-10 text-right ${s.marginPct > CONCENTRATION_THRESHOLD ? 'text-warning font-bold' : 'text-text-secondary'}`}>{s.marginPct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="By Strategy">
          <div className="space-y-1.5">
            {strategyAlloc.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 font-medium text-text-primary truncate">{s.name}</span>
                <div className="flex-1 h-3 bg-surface-tertiary rounded overflow-hidden">
                  <div className="h-full bg-purple-400/60 rounded" style={{ width: `${Math.min(s.pct, 100)}%` }} />
                </div>
                <span className="w-10 text-right text-text-secondary">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="By Campaign">
          <div className="space-y-1.5">
            {campaignAlloc.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-20 font-medium text-text-primary truncate">{s.name}</span>
                <div className="flex-1 h-3 bg-surface-tertiary rounded overflow-hidden">
                  <div className="h-full bg-emerald-400/60 rounded" style={{ width: `${Math.min(s.pct, 100)}%` }} />
                </div>
                <span className="w-10 text-right text-text-secondary">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Positions Table with P/L Targets */}
      {totalCount === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">No open positions</p>
      ) : (
        <Card title="All Open Positions">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border [&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('stockSymbol')}>Symbol{positionsSort.sortIndicator('stockSymbol')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('type')}>Type{positionsSort.sortIndicator('type')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('strategy')}>Strategy{positionsSort.sortIndicator('strategy')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('strikePrice')}>Strike{positionsSort.sortIndicator('strikePrice')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('expirationDate')}>Exp{positionsSort.sortIndicator('expirationDate')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('dte')}>DTE{positionsSort.sortIndicator('dte')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('premium')}>Premium{positionsSort.sortIndicator('premium')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('premRcvd')}>Prem Rcvd{positionsSort.sortIndicator('premRcvd')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('profitTarget')}>Target (50%){positionsSort.sortIndicator('profitTarget')}</th>
                  <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('stopLoss')}>Stop (100%){positionsSort.sortIndicator('stopLoss')}</th>
                  {hasTastyTradeToken() && <th className="pb-1.5 pr-2" onClick={() => positionsSort.handleSort('currentPrice')}>Current{positionsSort.sortIndicator('currentPrice')}</th>}
                  {hasTastyTradeToken() && <th className="pb-1.5" onClick={() => positionsSort.handleSort('unrealizedPL')}>Unrealized{positionsSort.sortIndicator('unrealizedPL')}</th>}
                </tr>
              </thead>
              <tbody>
                {positionsSort.sorted.map((t) => {
                  const exp = t.expirationDate ? new Date(t.expirationDate) : null;
                  const dte = t.dte;
                  const isNearExpiry = dte <= 7 && dte >= 0;

                  return (
                    <tr key={t.id} className={`border-t border-border/50 ${t.atStopLoss ? 'bg-error/10' : t.atProfitTarget ? 'bg-success/10' : isNearExpiry ? 'bg-warning/10' : ''}`}>
                      <td className="py-1.5 pr-2 font-medium text-text-accent">
                        <a href={`https://finance.yahoo.com/quote/${t.stockSymbol}/`} target="_blank" rel="noopener noreferrer" className="hover:underline">{t.stockSymbol}</a>
                      </td>
                      <td className="py-1.5 pr-2">{t.optionType} {t.direction}</td>
                      <td className="py-1.5 pr-2 text-text-secondary">{strategies.get(t.strategyId) || '—'}</td>
                      <td className="py-1.5 pr-2">${t.strikePrice}</td>
                      <td className="py-1.5 pr-2">{exp ? exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className={`py-1.5 pr-2 ${isNearExpiry ? 'text-warning font-bold' : ''}`}>{dte}</td>
                      <td className="py-1.5 pr-2">{t.premium.toFixed(2)}</td>
                      <td className="py-1.5 pr-2 text-success">{formatCurrency(t.premRcvd)}</td>
                      <td className="py-1.5 pr-2 text-success">{formatCurrency(t.profitTarget)}</td>
                      <td className="py-1.5 pr-2 text-error">{formatProfitLoss(t.stopLoss)}</td>
                      {hasTastyTradeToken() && (
                        <td className="py-1.5 pr-2">{t.currentPrice != null ? t.currentPrice.toFixed(2) : '—'}</td>
                      )}
                      {hasTastyTradeToken() && (
                        <td className={`py-1.5 font-medium ${t.unrealizedPL != null ? (t.unrealizedPL >= 0 ? 'text-success' : 'text-error') : ''}`}>
                          {t.unrealizedPL != null ? formatProfitLoss(t.unrealizedPL) : '—'}
                          {t.atProfitTarget && <span className="ml-1 text-[9px] bg-success/20 text-success px-1 rounded">TARGET</span>}
                          {t.atStopLoss && <span className="ml-1 text-[9px] bg-error/20 text-error px-1 rounded">STOP</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!hasTastyTradeToken() && (
        <p className="text-xs text-text-secondary text-center pt-2">
          Add VITE_TASTYTRADE_TOKEN to .env to enable live option pricing via TastyTrade API.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const c = color === 'green' ? 'text-success' : color === 'red' ? 'text-error' : 'text-text-primary';
  return (
    <div className="bg-surface-tertiary rounded-lg p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase">{label}</p>
      <p className={`text-lg font-bold ${c}`}>{value}</p>
    </div>
  );
}
