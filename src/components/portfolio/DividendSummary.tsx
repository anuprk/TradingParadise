import { useMemo, useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { fetchStockQuotes, type StockQuote } from '../../utils/stockPrice';
import { getHoldings, type PortfolioHolding } from '../../db/holdingsRepository';
import { getTransactionsByPortfolioFiltered } from '../../db/transactionRepository';
import type { PortfolioTransaction } from '../../types/transaction';

interface DividendSummaryProps {
  portfolioId: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DividendSummary({ portfolioId }: DividendSummaryProps) {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [manualFreq, setManualFreq] = useState<Record<string, string>>({});
  const [actualDividends, setActualDividends] = useState<PortfolioTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load holdings from DB
  useEffect(() => {
    if (!portfolioId) return;
    getHoldings(portfolioId).then((h) => {
      setHoldings(h);
      // Build freq map from DB data
      const freqMap: Record<string, string> = {};
      for (const holding of h) freqMap[holding.symbol] = holding.dividendFrequency;
      setManualFreq(freqMap);
    }).catch(() => {});
  }, [portfolioId]);

  // Load actual dividend transactions
  useEffect(() => {
    if (!portfolioId) return;
    getTransactionsByPortfolioFiltered(portfolioId, { transactionType: 'Dividend' }, 0, 500)
      .then((txns) => setActualDividends(txns))
      .catch(() => {});
  }, [portfolioId]);

  const sortedHoldings = useMemo(
    () => holdings.filter((h) => h.quantity > 0).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [holdings],
  );

  const fetchDividendData = useCallback(async () => {
    if (sortedHoldings.length === 0) return;
    setIsLoading(true);
    try {
      const symbols = sortedHoldings.map((h) => h.symbol);
      const result = await fetchStockQuotes(symbols);
      if (result.size > 0) setQuotes(result);
    } catch {}
    setIsLoading(false);
  }, [sortedHoldings]);

  useEffect(() => { fetchDividendData(); }, [sortedHoldings.length]); // eslint-disable-line

  // Build projected dividend data
  const dividendHoldings = useMemo(() => {
    return sortedHoldings
      .map((h) => {
        const q = quotes.get(h.symbol);
        // Use user-set yield from DB, fallback to Yahoo
        const divYield = h.dividendYield ?? q?.dividendYield ?? 0;
        if (divYield <= 0) return null;
        const price = h.currentPrice ?? 0;
        const annualDiv = price > 0 ? (divYield / 100) * price * h.quantity : 0;
        if (annualDiv <= 0) return null;
        const freq = manualFreq[h.symbol] || q?.dividendFrequency || 'monthly';
        const monthlyDiv = annualDiv / 12;
        return { symbol: h.symbol, name: q?.name ?? h.symbol, qty: h.quantity, dividendRate: price > 0 ? (divYield / 100) * price : 0, annualDiv, monthlyDiv, freq, yield: divYield };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.annualDiv - a.annualDiv);
  }, [sortedHoldings, quotes, manualFreq]);

  // Totals
  const totals = useMemo(() => {
    const totalAnnual = dividendHoldings.reduce((s, d) => s + d.annualDiv, 0);
    const totalMonthly = totalAnnual / 12;
    return { totalAnnual, totalMonthly };
  }, [dividendHoldings]);

  // Monthly calendar: actual dividends for past/current months, projected for future
  const monthlyCalendar = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();

    // Build actual dividend map: symbol → month → total amount received
    const actualMap = new Map<string, Map<number, number>>();
    for (const txn of actualDividends) {
      const d = new Date(txn.transactionDate);
      if (d.getFullYear() !== currentYear) continue;
      const month = d.getMonth();
      if (!actualMap.has(txn.symbol)) actualMap.set(txn.symbol, new Map());
      const symMap = actualMap.get(txn.symbol)!;
      symMap.set(month, (symMap.get(month) || 0) + Math.abs(txn.amount));
    }

    // Get all symbols: union of projected holdings and symbols with actual dividends
    const allSymbols = new Set<string>();
    for (const d of dividendHoldings) allSymbols.add(d.symbol);
    for (const sym of actualMap.keys()) allSymbols.add(sym);

    const calendar: { symbol: string; months: number[]; total: number; freq: string; isActual: boolean[] }[] = [];
    const monthTotals = new Array(12).fill(0);

    for (const symbol of allSymbols) {
      const projected = dividendHoldings.find((d) => d.symbol === symbol);
      const actualSymMap = actualMap.get(symbol);
      const freq = projected?.freq || 'quarterly';
      const months = new Array(12).fill(0);
      const isActual = new Array(12).fill(false);

      for (let i = 0; i < 12; i++) {
        if (i <= currentMonth && actualSymMap?.has(i)) {
          // Past or current month: use actual received amount
          months[i] = actualSymMap.get(i)!;
          isActual[i] = true;
        } else if (i > currentMonth && projected) {
          // Future month: use projection
          if (freq === 'monthly' || freq === 'weekly') {
            months[i] = projected.annualDiv / 12;
          } else if (freq === 'quarterly') {
            if (i === 2 || i === 5 || i === 8 || i === 11) months[i] = projected.annualDiv / 4;
          } else {
            if (i === 11) months[i] = projected.annualDiv;
          }
        } else if (i <= currentMonth && !actualSymMap?.has(i) && projected) {
          // Past month with no actual data: show projected as fallback (dimmed)
          if (freq === 'monthly' || freq === 'weekly') {
            months[i] = projected.annualDiv / 12;
          } else if (freq === 'quarterly') {
            if (i === 2 || i === 5 || i === 8 || i === 11) months[i] = projected.annualDiv / 4;
          } else {
            if (i === 11) months[i] = projected.annualDiv;
          }
        }
        monthTotals[i] += months[i];
      }

      const total = months.reduce((s, v) => s + v, 0);
      if (total > 0) {
        calendar.push({ symbol, months, total, freq, isActual });
      }
    }

    calendar.sort((a, b) => b.total - a.total);
    return { calendar, monthTotals, grandTotal: monthTotals.reduce((s, v) => s + v, 0) };
  }, [dividendHoldings, actualDividends]);

  if (sortedHoldings.length === 0) {
    return <p className="text-sm text-text-secondary text-center py-4">No holdings to project dividends from.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
          <div className="bg-surface-tertiary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Projected Annual</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totals.totalAnnual)}</p>
          </div>
          <div className="bg-surface-tertiary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Projected Monthly</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totals.totalMonthly)}</p>
          </div>
          <div className="bg-surface-tertiary rounded-lg p-3 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Dividend Stocks</p>
            <p className="text-lg font-bold text-text-primary">{dividendHoldings.length}</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchDividendData} disabled={isLoading}>
          {isLoading ? '...' : 'Refresh'}
        </Button>
      </div>

      {/* Per-symbol breakdown */}
      {dividendHoldings.length > 0 && (
        <Card title="Projected Dividend Income">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-surface-tertiary">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary uppercase">Symbol</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary uppercase">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary uppercase">Div/Share</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary uppercase">Yield</th>
                  <th className="px-3 py-2 text-center font-medium text-text-secondary uppercase">Freq</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary uppercase">Monthly</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary uppercase">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dividendHoldings.map((d) => (
                  <tr key={d.symbol} className="hover:bg-surface-tertiary">
                    <td className="px-3 py-2 font-medium text-text-primary">{d.symbol}</td>
                    <td className="px-3 py-2 text-right text-text-primary">{d.qty}</td>
                    <td className="px-3 py-2 text-right text-text-primary">${d.dividendRate.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{d.yield.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        d.freq === 'weekly' || d.freq === 'monthly' ? 'bg-success/10 text-success' :
                        d.freq === 'quarterly' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>{d.freq}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-success">{formatCurrency(d.monthlyDiv)}</td>
                    <td className="px-3 py-2 text-right font-medium text-success">{formatCurrency(d.annualDiv)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-tertiary">
                <tr>
                  <td className="px-3 py-2 font-bold text-text-primary" colSpan={5}>Total</td>
                  <td className="px-3 py-2 text-right font-bold text-success">{formatCurrency(totals.totalMonthly)}</td>
                  <td className="px-3 py-2 text-right font-bold text-success">{formatCurrency(totals.totalAnnual)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Monthly Calendar */}
      {monthlyCalendar.calendar.length > 0 && (
        <Card title="Monthly Dividend Calendar">
          <p className="text-[10px] text-text-secondary mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-success mr-1 align-middle" /> Actual received
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1 ml-3 align-middle" /> Projected
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 px-2 text-left text-text-secondary font-medium sticky left-0 bg-surface-secondary z-10">Symbol</th>
                  <th className="py-1.5 px-2 text-center text-text-secondary font-medium">Freq</th>
                  {MONTHS.map((m) => <th key={m} className="py-1.5 px-2 text-right text-text-secondary font-medium">{m}</th>)}
                  <th className="py-1.5 px-2 text-right text-text-secondary font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyCalendar.calendar.map((row) => (
                  <tr key={row.symbol} className="border-b border-border/50 hover:bg-surface-tertiary">
                    <td className="py-1.5 px-2 font-medium text-text-primary sticky left-0 bg-surface-secondary">{row.symbol}</td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        row.freq === 'weekly' || row.freq === 'monthly' ? 'bg-success/10 text-success' :
                        row.freq === 'quarterly' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>{row.freq}</span>
                    </td>
                    {row.months.map((amt, idx) => (
                      <td key={idx} className={`py-1.5 px-2 text-right ${amt > 0 ? (row.isActual[idx] ? 'text-success font-medium' : 'text-blue-400') : ''}`}>
                        {amt > 0 ? `$${amt.toFixed(0)}` : ''}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 text-right font-bold text-success">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-tertiary">
                  <td className="py-2 px-2 font-bold sticky left-0 bg-surface-tertiary" colSpan={2}>Total</td>
                  {monthlyCalendar.monthTotals.map((mt, idx) => (
                    <td key={idx} className={`py-2 px-2 text-right font-bold ${mt > 0 ? 'text-success' : ''}`}>
                      {mt > 0 ? `$${mt.toFixed(0)}` : ''}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right font-bold text-success">{formatCurrency(monthlyCalendar.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {dividendHoldings.length === 0 && quotes.size > 0 && (
        <p className="text-sm text-text-secondary text-center py-4">None of your holdings pay dividends (based on Yahoo Finance data).</p>
      )}
    </div>
  );
}
