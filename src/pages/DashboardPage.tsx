import { useState, useMemo, useEffect } from 'react';
import {
  format,
} from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import PLCalendar from '../components/dashboard/PLCalendar';
import { useTradingPlan } from '../hooks/useTradingPlan';
import { usePlanStore } from '../stores/planStore';
import { useAppStore } from '../stores/appStore';
import { formatCurrency, formatProfitLoss } from '../utils/formatters';
import { getJournalStats, listJournalEntries } from '../db/journalRepository';
import { listPortfolios } from '../db/portfolioRepository';
import { getHoldings } from '../db/holdingsRepository';
import { fetchStockQuotes } from '../utils/stockPrice';
import type { TradeJournalEntry } from '../types/journal';
import type { Portfolio } from '../types/portfolio';
import type { DailyPL, WeeklyPL, MonthlyPLBreakdown, YearlyStats } from '../db/journalRepository';

// ─── Types ──────────────────────────────────────────────────────────────────

type DashboardTab = 'overview' | string; // 'overview' or plan ID

interface PlanStatsData {
  planId: string;
  planName: string;
  totalPL: number;
  winRate: number;
  closedCount: number;
  monthlyPL: number;
  dailyPL: DailyPL[];
  weeklyPL: WeeklyPL[];
  monthlyBreakdown: MonthlyPLBreakdown[];
  yearlyStats: YearlyStats[];
  campaignStats: { campaign: string; pl: number; wins: number; losses: number; trades: number; winRate: number }[];
}

interface PortfolioStatsData {
  portfolio: Portfolio;
  totalValue: number;
  totalCost: number;
  totalPL: number;
  monthlyDividend: number;
  yearlyDividend: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { plan } = useTradingPlan();
  const { plans, loadPlans } = usePlanStore();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [planStats, setPlanStats] = useState<PlanStatsData[]>([]);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStatsData[]>([]);
  const [planEntries, setPlanEntries] = useState<Map<string, TradeJournalEntry[]>>(new Map());

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // Fetch plan stats
  useEffect(() => {
    if (plans.length === 0) return;
    Promise.all(plans.map(async (p) => {
      try {
        const stats = await getJournalStats(p.id);
        const winRate = stats.closedCount > 0 ? (stats.winCount / stats.closedCount) * 100 : 0;
        return { planId: p.id, planName: p.name, totalPL: stats.totalPL, winRate, closedCount: stats.closedCount, monthlyPL: stats.monthlyPL, dailyPL: stats.dailyPL, weeklyPL: stats.weeklyPL, monthlyBreakdown: stats.monthlyBreakdown, yearlyStats: stats.yearlyStats, campaignStats: stats.campaignStats };
      } catch { return null; }
    })).then((results) => setPlanStats(results.filter((r): r is PlanStatsData => r !== null && r.closedCount > 0)));
  }, [plans]);

  // Fetch portfolio stats
  useEffect(() => {
    if (plans.length === 0) return;
    (async () => {
      const all: PortfolioStatsData[] = [];
      for (const p of plans) {
        try {
          const portfolios = await listPortfolios(p.id);
          for (const portfolio of portfolios) {
            const holdings = await getHoldings(portfolio.id);
            let totalCost = 0, totalValue = 0, yearlyDividend = 0;
            const symbols = holdings.filter((h) => h.quantity > 0).map((h) => h.symbol);

            // Try to get live quotes for dividend data
            let quotesMap = new Map<string, { dividendRate: number }>();
            try {
              const q = await fetchStockQuotes(symbols);
              quotesMap = q as Map<string, { dividendRate: number }>;
            } catch {}

            for (const h of holdings) {
              if (h.quantity <= 0) continue;
              totalCost += h.quantity * h.avgCost;
              totalValue += h.quantity * (h.currentPrice ?? h.avgCost);
              const quote = quotesMap.get(h.symbol);
              if (quote && 'dividendRate' in quote) yearlyDividend += (quote.dividendRate ?? 0) * h.quantity;
            }
            const totalPL = totalValue - totalCost;
            const monthlyDividend = yearlyDividend / 12;
            all.push({ portfolio, totalValue, totalCost, totalPL, monthlyDividend, yearlyDividend });
          }
        } catch {}
      }
      setPortfolioStats(all);
    })();
  }, [plans]);

  // Fetch entries for the specific plan tab being viewed
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'portfolios') return;
    const planId = activeTab;
    if (planEntries.has(planId)) return; // already fetched
    listJournalEntries(planId).then((entries) => {
      setPlanEntries((prev) => new Map(prev).set(planId, entries));
    }).catch(() => {});
  }, [activeTab, planEntries]);

  const now = new Date();
  const monthName = format(now, 'MMMM yyyy');

  // Aggregate current month across all plans
  const overviewStats = useMemo(() => {
    const totalMonthlyPL = planStats.reduce((s, p) => s + p.monthlyPL, 0);
    const totalPL = planStats.reduce((s, p) => s + p.totalPL, 0);
    const totalTrades = planStats.reduce((s, p) => s + p.closedCount, 0);
    const totalMonthlyDividend = portfolioStats.reduce((s, p) => s + p.monthlyDividend, 0);
    const totalYearlyDividend = portfolioStats.reduce((s, p) => s + p.yearlyDividend, 0);
    const portfolioValue = portfolioStats.reduce((s, p) => s + p.totalValue, 0);
    return { totalMonthlyPL, totalPL, totalTrades, totalMonthlyDividend, totalYearlyDividend, portfolioValue };
  }, [planStats, portfolioStats]);

  // Tabs: Overview + one per plan + Portfolios
  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...planStats.map((ps) => ({ id: ps.planId, label: ps.planName })),
    ...(portfolioStats.length > 0 ? [{ id: 'portfolios' as DashboardTab, label: 'Portfolios' }] : []),
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Trading Dashboard</h1>
        <Link to="/journal" className="text-sm text-text-accent hover:underline">Open Journal →</Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-text-accent text-text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{monthName} — Performance Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Monthly Options P/L" value={formatProfitLoss(overviewStats.totalMonthlyPL)} color={overviewStats.totalMonthlyPL >= 0 ? 'green' : 'red'} />
            <StatCard label="All-Time Options P/L" value={formatProfitLoss(overviewStats.totalPL)} color={overviewStats.totalPL >= 0 ? 'green' : 'red'} />
            <StatCard label="Closed Trades" value={String(overviewStats.totalTrades)} />
            <StatCard label="Monthly Dividends" value={formatCurrency(overviewStats.totalMonthlyDividend)} color="green" />
            <StatCard label="Yearly Dividends" value={formatCurrency(overviewStats.totalYearlyDividend)} color="green" />
            <StatCard label="Portfolio Value" value={formatCurrency(overviewStats.portfolioValue)} />
          </div>

          {/* Per-plan summary cards */}
          {planStats.length > 0 && (
            <Card title="Plans">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {planStats.map((ps) => (
                  <button key={ps.planId} onClick={() => setActiveTab(ps.planId)} className="text-left border border-border rounded-lg p-3 hover:bg-surface-tertiary transition-colors">
                    <p className="text-sm font-semibold text-text-primary">{ps.planName}</p>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                      <span className="text-text-secondary">This Month</span>
                      <span className={`font-bold ${ps.monthlyPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(ps.monthlyPL)}</span>
                      <span className="text-text-secondary">Win Rate</span>
                      <span className="font-bold text-text-primary">{ps.winRate.toFixed(1)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Per-portfolio summary */}
          {portfolioStats.length > 0 && (
            <Card title="Portfolios">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {portfolioStats.map(({ portfolio, totalValue, monthlyDividend }) => (
                  <button key={portfolio.id} onClick={() => setActiveTab('portfolios')} className="text-left border border-border rounded-lg p-3 hover:bg-surface-tertiary transition-colors">
                    <p className="text-sm font-semibold text-text-primary">{portfolio.name}</p>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                      <span className="text-text-secondary">Value</span>
                      <span className="font-bold text-text-primary">{formatCurrency(totalValue)}</span>
                      <span className="text-text-secondary">Monthly Div</span>
                      <span className="font-bold text-success">{formatCurrency(monthlyDividend)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Plan Detail Tabs */}
      {planStats.find((ps) => ps.planId === activeTab) && (
        <PlanDetailTab stats={planStats.find((ps) => ps.planId === activeTab)!} entries={planEntries.get(activeTab) || []} plan={plan} />
      )}

      {/* Portfolios Tab */}
      {activeTab === 'portfolios' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Portfolio Performance</h2>
          {portfolioStats.map(({ portfolio, totalValue, totalCost, totalPL, monthlyDividend, yearlyDividend }) => {
            const returnPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
            return (
              <Card key={portfolio.id} title={portfolio.name}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Portfolio Value" value={formatCurrency(totalValue)} />
                  <StatCard label="Total P/L" value={formatProfitLoss(totalPL)} color={totalPL >= 0 ? 'green' : 'red'} />
                  <StatCard label="Return" value={`${returnPct.toFixed(2)}%`} color={returnPct >= 0 ? 'green' : 'red'} />
                  <StatCard label="Cost Basis" value={formatCurrency(totalCost)} />
                  <StatCard label="Monthly Dividend" value={formatCurrency(monthlyDividend)} color="green" />
                  <StatCard label="Yearly Dividend" value={formatCurrency(yearlyDividend)} color="green" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Plan Detail Tab ────────────────────────────────────────────────────────

function PlanDetailTab({ stats, entries, plan }: { stats: PlanStatsData; entries: TradeJournalEntry[]; plan: ReturnType<typeof useTradingPlan>['plan'] }) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const setActivePlanId = useAppStore((s) => s.setActivePlanId);

  const strategies = plan ? [...plan.coreStrategies, ...plan.speculativeStrategies] : [];
  const strategyNameMap = new Map(strategies.map((s) => [s.id, s.name]));

  // Cumulative daily P/L line data (all closed trades since plan start)
  const dailyLineData = useMemo(() => {
    const closed = entries.filter((e) => e.tradeStatus !== 'Open' && e.closeDate && e.profitLoss != null);
    const byDay = new Map<string, number>();
    for (const e of closed) {
      const day = new Date(e.closeDate!).toISOString().split('T')[0];
      byDay.set(day, (byDay.get(day) ?? 0) + (e.profitLoss ?? 0));
    }
    let cumulative = 0;
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pl]) => { cumulative += pl; return { date, pl, cumulative }; });
  }, [entries]);

  // Monthly cumulative P/L line data
  const monthlyLineData = useMemo(() => {
    const closed = entries.filter((e) => e.tradeStatus !== 'Open' && e.closeDate && e.profitLoss != null);
    const byMonth = new Map<string, number>();
    for (const e of closed) {
      const d = new Date(e.closeDate!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (e.profitLoss ?? 0));
    }
    let cumulative = 0;
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pl]) => { cumulative += pl; return { month, pl, cumulative }; });
  }, [entries]);

  // Monthly income tracker (symbol × month)
  const symbolMonthData = useMemo(() => {
    const symbolMap = new Map<string, Map<number, number>>();
    for (const e of entries) {
      if (e.tradeStatus === 'Open') continue;
      if (!e.closeDate) continue;
      const pl = e.profitLoss ?? 0;
      if (pl === 0) continue;
      const d = new Date(e.closeDate);
      if (d.getFullYear() !== currentYear) continue;
      const month = d.getMonth();
      if (!symbolMap.has(e.stockSymbol)) symbolMap.set(e.stockSymbol, new Map());
      symbolMap.get(e.stockSymbol)!.set(month, (symbolMap.get(e.stockSymbol)!.get(month) || 0) + pl);
    }
    return Array.from(symbolMap.entries())
      .map(([symbol, monthMap]) => ({ symbol, monthMap, total: Array.from(monthMap.values()).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [entries, currentYear]);

  const monthTotals = useMemo(() => {
    const t = new Array(12).fill(0);
    for (const { monthMap } of symbolMonthData) { for (const [m, pl] of monthMap) t[m] += pl; }
    return t;
  }, [symbolMonthData]);

  // Strategy performance — use name map, fallback to "Unknown Strategy"
  const strategyPerf = useMemo(() => {
    const closed = entries.filter((e) => e.tradeStatus !== 'Open' && e.profitLoss != null);
    const grouped = new Map<string, TradeJournalEntry[]>();
    for (const e of closed) { const arr = grouped.get(e.strategyId) ?? []; arr.push(e); grouped.set(e.strategyId, arr); }
    return Array.from(grouped.entries()).map(([id, trades]) => {
      const wins = trades.filter((t) => t.winLoss === 'Win').length;
      const totalPL = trades.reduce((s, t) => s + (t.profitLoss ?? 0), 0);
      return { name: strategyNameMap.get(id) || 'Unknown Strategy', trades: trades.length, winRate: (wins / trades.length) * 100, totalPL, avgPL: totalPL / trades.length };
    }).sort((a, b) => b.totalPL - a.totalPL);
  }, [entries, strategyNameMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{stats.planName}</h2>
        <Link to="/journal" className="text-sm text-text-accent hover:underline" onClick={() => setActivePlanId(stats.planId)}>Open Journal →</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total P/L" value={formatProfitLoss(stats.totalPL)} color={stats.totalPL >= 0 ? 'green' : 'red'} />
        <StatCard label="This Month" value={formatProfitLoss(stats.monthlyPL)} color={stats.monthlyPL >= 0 ? 'green' : 'red'} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Closed Trades" value={String(stats.closedCount)} />
      </div>

      {/* P/L Calendar */}
      <PLCalendar entries={entries} totalAccountSize={plan?.accountSizing?.totalAccountSize} />

      {/* Row 1: Daily + Monthly Line Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dailyLineData.length > 0 && (
          <Card title="Daily Cumulative P/L">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyLineData}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => formatProfitLoss(Number(v))} />
                  <Line type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  {dailyLineData.length > 30 && <Brush dataKey="date" height={20} stroke="#38bdf8" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {monthlyLineData.length > 0 && (
          <Card title="Monthly Cumulative P/L">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyLineData}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => formatProfitLoss(Number(v))} />
                  <Line type="monotone" dataKey="cumulative" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} />
                  {monthlyLineData.length > 12 && <Brush dataKey="month" height={20} stroke="#4ade80" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Row 2: Strategy + Campaign Performance side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {strategyPerf.length > 0 && (
          <Card title="Strategy Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-text-secondary border-b border-border">
                  <th className="pb-1 pr-3">Strategy</th><th className="pb-1 pr-3">Trades</th><th className="pb-1 pr-3">Win Rate</th><th className="pb-1 pr-3">Total P/L</th><th className="pb-1">Avg P/L</th>
                </tr></thead>
                <tbody>{strategyPerf.map((row) => (
                  <tr key={row.name} className="border-t border-border">
                    <td className="py-1 pr-3 font-medium text-text-primary">{row.name}</td>
                    <td className="py-1 pr-3 text-text-secondary">{row.trades}</td>
                    <td className="py-1 pr-3">{row.winRate.toFixed(1)}%</td>
                    <td className={`py-1 pr-3 font-medium ${row.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.totalPL)}</td>
                    <td className={`py-1 ${row.avgPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(row.avgPL)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        )}

        {stats.campaignStats.length > 0 && (
          <Card title="Campaign Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-text-secondary border-b border-border">
                  <th className="pb-1 pr-3">Campaign</th><th className="pb-1 pr-3">Trades</th><th className="pb-1 pr-3">Win Rate</th><th className="pb-1 pr-3">Total P/L</th><th className="pb-1">W/L</th>
                </tr></thead>
                <tbody>{stats.campaignStats.map((cs) => (
                  <tr key={cs.campaign} className="border-t border-border">
                    <td className="py-1 pr-3 font-medium text-text-primary">{cs.campaign}</td>
                    <td className="py-1 pr-3 text-text-secondary">{cs.trades}</td>
                    <td className="py-1 pr-3">{cs.winRate.toFixed(1)}%</td>
                    <td className={`py-1 pr-3 font-medium ${cs.pl >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(cs.pl)}</td>
                    <td className="py-1 text-text-secondary">{cs.wins}W / {cs.losses}L</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Monthly Income Tracker */}
      {symbolMonthData.length > 0 && (
        <Card title={`${currentYear} Income by Symbol`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b border-border">
                <th className="py-1.5 px-2 text-left text-text-secondary font-medium sticky left-0 bg-surface-secondary z-10">Symbol</th>
                {MONTHS.map((m) => <th key={m} className="py-1.5 px-2 text-right text-text-secondary font-medium">{m}</th>)}
                <th className="py-1.5 px-2 text-right text-text-secondary font-medium">Total</th>
              </tr></thead>
              <tbody>{symbolMonthData.map(({ symbol, monthMap, total }) => (
                <tr key={symbol} className="border-b border-border/50 hover:bg-surface-tertiary">
                  <td className="py-1.5 px-2 font-medium text-text-primary sticky left-0 bg-surface-secondary">{symbol}</td>
                  {MONTHS.map((_, idx) => { const pl = monthMap.get(idx); return <td key={idx} className={`py-1.5 px-2 text-right ${pl != null ? (pl >= 0 ? 'text-success' : 'text-error') : ''}`}>{pl != null ? (pl >= 0 ? '+' : '') + pl.toFixed(0) : ''}</td>; })}
                  <td className={`py-1.5 px-2 text-right font-bold ${total >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(total)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-tertiary">
                <td className="py-2 px-2 font-bold sticky left-0 bg-surface-tertiary">Total</td>
                {monthTotals.map((mt, idx) => <td key={idx} className={`py-2 px-2 text-right font-bold ${mt !== 0 ? (mt >= 0 ? 'text-success' : 'text-error') : ''}`}>{mt !== 0 ? (mt >= 0 ? '+' : '') + mt.toFixed(0) : ''}</td>)}
                <td className={`py-2 px-2 text-right font-bold ${monthTotals.reduce((a, b) => a + b, 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(monthTotals.reduce((a, b) => a + b, 0))}</td>
              </tr></tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const colorClass = color === 'green' ? 'text-success' : color === 'red' ? 'text-error' : 'text-text-primary';
  return (
    <div className="bg-surface-tertiary rounded-lg p-3 text-center">
      <p className="text-[10px] text-text-secondary uppercase">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
