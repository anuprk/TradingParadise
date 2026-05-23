import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency, formatProfitLoss } from '../../utils/formatters';
import { fetchStockQuotes, type StockQuote } from '../../utils/stockPrice';
import { getHoldings, upsertHolding, updateHoldingField, bulkUpdatePrices, type PortfolioHolding } from '../../db/holdingsRepository';
import { useColumnResize } from '../../hooks/useColumnResize';
import Button from '../ui/Button';
import { Plus, X } from 'lucide-react';

interface HoldingsTabProps {
  portfolioId: string;
}

export default function HoldingsTab({ portfolioId }: HoldingsTabProps) {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load holdings from DB
  useEffect(() => {
    if (!portfolioId) return;
    setIsLoading(true);
    getHoldings(portfolioId)
      .then(setHoldings)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [portfolioId]);

  // Fetch live prices
  const refreshPrices = useCallback(async () => {
    if (holdings.length === 0) return;
    setIsRefreshing(true);
    try {
      const symbols = holdings.map((h) => h.symbol);
      const result = await fetchStockQuotes(symbols);
      if (result.size > 0) {
        setQuotes(result);
        // Save prices to DB
        const prices: Record<string, number> = {};
        for (const [sym, q] of result) { if (q.price > 0) prices[sym] = q.price; }
        await bulkUpdatePrices(portfolioId, prices);
        // Update local state
        setHoldings((prev) => prev.map((h) => {
          const p = prices[h.symbol];
          return p ? { ...h, currentPrice: p } : h;
        }));
      }
    } catch {}
    setIsRefreshing(false);
  }, [holdings, portfolioId]);

  useEffect(() => { if (holdings.length > 0) refreshPrices(); }, [holdings.length]); // eslint-disable-line

  // Debounced field update
  const saveField = useCallback((symbol: string, field: 'quantity' | 'avgCost' | 'currentPrice' | 'dividendFrequency' | 'dividendYield', value: number | string | null) => {
    // Update local state immediately
    setHoldings((prev) => prev.map((h) => h.symbol === symbol ? { ...h, [field]: value } : h));

    const key = `${symbol}-${field}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      debounceTimers.current.delete(key);
      await updateHoldingField(portfolioId, symbol, field, value).catch(() => {});
    }, 600);
    debounceTimers.current.set(key, timer);
  }, [portfolioId]);

  // Add new holding
  const addHolding = useCallback(async () => {
    if (!newSymbol.trim()) return;
    const symbol = newSymbol.trim().toUpperCase();
    if (holdings.some((h) => h.symbol === symbol)) { setNewSymbol(''); return; }
    await upsertHolding(portfolioId, symbol, { quantity: 0, avgCost: 0, dividendFrequency: 'monthly' });
    setHoldings((prev) => [...prev, { id: '', portfolioId, symbol, quantity: 0, avgCost: 0, currentPrice: null, dividendFrequency: 'monthly', createdAt: new Date(), updatedAt: new Date() }]);
    setNewSymbol('');
  }, [newSymbol, portfolioId, holdings]);

  // Delete holding
  const removeHolding = useCallback(async (symbol: string) => {
    const { deleteHolding: del } = await import('../../db/holdingsRepository');
    await del(portfolioId, symbol);
    setHoldings((prev) => prev.filter((h) => h.symbol !== symbol));
  }, [portfolioId]);

  // Buy/Sell trade action
  const [tradeAction, setTradeAction] = useState<{ symbol: string; type: 'buy' | 'sell' } | null>(null);
  const [tradeQty, setTradeQty] = useState('');
  const [tradePrice, setTradePrice] = useState('');

  const executeTrade = useCallback(async () => {
    if (!tradeAction || !tradeQty) return;
    const qty = Number(tradeQty);
    const price = Number(tradePrice);
    if (qty <= 0 || price <= 0) return;

    const holding = holdings.find((h) => h.symbol === tradeAction.symbol);
    if (!holding) return;

    let newQty: number;
    let newAvgCost: number;

    if (tradeAction.type === 'buy') {
      const totalOldCost = holding.quantity * holding.avgCost;
      const totalNewCost = qty * price;
      newQty = holding.quantity + qty;
      newAvgCost = newQty > 0 ? (totalOldCost + totalNewCost) / newQty : 0;
    } else {
      newQty = Math.max(0, holding.quantity - qty);
      newAvgCost = holding.avgCost; // avg cost doesn't change on sell
    }

    await updateHoldingField(portfolioId, tradeAction.symbol, 'quantity', newQty);
    await updateHoldingField(portfolioId, tradeAction.symbol, 'avgCost', newAvgCost);
    setHoldings((prev) => prev.map((h) => h.symbol === tradeAction.symbol ? { ...h, quantity: newQty, avgCost: newAvgCost } : h));
    setTradeAction(null);
    setTradeQty('');
    setTradePrice('');
  }, [tradeAction, tradeQty, tradePrice, holdings, portfolioId]);

  // Sorting
  const [sortField, setSortField] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const sortIndicator = (field: string) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  // Column resize (14 columns: action + 13 data columns)
  const { widths: colWidths, onMouseDown: onColResize } = useColumnResize(14, 70);

  // Filter: only show holdings with qty > 0
  const visibleHoldings = useMemo(() => {
    const filtered = holdings.filter((h) => h.quantity > 0);
    return [...filtered].sort((a, b) => {
      const quotes2 = quotes;
      let aVal: number | string = '';
      let bVal: number | string = '';
      const aPrice = a.currentPrice ?? 0;
      const bPrice = b.currentPrice ?? 0;
      const aDivYield = a.dividendYield ?? quotes2.get(a.symbol)?.dividendYield ?? 0;
      const bDivYield = b.dividendYield ?? quotes2.get(b.symbol)?.dividendYield ?? 0;

      switch (sortField) {
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break;
        case 'quantity': aVal = a.quantity; bVal = b.quantity; break;
        case 'avgCost': aVal = a.avgCost; bVal = b.avgCost; break;
        case 'original': aVal = a.quantity * a.avgCost; bVal = b.quantity * b.avgCost; break;
        case 'price': aVal = aPrice; bVal = bPrice; break;
        case 'value': aVal = a.quantity * aPrice; bVal = b.quantity * bPrice; break;
        case 'pct': { const totalVal = filtered.reduce((s, h2) => s + h2.quantity * (h2.currentPrice ?? 0), 0); aVal = totalVal > 0 ? (a.quantity * aPrice) / totalVal : 0; bVal = totalVal > 0 ? (b.quantity * bPrice) / totalVal : 0; break; }
        case 'pl': aVal = (a.quantity * aPrice) - (a.quantity * a.avgCost); bVal = (b.quantity * bPrice) - (b.quantity * b.avgCost); break;
        case 'plPct': { const aOrig = a.quantity * a.avgCost; const bOrig = b.quantity * b.avgCost; aVal = aOrig > 0 ? ((a.quantity * aPrice - aOrig) / aOrig) : 0; bVal = bOrig > 0 ? ((b.quantity * bPrice - bOrig) / bOrig) : 0; break; }
        case 'yield': aVal = aDivYield; bVal = bDivYield; break;
        case 'annDiv': aVal = aDivYield > 0 && aPrice > 0 ? (aDivYield / 100) * aPrice * a.quantity : 0; bVal = bDivYield > 0 && bPrice > 0 ? (bDivYield / 100) * bPrice * b.quantity : 0; break;
        case 'moDiv': aVal = aDivYield > 0 && aPrice > 0 ? (aDivYield / 100) * aPrice * a.quantity / 12 : 0; bVal = bDivYield > 0 && bPrice > 0 ? (bDivYield / 100) * bPrice * b.quantity / 12 : 0; break;
        default: aVal = a.symbol; bVal = b.symbol;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [holdings, sortField, sortDir, quotes]);

  // Compute totals
  const totals = useMemo(() => {
    let totalOriginal = 0, totalCurrent = 0, totalAnnualDiv = 0;
    for (const h of visibleHoldings) {
      const price = h.currentPrice ?? 0;
      totalOriginal += h.quantity * h.avgCost;
      totalCurrent += h.quantity * price;
      const divYield = h.dividendYield ?? quotes.get(h.symbol)?.dividendYield ?? 0;
      if (divYield > 0 && price > 0) totalAnnualDiv += (divYield / 100) * price * h.quantity;
    }
    const totalPL = totalCurrent - totalOriginal;
    const totalPLPct = totalOriginal > 0 ? (totalPL / totalOriginal) * 100 : 0;
    const monthlyDiv = totalAnnualDiv / 12;
    const portfolioYield = totalCurrent > 0 ? (totalAnnualDiv / totalCurrent) * 100 : 0;
    return { totalOriginal, totalCurrent, totalPL, totalPLPct, totalAnnualDiv, monthlyDiv, portfolioYield };
  }, [visibleHoldings, quotes]);

  if (isLoading) return <p className="text-sm text-text-secondary text-center py-4">Loading holdings...</p>;

  const ic = 'w-full bg-transparent border-0 border-b border-transparent focus:border-text-accent focus:outline-none text-[10px] px-0.5 py-1 text-text-primary text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1 mr-4">
          <div className="bg-surface-tertiary rounded p-2 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Value</p>
            <p className="text-sm font-bold text-text-primary">{formatCurrency(totals.totalCurrent)}</p>
          </div>
          <div className="bg-surface-tertiary rounded p-2 text-center">
            <p className="text-[10px] text-text-secondary uppercase">P/L</p>
            <p className={`text-sm font-bold ${totals.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(totals.totalPL)} ({totals.totalPLPct.toFixed(1)}%)</p>
          </div>
          <div className="bg-surface-tertiary rounded p-2 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Annual Div</p>
            <p className="text-sm font-bold text-success">{formatCurrency(totals.totalAnnualDiv)}</p>
          </div>
          <div className="bg-surface-tertiary rounded p-2 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Monthly Div</p>
            <p className="text-sm font-bold text-success">{formatCurrency(totals.monthlyDiv)}</p>
          </div>
          <div className="bg-surface-tertiary rounded p-2 text-center">
            <p className="text-[10px] text-text-secondary uppercase">Yield</p>
            <p className="text-sm font-bold text-success">{totals.portfolioYield.toFixed(2)}%</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={refreshPrices} disabled={isRefreshing}>
          {isRefreshing ? '...' : 'Refresh'}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-xs">
          <thead className="bg-surface-tertiary">
            <tr>
              <th className="px-1 py-2 w-6" />
              <th className="px-1 py-1.5 text-left font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('symbol')}>Symbol{sortIndicator('symbol')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('quantity')}>Qty{sortIndicator('quantity')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('avgCost')}>Avg Cost{sortIndicator('avgCost')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('original')}>Original{sortIndicator('original')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('price')}>Price{sortIndicator('price')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('value')}>Value{sortIndicator('value')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('pct')}>%{sortIndicator('pct')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('pl')}>P/L{sortIndicator('pl')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('plPct')}>P/L%{sortIndicator('plPct')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('yield')}>Yield{sortIndicator('yield')}</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('annDiv')}>Ann Div{sortIndicator('annDiv')}</th>
              <th className="px-1 py-1.5 text-center font-medium text-text-secondary uppercase text-[10px]">Freq</th>
              <th className="px-1 py-1.5 text-right font-medium text-text-secondary uppercase text-[10px] cursor-pointer" onClick={() => handleSort('moDiv')}>Mo Div{sortIndicator('moDiv')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleHoldings.map((h) => {
              const quote = quotes.get(h.symbol);
              const price = h.currentPrice ?? 0;
              const original = h.quantity * h.avgCost;
              const value = h.quantity * price;
              const pl = value - original;
              const plPct = original > 0 ? (pl / original) * 100 : 0;
              // Use user-set yield from DB, fallback to Yahoo
              const divYield = h.dividendYield ?? quote?.dividendYield ?? 0;
              // Calculate annual dividend from yield: yield% × price × qty / 100
              const annDiv = divYield > 0 && price > 0 ? (divYield / 100) * price * h.quantity : 0;
              const moDiv = annDiv / 12;

              return (
                <tr key={h.symbol} className="hover:bg-surface-tertiary group">
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-success hover:text-green-300 text-[9px] font-bold" onClick={() => setTradeAction({ symbol: h.symbol, type: 'buy' })} title="Buy more">B</button>
                      <button className="text-error hover:text-red-300 text-[9px] font-bold" onClick={() => setTradeAction({ symbol: h.symbol, type: 'sell' })} title="Sell">S</button>
                      <button className="text-text-secondary hover:text-error" onClick={() => removeHolding(h.symbol)} title="Delete"><X size={9} /></button>
                    </div>
                  </td>
                  <td className="px-1 py-1 font-medium text-text-primary">
                    {h.symbol}
                    {quote?.name && <span className="block text-[10px] text-text-secondary truncate max-w-[100px]">{quote.name}</span>}
                  </td>
                  <td className="px-1 py-1"><input type="number" className={ic + ' w-10'} value={h.quantity} onChange={(e) => saveField(h.symbol, 'quantity', Number(e.target.value) || 0)} /></td>
                  <td className="px-1 py-1"><input type="number" step="0.01" className={ic + ' w-10'} value={h.avgCost} onChange={(e) => saveField(h.symbol, 'avgCost', Number(e.target.value) || 0)} /></td>
                  <td className="px-1 py-1 text-right text-text-primary">{formatCurrency(original)}</td>
                  <td className="px-1 py-1"><input type="number" step="0.01" className={ic + ' w-10'} value={h.currentPrice ?? ''} onChange={(e) => saveField(h.symbol, 'currentPrice', Number(e.target.value) || null)} placeholder="0" /></td>
                  <td className="px-1 py-1 text-right text-text-primary">{formatCurrency(value)}</td>
                  <td className="px-1 py-1 text-right text-text-secondary">{totals.totalCurrent > 0 ? ((value / totals.totalCurrent) * 100).toFixed(1) + '%' : '—'}</td>
                  <td className={`px-1 py-1 text-right font-medium ${pl >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(pl)}</td>
                  <td className={`px-1 py-1 text-right ${plPct >= 0 ? 'text-success' : 'text-error'}`}>{plPct.toFixed(1)}%</td>
                  <td className="px-1 py-1 text-right"><input type="number" step="0.01" className={ic + ' w-10'} value={h.dividendYield ?? ''} onChange={(e) => saveField(h.symbol, 'dividendYield', e.target.value ? Number(e.target.value) : null)} placeholder="0" /></td>
                  <td className="px-1 py-1 text-right text-success">{annDiv > 0 ? formatCurrency(annDiv) : '—'}</td>
                  <td className="px-1 py-1 text-center">
                    <select
                      className="bg-transparent border-0 border-b border-transparent focus:border-text-accent focus:outline-none text-[10px] py-0.5 text-text-primary"
                      value={h.dividendFrequency}
                      onChange={(e) => saveField(h.symbol, 'dividendFrequency', e.target.value)}
                    >
                      <option value="monthly">M</option>
                      <option value="quarterly">Q</option>
                      <option value="yearly">Y</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 text-right text-success">{moDiv > 0 ? formatCurrency(moDiv) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          {visibleHoldings.length > 0 && (
            <tfoot>
              <tr className="bg-surface-tertiary border-t-2 border-border">
                <td className="px-2 py-2" />
                <td className="px-2 py-2 font-bold" colSpan={3}>Total</td>
                <td className="px-2 py-2 text-right font-bold">{formatCurrency(totals.totalOriginal)}</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right font-bold">{formatCurrency(totals.totalCurrent)}</td>
                <td className="px-2 py-2 text-right font-bold">100%</td>
                <td className={`px-2 py-2 text-right font-bold ${totals.totalPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(totals.totalPL)}</td>
                <td className={`px-2 py-2 text-right ${totals.totalPLPct >= 0 ? 'text-success' : 'text-error'}`}>{totals.totalPLPct.toFixed(1)}%</td>
                <td className="px-2 py-2 text-right text-success">{totals.portfolioYield.toFixed(1)}%</td>
                <td className="px-2 py-2 text-right font-bold text-success">{formatCurrency(totals.totalAnnualDiv)}</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right font-bold text-success">{formatCurrency(totals.monthlyDiv)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Trade action form */}
      {tradeAction && (
        <div className="mt-3 p-3 border border-border rounded-lg bg-surface-tertiary/30">
          <p className="text-xs font-medium text-text-primary mb-2">
            {tradeAction.type === 'buy' ? '🟢 Buy' : '🔴 Sell'} {tradeAction.symbol}
          </p>
          <div className="flex items-center gap-2">
            <input type="number" className="px-1 py-1 text-sm border border-border rounded bg-transparent text-text-primary w-20" placeholder="Qty" value={tradeQty} onChange={(e) => setTradeQty(e.target.value)} />
            <span className="text-xs text-text-secondary">@</span>
            <input type="number" step="0.01" className="px-1 py-1 text-sm border border-border rounded bg-transparent text-text-primary w-24" placeholder="Price" value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} />
            <Button size="sm" onClick={executeTrade} disabled={!tradeQty || !tradePrice}>
              {tradeAction.type === 'buy' ? 'Buy' : 'Sell'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setTradeAction(null); setTradeQty(''); setTradePrice(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Add holding */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          className="px-1 py-1 text-sm border border-border rounded bg-transparent text-text-primary w-24"
          placeholder="Symbol"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') addHolding(); }}
        />
        <Button size="sm" variant="secondary" onClick={addHolding} disabled={!newSymbol.trim()}>
          <Plus size={12} className="mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
