import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';
import type { PortfolioTransaction } from '../../types/transaction';

/**
 * Dividend visualization charts: future payments, actual receipts,
 * year-over-year growth, per-holding yield, and income diversification.
 */

interface DividendHoldingRow {
  symbol: string;
  name: string;
  qty: number;
  dividendRate: number;
  annualDiv: number;
  monthlyDiv: number;
  freq: string;
  yield: number;
}

interface DividendChartsProps {
  dividendHoldings: DividendHoldingRow[];
  actualDividends: PortfolioTransaction[];
  totals: { totalAnnual: number; totalMonthly: number };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PALETTE = ['#3b82f6', '#8b5cf6', '#fb923c', '#10b981', '#f472b6', '#22d3ee', '#facc15', '#ef4444'];

/** Projected dividend amount for a holding in a given calendar month index (0-11), per the freq-based simplification. */
function projectedAmountForMonth(holding: DividendHoldingRow, monthIndex: number): number {
  if (holding.freq === 'monthly' || holding.freq === 'weekly') {
    return holding.annualDiv / 12;
  }
  if (holding.freq === 'quarterly') {
    return monthIndex === 2 || monthIndex === 5 || monthIndex === 8 || monthIndex === 11 ? holding.annualDiv / 4 : 0;
  }
  // yearly
  return monthIndex === 11 ? holding.annualDiv : 0;
}

export default function DividendCharts({ dividendHoldings, actualDividends, totals }: DividendChartsProps) {
  // (a) Future payments: rolling 12 months starting at current month
  const { futurePayments, next12mTotal, next12mMonthlyAvg } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const rows: { label: string; received: number; projected: number; total: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);

      const projectedTotal = dividendHoldings.reduce((s, h) => s + projectedAmountForMonth(h, monthIndex), 0);

      let received = 0;
      if (i === 0) {
        received = actualDividends.reduce((s, txn) => {
          const d = new Date(txn.transactionDate);
          if (d.getFullYear() === year && d.getMonth() === monthIndex) return s + Math.abs(txn.amount);
          return s;
        }, 0);
      }

      const projectedRemaining = i === 0 ? Math.max(0, projectedTotal - received) : projectedTotal;
      rows.push({ label: MONTHS[monthIndex], received, projected: projectedRemaining, total: received + projectedRemaining });
    }

    const total = rows.reduce((s, r) => s + r.total, 0);
    return { futurePayments: rows, next12mTotal: total, next12mMonthlyAvg: total / 12 };
  }, [dividendHoldings, actualDividends]);

  // (b) Dividends received: current calendar year, Jan-Dec actuals
  const { dividendsReceivedMonthly, ytdTotal } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const amounts = new Array(12).fill(0);
    for (const txn of actualDividends) {
      const d = new Date(txn.transactionDate);
      if (d.getFullYear() !== currentYear) continue;
      amounts[d.getMonth()] += Math.abs(txn.amount);
    }
    const rows = MONTHS.map((label, i) => ({ label, amount: amounts[i] }));
    return { dividendsReceivedMonthly: rows, ytdTotal: amounts.reduce((s, v) => s + v, 0) };
  }, [actualDividends]);

  // (c) Dividend growth: distinct years present in actuals, most recent 3
  const { dividendGrowthData, years } = useMemo(() => {
    const yearSet = new Set<number>();
    for (const txn of actualDividends) {
      yearSet.add(new Date(txn.transactionDate).getFullYear());
    }
    const allYears = Array.from(yearSet).sort((a, b) => a - b);
    const recentYears = allYears.slice(-3);

    const rows: Record<string, string | number>[] = MONTHS.map((label) => ({ month: label }));
    for (const year of recentYears) {
      const amounts = new Array(12).fill(0);
      for (const txn of actualDividends) {
        const d = new Date(txn.transactionDate);
        if (d.getFullYear() !== year) continue;
        amounts[d.getMonth()] += Math.abs(txn.amount);
      }
      for (let i = 0; i < 12; i++) rows[i][String(year)] = amounts[i];
    }
    return { dividendGrowthData: rows, years: recentYears };
  }, [actualDividends]);

  // (d) Yield/Payout: per-holding yield, sorted descending
  const yieldPayoutData = useMemo(() => {
    return dividendHoldings
      .map((h) => ({ symbol: h.symbol, yield: h.yield }))
      .sort((a, b) => b.yield - a.yield);
  }, [dividendHoldings]);

  // (e) Passive income diversification: share of total annual projected income
  const diversificationData = useMemo(() => {
    return dividendHoldings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      value: h.annualDiv,
      pct: totals.totalAnnual > 0 ? (h.annualDiv / totals.totalAnnual) * 100 : 0,
    }));
  }, [dividendHoldings, totals.totalAnnual]);

  if (dividendHoldings.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {futurePayments.length > 0 && (
          <Card title="Future Payments">
            <div className="flex gap-3 mb-3">
              <div className="bg-surface-tertiary rounded-lg px-3 py-2">
                <p className="text-[10px] text-text-secondary uppercase">Next 12m</p>
                <p className="text-sm font-bold text-success">{formatCurrency(next12mTotal)}</p>
              </div>
              <div className="bg-surface-tertiary rounded-lg px-3 py-2">
                <p className="text-[10px] text-text-secondary uppercase">Monthly</p>
                <p className="text-sm font-bold text-success">{formatCurrency(next12mMonthlyAvg)}</p>
              </div>
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={futurePayments} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} width={80} />
                  <Tooltip
                    formatter={(value, name) => {
                      const label = name === 'received' ? 'Received' : 'Projected';
                      return [formatCurrency(Number(value)), label];
                    }}
                  />
                  <Bar dataKey="received" stackId="a" fill={PALETTE[1]} />
                  <Bar dataKey="projected" stackId="a" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {dividendsReceivedMonthly.length > 0 && (
          <Card title="Dividends Received">
            <div className="flex gap-3 mb-3">
              <div className="bg-surface-tertiary rounded-lg px-3 py-2">
                <p className="text-[10px] text-text-secondary uppercase">Total</p>
                <p className="text-sm font-bold text-success">{formatCurrency(ytdTotal)}</p>
              </div>
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendsReceivedMonthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} width={80} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Received']} />
                  <Bar dataKey="amount" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {years.length > 0 && (
          <Card title="Dividend Growth">
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendGrowthData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} width={80} />
                  <Tooltip formatter={(v, name) => [formatCurrency(Number(v)), String(name)]} />
                  <Legend />
                  {years.map((year, idx) => (
                    <Bar key={year} dataKey={String(year)} fill={PALETTE[idx % PALETTE.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {yieldPayoutData.length > 0 && (
          <Card title="Yield / Payout">
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yieldPayoutData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="symbol"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} width={50} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Yield']} />
                  <Bar dataKey="yield" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Row 3 */}
      {diversificationData.length > 0 && (
        <Card title="Passive Income Diversification">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="h-64 w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diversificationData}
                    dataKey="value"
                    nameKey="symbol"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {diversificationData.map((entry, idx) => (
                      <Cell key={entry.symbol} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const pct = (item?.payload as { pct: number } | undefined)?.pct ?? 0;
                      return [`${pct.toFixed(1)}% (${formatCurrency(Number(value))})`, 'Share'];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 space-y-2 text-sm max-h-64 overflow-y-auto">
              {diversificationData.map((entry, idx) => (
                <div key={entry.symbol} className="flex items-center justify-between border-b border-border/50 pb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">{entry.symbol}</p>
                      <p className="text-[11px] text-text-secondary truncate">{entry.name}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-text-primary">{entry.pct.toFixed(1)}%</p>
                    <p className="text-[11px] text-text-secondary">{formatCurrency(entry.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
