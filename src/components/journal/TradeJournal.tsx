import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useTradingPlan } from '../../hooks/useTradingPlan';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useAppStore } from '../../stores/appStore';
import { formatProfitLoss, formatCurrency } from '../../utils/formatters';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import JournalFilters from './JournalFilters';
import InlineTradeRow from './InlineTradeRow';
import type { TradeJournalEntry } from '../../types/journal';
import { X } from 'lucide-react';

type SortField = keyof TradeJournalEntry;

function toDateInput(date: Date | undefined | null): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

export default function TradeJournal() {
  const { entries, filters, sortField, sortDirection, setSort, setFilters, summary, isLoading, deleteEntry, addEntry, updateEntry, totalCount, currentPage, setPage, stats, assignDefaultStrategies } = useJournal();
  const { plan } = useTradingPlan();
  const { portfolios } = usePortfolio();
  const activePlanId = useAppStore((s) => s.activePlanId);
  const addToast = useAppStore((s) => s.addToast);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'stockSymbol' | 'expirationDate' | 'strategyId'>('none');
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const totalPages = Math.max(1, Math.ceil(totalCount / 50));

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;
    await deleteEntry(deleteTargetId);
    setDeleteTargetId(null);
    addToast('Journal entry deleted', 'success');
  }, [deleteTargetId, deleteEntry, addToast]);

  const handleInlineSave = useCallback(async (entry: TradeJournalEntry) => {
    const id = await addEntry(entry);
    if (id) {
      addToast('Trade added', 'success');
    }
  }, [addEntry, addToast]);

  const strategies = useMemo(
    () => [...(plan?.coreStrategies ?? []), ...(plan?.speculativeStrategies ?? [])],
    [plan],
  );

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [entries, sortField, sortDirection]);

  // Group entries if groupBy is set
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, TradeJournalEntry[]>();
    for (const entry of sortedEntries) {
      let key: string;
      if (groupBy === 'stockSymbol') {
        key = entry.stockSymbol;
      } else if (groupBy === 'expirationDate') {
        key = entry.expirationDate ? new Date(entry.expirationDate).toISOString().split('T')[0] : 'No Expiration';
      } else {
        const strat = strategies.find((s) => s.id === entry.strategyId);
        key = strat?.name || entry.strategyId || 'Unassigned';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return Array.from(groups.entries())
      .map(([label, items]) => ({
        label,
        items,
        totalPL: items.reduce((s, e) => s + (e.profitLoss ?? 0), 0),
        count: items.length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sortedEntries, groupBy, strategies]);

  // Compute closed-trade stats (exclude open trades from P/L calculations)
  const closedStats = useMemo(() => {
    const winRate = stats.closedCount > 0 ? (stats.winCount / stats.closedCount) * 100 : 0;
    const avgPL = stats.closedCount > 0 ? stats.totalPL / stats.closedCount : 0;
    return { totalPL: stats.totalPL, avgPL, winRate, closedCount: stats.closedCount, monthlyPL: stats.monthlyPL, yearlyPL: stats.yearlyPL };
  }, [stats]);

  // Unique symbols for filter dropdown
  const uniqueSymbols = useMemo(() => {
    const syms = new Set<string>();
    entries.forEach((e) => { if (e.stockSymbol) syms.add(e.stockSymbol); });
    return Array.from(syms).sort();
  }, [entries]);

  // Monthly stats for the performance banner — always based on current month, independent of status filter
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    // Use all entries on the current page (they're already filtered by plan)
    // Filter to current month based on open date
    const monthEntries = entries.filter((e) => {
      const d = e.openDate ? new Date(e.openDate) : null;
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const openTrades = monthEntries.filter((e) => e.tradeStatus === 'Open').length;
    // Closed = everything that is NOT open (Closed, Expired, Assigned)
    const closedMonth = monthEntries.filter((e) => e.tradeStatus !== 'Open');
    const wins = closedMonth.filter((e) => e.winLoss === 'Win').length;
    const winRate = closedMonth.length > 0 ? (wins / closedMonth.length) * 100 : 0;

    const weeklyIncome = entries
      .filter((e) => {
        const cd = e.closeDate ? new Date(e.closeDate) : null;
        return cd && cd >= currentWeekStart && e.profitLoss != null && e.tradeStatus !== 'Open';
      })
      .reduce((sum, e) => sum + (e.profitLoss ?? 0), 0);

    // Total premium received = sum of (premium * contracts * 100) for NOT open trades this month
    const totalPremiumReceived = closedMonth.reduce(
      (sum, e) => sum + Math.abs(e.premium ?? 0) * (e.contracts ?? 1) * 100,
      0,
    );

    // Total premium kept = sum of P/L for NOT open trades this month
    const totalPremiumKept = closedMonth.reduce((sum, e) => sum + (e.profitLoss ?? 0), 0);
    const premiumKeptPct = totalPremiumReceived > 0 ? (totalPremiumKept / totalPremiumReceived) * 100 : 0;

    return { totalTrades: monthEntries.length, openTrades, winRate, weeklyIncome, totalPremiumReceived, totalPremiumKept, premiumKeptPct };
  }, [entries]);

  const handleAssignStrategies = useCallback(async () => {
    const shortPut = strategies.find((s) => s.name.toLowerCase().includes('short put'));
    const shortCall = strategies.find((s) => s.name.toLowerCase().includes('short call'));
    const leap = strategies.find((s) => s.name.toLowerCase().includes('leap'));
    if (!shortPut) {
      addToast('No "Short Put" strategy found in plan. Create it first.', 'error');
      return;
    }
    await assignDefaultStrategies(shortPut.id, shortCall?.id || '', leap?.id || '');
  }, [strategies, assignDefaultStrategies, addToast]);

  // Debounced save for inline edits
  const saveField = useCallback((entryId: string, field: string, value: string, entry: TradeJournalEntry) => {
    const key = `${entryId}-${field}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      debounceTimers.current.delete(key);
      const now = new Date();
      const changes: Partial<TradeJournalEntry> = {};

      switch (field) {
        case 'stockSymbol': changes.stockSymbol = value.toUpperCase(); break;
        case 'campaign': changes.campaign = value; break;
        case 'openDate': changes.openDate = value ? new Date(value + 'T12:00:00') : undefined; break;
        case 'expirationDate': changes.expirationDate = value ? new Date(value + 'T12:00:00') : undefined; break;
        case 'optionType': changes.optionType = value as TradeJournalEntry['optionType']; break;
        case 'direction': changes.direction = value as TradeJournalEntry['direction']; break;
        case 'stockPriceDOC': changes.stockPriceDOC = Number(value) || 0; break;
        case 'strikePrice': changes.strikePrice = Number(value) || 0; break;
        case 'premium': changes.premium = Number(value) || 0; break;
        case 'contracts': changes.contracts = Number(value) || 1; break;
        case 'cashReserve': changes.cashReserve = Number(value) || 0; break;
        case 'marginCashReserve': changes.marginCashReserve = value ? Number(value) : undefined; break;
        case 'exitPrice': changes.exitPrice = value !== '' ? Number(value) : undefined; break;
        case 'closeDate': changes.closeDate = value ? new Date(value + 'T12:00:00') : undefined; break;
        case 'tradeStatus': changes.tradeStatus = value as TradeJournalEntry['tradeStatus']; break;
        case 'strategyId': changes.strategyId = value; break;
        case 'currentStockPrice': changes.currentStockPrice = value ? Number(value) : undefined; break;
        default: return;
      }

      const openDate = changes.openDate ?? entry.openDate;
      const expirationDate = changes.expirationDate ?? entry.expirationDate;
      const closeDate = changes.closeDate !== undefined ? changes.closeDate : entry.closeDate;
      const exitPrice = changes.exitPrice !== undefined ? changes.exitPrice : entry.exitPrice;
      const premium = changes.premium ?? entry.premium;
      const strikePrice = changes.strikePrice ?? entry.strikePrice;
      const contracts = changes.contracts ?? entry.contracts ?? 1;

      if (expirationDate) {
        changes.dte = Math.max(0, Math.round((new Date(expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
      if (openDate) {
        changes.ditc = Math.max(0, Math.round((now.getTime() - new Date(openDate).getTime()) / (1000 * 60 * 60 * 24)));
      }
      // Margin Reserve = 20% of (Strike * 100) — only auto-calc if not manually set
      if (strikePrice && field !== 'marginCashReserve') {
        // Only auto-fill if current value looks like it was auto-calculated (or is empty)
        const currentMargin = entry.marginCashReserve;
        const autoCalcValue = (entry.strikePrice ?? 0) * 100 * 0.20;
        if (!currentMargin || Math.abs(currentMargin - autoCalcValue) < 1) {
          changes.marginCashReserve = strikePrice * 100 * 0.20;
        }
      }
      if (closeDate && openDate) {
        changes.daysHeld = Math.round((new Date(closeDate).getTime() - new Date(openDate).getTime()) / (1000 * 60 * 60 * 24));
      }
      // Only calculate P/L for non-open trades (user must manually change status to Closed)
      const effectiveStatus = changes.tradeStatus ?? entry.tradeStatus;
      if (exitPrice != null && effectiveStatus !== 'Open') {
        // Credit trades (premium >= 0): P/L = (Premium - Exit) × 100 × Contracts
        // Debit trades (premium < 0): P/L = (Premium + Exit) × 100 × Contracts
        changes.profitLoss = premium < 0
          ? (premium + exitPrice) * 100 * contracts
          : (premium - exitPrice) * 100 * contracts;
        changes.winLoss = changes.profitLoss > 0 ? 'Win' : 'Loss';
      }

      // Auto-assign strategy for older records based on rules
      const optionType = changes.optionType ?? entry.optionType;
      const direction = changes.direction ?? entry.direction;
      const currentDte = changes.dte ?? entry.dte ?? 0;
      if (field === 'optionType' || field === 'direction' || field === 'expirationDate' || field === 'premium') {
        const shortPut = strategies.find((s) => s.name.toLowerCase().includes('short put'));
        const shortCall = strategies.find((s) => s.name.toLowerCase().includes('short call'));
        const leap = strategies.find((s) => s.name.toLowerCase().includes('leap'));
        const doubleCalendar = strategies.find((s) => s.name.toLowerCase().includes('double calendar'));
        if (premium < 0 && doubleCalendar) {
          changes.strategyId = doubleCalendar.id;
        } else if (currentDte > 150 && leap) {
          changes.strategyId = leap.id;
        } else if (optionType === 'Call' && direction === 'Sell' && shortCall) {
          changes.strategyId = shortCall.id;
        } else if (optionType === 'Put' && direction === 'Sell' && shortPut) {
          changes.strategyId = shortPut.id;
        }
      }

      const cashReserve = changes.cashReserve ?? entry.cashReserve;
      const marginReserve = changes.marginCashReserve ?? entry.marginCashReserve ?? (strikePrice * 100 * 0.20);

      if (exitPrice != null && closeDate && openDate) {
        const daysHeld = Math.max(1, Math.round((new Date(closeDate).getTime() - new Date(openDate).getTime()) / (1000 * 60 * 60 * 24)));
        const pl = premium < 0
          ? (premium + exitPrice) * 100 * contracts
          : (premium - exitPrice) * 100 * contracts;
        if (cashReserve > 0) changes.annualizedROR = (pl / cashReserve) * (365 / daysHeld) * 100;
        if (marginReserve > 0) changes.marginAnnualizedROR = (pl / marginReserve) * (365 / daysHeld) * 100;
      } else if (premium && expirationDate && openDate) {
        const dte = Math.max(1, Math.round((new Date(expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const potentialPL = premium * 100 * contracts;
        if (cashReserve > 0) changes.annualizedROR = (potentialPL / cashReserve) * (365 / dte) * 100;
        if (marginReserve > 0) changes.marginAnnualizedROR = (potentialPL / marginReserve) * (365 / dte) * 100;
      }

      await updateEntry(entryId, changes);
    }, 800);

    debounceTimers.current.set(key, timer);
  }, [updateEntry]);

  function handleSort(field: SortField) {
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    setSort(field, newDirection);
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  if (isLoading) {
    return <div className="p-6 text-center text-text-secondary">Loading journal entries…</div>;
  }

  const ic = 'w-full bg-transparent border-0 border-b border-transparent focus:border-text-accent focus:outline-none text-xs px-1 py-1.5 text-text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
  const sc = 'w-full bg-transparent border-0 border-b border-transparent focus:border-text-accent focus:outline-none text-xs py-1.5 text-text-primary';

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();

  return (
    <div className="space-y-4">
      {/* Monthly Performance Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">{monthName} Trades</p>
          <p className="text-lg font-bold text-text-primary">{monthlyStats.totalTrades}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Open Trades</p>
          <p className="text-lg font-bold text-text-primary">{monthlyStats.openTrades}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Win Rate</p>
          <p className="text-lg font-bold text-text-primary">{monthlyStats.winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Weekly Income</p>
          <p className={`text-lg font-bold ${monthlyStats.weeklyIncome >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(monthlyStats.weeklyIncome)}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Premium Received</p>
          <p className="text-lg font-bold text-success">{formatCurrency(monthlyStats.totalPremiumReceived)}</p>
        </div>
        <div className="bg-surface-tertiary rounded-lg p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase">Premium Kept ({monthlyStats.premiumKeptPct.toFixed(0)}%)</p>
          <p className={`text-lg font-bold ${monthlyStats.totalPremiumKept >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(monthlyStats.totalPremiumKept)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Trade Journal</h2>
        <div className="flex items-center gap-2">
          <select
            className="px-2 py-1 text-xs border border-border rounded bg-transparent text-text-primary"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
          >
            <option value="none">No Grouping</option>
            <option value="stockSymbol">Group by Symbol</option>
            <option value="expirationDate">Group by Expiration</option>
            <option value="strategyId">Group by Strategy</option>
          </select>
          <Button size="sm" variant="secondary" onClick={handleAssignStrategies}>
            Assign Strategies
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowInlineAdd(true)} disabled={!activePlanId || showInlineAdd}>
            + Add Row
          </Button>
        </div>
      </div>

      <JournalFilters
        strategies={strategies}
        symbols={uniqueSymbols}
        filters={filters}
        onFilterChange={setFilters}
      />

      {sortedEntries.length === 0 && !showInlineAdd ? (
        <p className="py-8 text-center text-sm text-text-secondary">No trades found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-xs" style={{ tableLayout: 'auto' }}>
            <thead className="bg-surface-tertiary sticky top-0">
              <tr>
                <th className="px-1 py-2" style={{ width: 24 }} />
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('stockSymbol')}>Symbol{sortIndicator('stockSymbol')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('campaign')}>Campaign{sortIndicator('campaign')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('openDate')}>Open{sortIndicator('openDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('expirationDate')}>Exp{sortIndicator('expirationDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" style={{ minWidth: 100 }} onClick={() => handleSort('strategyId')}>Strategy{sortIndicator('strategyId')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('strikePrice')}>Strike{sortIndicator('strikePrice')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('premium')}>Premium{sortIndicator('premium')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('contracts')}>#{ sortIndicator('contracts')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('cashReserve')}>Cash Res{sortIndicator('cashReserve')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('marginCashReserve')}>Margin Res{sortIndicator('marginCashReserve')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('exitPrice')}>Exit{sortIndicator('exitPrice')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('closeDate')}>Close{sortIndicator('closeDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('dte')}>DTE{sortIndicator('dte')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('ditc')}>DIT{sortIndicator('ditc')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('profitLoss')}>P/L{sortIndicator('profitLoss')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('winLoss')}>W/L{sortIndicator('winLoss')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('daysHeld')}>Days{sortIndicator('daysHeld')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('annualizedROR')}>Ann ROR{sortIndicator('annualizedROR')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('marginAnnualizedROR')}>Margin ROR{sortIndicator('marginAnnualizedROR')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('tradeStatus')}>Status{sortIndicator('tradeStatus')}</th>
              </tr>
            </thead>
            <tbody className="bg-surface-secondary divide-y divide-border">
              {showInlineAdd && activePlanId && (
                <InlineTradeRow
                  strategies={strategies}
                  portfolios={portfolios}
                  planId={activePlanId}
                  onSave={handleInlineSave}
                  onCancel={() => setShowInlineAdd(false)}
                />
              )}
              {groupedData ? (
                groupedData.map((group) => (
                  <React.Fragment key={group.label}>
                    <tr className="bg-surface-tertiary/70">
                      <td colSpan={22} className="px-2 py-1.5 text-xs font-bold text-text-primary">
                        {group.label} <span className="font-normal text-text-secondary ml-2">({group.count} trades, P/L: <span className={group.totalPL >= 0 ? 'text-success' : 'text-error'}>{formatProfitLoss(group.totalPL)}</span>)</span>
                      </td>
                    </tr>
                    {group.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-tertiary group">
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error transition-opacity p-0.5 rounded"
                      onClick={() => setDeleteTargetId(entry.id)}
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </td>
                  <td className="px-2 py-1"><input className={ic + ' w-14 font-medium'} defaultValue={entry.stockSymbol} onBlur={(e) => saveField(entry.id, 'stockSymbol', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input className={ic + ' w-20'} defaultValue={entry.campaign || ''} onBlur={(e) => saveField(entry.id, 'campaign', e.target.value, entry)} placeholder="" /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.openDate)} onBlur={(e) => saveField(entry.id, 'openDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.expirationDate)} onBlur={(e) => saveField(entry.id, 'expirationDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1" style={{ minWidth: 100 }}><select className={sc} defaultValue={entry.strategyId} onChange={(e) => saveField(entry.id, 'strategyId', e.target.value, entry)}><option value="">—</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.strikePrice || ''} onBlur={(e) => saveField(entry.id, 'strikePrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.premium || ''} onBlur={(e) => saveField(entry.id, 'premium', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" className={ic + ' w-8'} defaultValue={entry.contracts || 1} onBlur={(e) => saveField(entry.id, 'contracts', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.cashReserve || ''} onBlur={(e) => saveField(entry.id, 'cashReserve', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.marginCashReserve ?? ''} onBlur={(e) => saveField(entry.id, 'marginCashReserve', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.exitPrice ?? ''} onBlur={(e) => saveField(entry.id, 'exitPrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.closeDate)} onBlur={(e) => saveField(entry.id, 'closeDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1 text-text-secondary">{entry.dte || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.ditc || '—'}</td>
                  <td className={`px-2 py-1 font-medium ${(entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{entry.profitLoss != null ? formatProfitLoss(entry.profitLoss) : '—'}</td>
                  <td className={`px-2 py-1 font-medium ${entry.winLoss === 'Win' ? 'text-success' : entry.winLoss === 'Loss' ? 'text-error' : ''}`}>{entry.winLoss || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.daysHeld ?? '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.annualizedROR != null ? `${entry.annualizedROR.toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.marginAnnualizedROR != null ? `${entry.marginAnnualizedROR.toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1"><select className={sc + ' w-18'} defaultValue={entry.tradeStatus} onChange={(e) => saveField(entry.id, 'tradeStatus', e.target.value, entry)}><option value="Open">Open</option><option value="Closed">Closed</option><option value="Expired">Expired</option><option value="Assigned">Assigned</option></select></td>
                </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                sortedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-surface-tertiary group">
                  <td className="px-1 py-1">
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error transition-opacity p-0.5 rounded" onClick={() => setDeleteTargetId(entry.id)} title="Delete"><X size={12} /></button>
                  </td>
                  <td className="px-2 py-1"><input className={ic + ' w-14 font-medium'} defaultValue={entry.stockSymbol} onBlur={(e) => saveField(entry.id, 'stockSymbol', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input className={ic + ' w-20'} defaultValue={entry.campaign || ''} onBlur={(e) => saveField(entry.id, 'campaign', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.openDate)} onBlur={(e) => saveField(entry.id, 'openDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.expirationDate)} onBlur={(e) => saveField(entry.id, 'expirationDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1" style={{ minWidth: 100 }}><select className={sc} defaultValue={entry.strategyId} onChange={(e) => saveField(entry.id, 'strategyId', e.target.value, entry)}><option value="">—</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.strikePrice || ''} onBlur={(e) => saveField(entry.id, 'strikePrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.premium || ''} onBlur={(e) => saveField(entry.id, 'premium', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" className={ic + ' w-8'} defaultValue={entry.contracts || 1} onBlur={(e) => saveField(entry.id, 'contracts', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.cashReserve || ''} onBlur={(e) => saveField(entry.id, 'cashReserve', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.marginCashReserve ?? ''} onBlur={(e) => saveField(entry.id, 'marginCashReserve', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.exitPrice ?? ''} onBlur={(e) => saveField(entry.id, 'exitPrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.closeDate)} onBlur={(e) => saveField(entry.id, 'closeDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1 text-text-secondary">{entry.dte || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.ditc || '—'}</td>
                  <td className={`px-2 py-1 font-medium ${(entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{entry.profitLoss != null ? formatProfitLoss(entry.profitLoss) : '—'}</td>
                  <td className={`px-2 py-1 font-medium ${entry.winLoss === 'Win' ? 'text-success' : entry.winLoss === 'Loss' ? 'text-error' : ''}`}>{entry.winLoss || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.daysHeld ?? '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.annualizedROR != null ? `${entry.annualizedROR.toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.marginAnnualizedROR != null ? `${entry.marginAnnualizedROR.toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1"><select className={sc + ' w-18'} defaultValue={entry.tradeStatus} onChange={(e) => saveField(entry.id, 'tradeStatus', e.target.value, entry)}><option value="Open">Open</option><option value="Closed">Closed</option><option value="Expired">Expired</option><option value="Assigned">Assigned</option></select></td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-text-secondary">
            Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
            >
              Prev
            </button>
            <span className="text-xs text-text-secondary px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
