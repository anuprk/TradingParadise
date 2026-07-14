import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useTradingPlan } from '../../hooks/useTradingPlan';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useAppStore } from '../../stores/appStore';
import { getDistinctSymbols, filterJournalEntries } from '../../db/journalRepository';
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
  const { entries, filters, sortField, sortDirection, setSort, setFilters, isLoading, deleteEntry, addEntry, updateEntry, totalCount, currentPage, setPage } = useJournal();
  const { plan } = useTradingPlan();
  const { portfolios } = usePortfolio();
  const activePlanId = useAppStore((s) => s.activePlanId);
  const addToast = useAppStore((s) => s.addToast);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'stockSymbol' | 'expirationDate' | 'strategyId' | 'campaign'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
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
      setShowInlineAdd(false);
      setInsertAfterId(null);
    }
  }, [addEntry, addToast]);

  const handleDuplicate = useCallback(async (source: TradeJournalEntry) => {
    const now = new Date();
    const duplicate: TradeJournalEntry = {
      ...source,
      id: crypto.randomUUID(),
      exitPrice: undefined,
      closeDate: undefined,
      profitLoss: undefined,
      winLoss: null,
      daysHeld: undefined,
      tradeStatus: 'Open',
      createdAt: now,
      updatedAt: now,
    };
    const id = await addEntry(duplicate);
    if (id) addToast('Trade duplicated', 'success');
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
      } else if (groupBy === 'campaign') {
        key = entry.campaign || 'No Campaign';
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
        totalPremiumReceived: items.reduce((s, e) => s + (e.premium * (e.contracts || 1) * 100), 0),
        totalMarginRequired: items.reduce((s, e) => s + (e.marginCashReserve ?? 0), 0),
        count: items.length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sortedEntries, groupBy, strategies]);

  // All symbols ever traded for this plan (independent of filters)
  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  useEffect(() => {
    if (!activePlanId) return;
    let cancelled = false;
    getDistinctSymbols(activePlanId).then((syms) => {
      if (!cancelled) setAllSymbols(syms);
    });
    return () => { cancelled = true; };
  }, [activePlanId, entries]); // Re-fetch when entries change (new trade added)

  // Banner stats — always based on ALL open trades for this plan (independent of table filters)
  const [allOpenTrades, setAllOpenTrades] = useState<TradeJournalEntry[]>([]);
  useEffect(() => {
    if (!activePlanId) return;
    let cancelled = false;
    filterJournalEntries({ planId: activePlanId, tradeStatus: 'Open' }, 0, 500)
      .then(({ entries: openEntries }) => {
        if (!cancelled) setAllOpenTrades(openEntries);
      });
    return () => { cancelled = true; };
  }, [activePlanId, entries]); // Re-fetch when entries change

  // Closed trades this month (for monthly P/L in banner) - filter by close_date
  const [monthlyClosedPL, setMonthlyClosedPL] = useState(0);
  useEffect(() => {
    if (!activePlanId) return;
    let cancelled = false;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    import('../../lib/supabase').then(({ supabase }) => {
      supabase
        .from('journal_entries')
        .select('profit_loss')
        .eq('plan_id', activePlanId)
        .eq('trade_status', 'Closed')
        .gte('close_date', monthStart)
        .then(({ data }) => {
          if (!cancelled && data) {
            const pl = data.reduce((s: number, r: any) => s + (Number(r.profit_loss) || 0), 0);
            setMonthlyClosedPL(pl);
          }
        });
    });
    return () => { cancelled = true; };
  }, [activePlanId, entries]);

  const bannerStats = useMemo(() => {
    const totalMarginRequired = allOpenTrades.reduce((s, e) => s + (e.marginCashReserve ?? 0), 0);
    const totalOpenCount = allOpenTrades.length;
    return { totalMarginRequired, totalOpenCount, monthlyPL: monthlyClosedPL };
  }, [allOpenTrades, monthlyClosedPL]);

  // Debounced save for inline edits
  const saveField = useCallback((entryId: string, field: string, value: string, entry: TradeJournalEntry) => {
    const key = `${entryId}-${field}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);

    // Select fields save immediately, text/number fields debounce
    const delay = (field === 'strategyId' || field === 'tradeStatus' || field === 'optionType' || field === 'direction') ? 0 : 800;

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
        case 'exitPrice': changes.exitPrice = (value !== '' && value.trim() !== '') ? Number(value) : undefined; break;
        case 'closeDate': changes.closeDate = value ? new Date(value + 'T12:00:00') : undefined; break;
        case 'tradeStatus': changes.tradeStatus = value as TradeJournalEntry['tradeStatus']; break;
        case 'strategyId': changes.strategyId = value; break;
        case 'currentStockPrice': changes.currentStockPrice = value ? Number(value) : undefined; break;
        case 'notes': changes.notes = value; break;
        default: return;
      }

      const openDate = changes.openDate ?? entry.openDate;
      const expirationDate = changes.expirationDate ?? entry.expirationDate;
      const closeDate = changes.closeDate !== undefined ? changes.closeDate : entry.closeDate;
      // If user is editing exitPrice, use the new value (including undefined for cleared).
      // Otherwise fall back to existing entry value.
      const exitPrice = field === 'exitPrice' ? changes.exitPrice : (changes.exitPrice ?? entry.exitPrice);
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
          changes.marginCashReserve = Math.min(strikePrice * 100 * 0.20, 10000);
        }
      }
      if (closeDate && openDate) {
        changes.daysHeld = Math.round((new Date(closeDate).getTime() - new Date(openDate).getTime()) / (1000 * 60 * 60 * 24));
      }
      // Calculate P/L whenever exit price is available
      if (exitPrice != null) {
        const isStock = (entry.instrumentType ?? 'Option') === 'Stock';
        if (isStock) {
          const entryPrice = changes.stockPriceDOC ?? entry.stockPriceDOC ?? 0;
          const qty = entry.quantity ?? 0;
          const dir = changes.direction ?? entry.direction;
          const fees = entry.fees ?? 0;
          changes.profitLoss = dir === 'Buy'
            ? (exitPrice - entryPrice) * qty - fees
            : (entryPrice - exitPrice) * qty - fees;
        } else {
          // Credit trades (premium >= 0): P/L = (Premium - Exit) × 100 × Contracts
          // Debit trades (premium < 0): P/L = (Premium + Exit) × 100 × Contracts
          changes.profitLoss = premium < 0
            ? (premium + exitPrice) * 100 * contracts
            : (premium - exitPrice) * 100 * contracts;
        }
        changes.winLoss = changes.profitLoss > 0 ? 'Win' : 'Loss';
      } else if (field === 'exitPrice') {
        // Exit price was cleared — reset P/L and win/loss
        changes.profitLoss = undefined;
        changes.winLoss = null;
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
    }, delay);

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

  // Helper: determine if a trade is nearing expiration (within 7 days)
  function getRowClass(entry: TradeJournalEntry): string {
    if (entry.tradeStatus !== 'Open') return 'hover:bg-surface-tertiary group';
    const exp = entry.expirationDate ? new Date(entry.expirationDate) : null;
    if (!exp) return 'hover:bg-surface-tertiary group';
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7 && daysLeft >= 0) return 'hover:bg-surface-tertiary group bg-warning/10 border-l-2 border-l-warning';
    return 'hover:bg-surface-tertiary group';
  }

  return (
    <div className="space-y-4">
      {/* Open Positions Banner */}
      <div className="bg-surface-tertiary rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] text-text-secondary uppercase">Open Positions</p>
            <p className="text-lg font-bold text-text-primary">{bannerStats.totalOpenCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-text-secondary uppercase">Total Margin Req</p>
            <p className="text-lg font-bold text-text-primary">{formatCurrency(bannerStats.totalMarginRequired)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-text-secondary uppercase">This Month P/L</p>
            <p className={`text-lg font-bold ${bannerStats.monthlyPL >= 0 ? 'text-success' : 'text-error'}`}>{formatProfitLoss(bannerStats.monthlyPL)}</p>
          </div>
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
            <option value="campaign">Group by Campaign</option>
            <option value="expirationDate">Group by Expiration</option>
            <option value="strategyId">Group by Strategy</option>
          </select>
          {groupBy !== 'none' && (
            <>
              <button
                type="button"
                className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:text-text-primary"
                onClick={() => setCollapsedGroups(new Set(groupedData?.map((g) => g.label) ?? []))}
              >
                Collapse All
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:text-text-primary"
                onClick={() => setCollapsedGroups(new Set())}
              >
                Expand All
              </button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={() => setShowInlineAdd(true)} disabled={!activePlanId || showInlineAdd}>
            + Add Row
          </Button>
        </div>
      </div>

      <JournalFilters
        symbols={allSymbols}
        filters={filters}
        onFilterChange={setFilters}
      />

      {sortedEntries.length === 0 && !showInlineAdd ? (
        <p className="py-8 text-center text-sm text-text-secondary">No trades found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-xs" style={{ tableLayout: 'auto' }}>
            <thead className="bg-surface-tertiary sticky top-0">
              <tr className="[&>th]:resize-x [&>th]:overflow-hidden">
                <th className="px-1 py-2" style={{ width: 24 }} />
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('instrumentType')}>Type{sortIndicator('instrumentType')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('stockSymbol')}>Symbol{sortIndicator('stockSymbol')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('campaign')}>Campaign{sortIndicator('campaign')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('openDate')}>Open{sortIndicator('openDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('expirationDate')}>Exp{sortIndicator('expirationDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" style={{ minWidth: 100 }} onClick={() => handleSort('strategyId')}>Strategy{sortIndicator('strategyId')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('strikePrice')}>Strike{sortIndicator('strikePrice')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('premium')}>Premium{sortIndicator('premium')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer resize-x overflow-hidden" onClick={() => handleSort('contracts')}>#{ sortIndicator('contracts')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase resize-x overflow-hidden">Prem Rcvd</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer resize-x overflow-hidden" onClick={() => handleSort('exitPrice')}>Exit{sortIndicator('exitPrice')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('closeDate')}>Close{sortIndicator('closeDate')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase">Note</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('dte')}>DTE{sortIndicator('dte')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('ditc')}>DIT{sortIndicator('ditc')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('profitLoss')}>P/L{sortIndicator('profitLoss')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase">%Prem</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('winLoss')}>W/L{sortIndicator('winLoss')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('daysHeld')}>Days{sortIndicator('daysHeld')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('marginAnnualizedROR')}>Margin ROR{sortIndicator('marginAnnualizedROR')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('tradeStatus')}>Status{sortIndicator('tradeStatus')}</th>
                <th className="px-2 py-2 text-left font-medium text-text-secondary uppercase cursor-pointer" onClick={() => handleSort('marginCashReserve')}>Margin Res{sortIndicator('marginCashReserve')}</th>
              </tr>
            </thead>
            <tbody className="bg-surface-secondary divide-y divide-border">
              {showInlineAdd && activePlanId && !insertAfterId && (
                <InlineTradeRow
                  strategies={strategies}
                  portfolios={portfolios}
                  planId={activePlanId}
                  onSave={handleInlineSave}
                  onCancel={() => { setShowInlineAdd(false); setInsertAfterId(null); }}
                />
              )}
              {groupedData ? (
                groupedData.map((group) => (
                  <React.Fragment key={group.label}>
                    <tr
                      className="bg-surface-tertiary/70 cursor-pointer hover:bg-surface-tertiary"
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.label)) next.delete(group.label);
                          else next.add(group.label);
                          return next;
                        });
                      }}
                    >
                      <td colSpan={22} className="px-2 py-1.5 text-xs font-bold text-text-primary">
                        <span className="inline-block w-4 text-text-secondary">{collapsedGroups.has(group.label) ? '▶' : '▼'}</span>
                        {group.label} <span className="font-normal text-text-secondary ml-2">({group.count} trades, P/L: <span className={group.totalPL >= 0 ? 'text-success' : 'text-error'}>{formatProfitLoss(group.totalPL)}</span>, Prem Rcvd: {formatCurrency(group.totalPremiumReceived)}, Margin: {formatCurrency(group.totalMarginRequired)})</span>
                      </td>
                    </tr>
                    {!collapsedGroups.has(group.label) && group.items.map((entry) => (
                <React.Fragment key={entry.id}>
                <tr className={getRowClass(entry)}>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error transition-opacity p-0.5 rounded" onClick={() => setDeleteTargetId(entry.id)} title="Delete"><X size={12} /></button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary transition-opacity p-0.5 rounded ml-0.5" onClick={() => handleDuplicate(entry)} title="Duplicate">⧉</button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary transition-opacity p-0.5 rounded ml-0.5" onClick={() => { setInsertAfterId(entry.id); setShowInlineAdd(true); }} title="Insert below">+</button>
                  </td>
                  <td className="px-2 py-1"><span className={`text-xs px-1.5 py-0.5 rounded ${entry.instrumentType === 'Stock' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{entry.instrumentType === 'Stock' ? 'STK' : 'OPT'}</span></td>
                  <td className="px-2 py-1"><div className="flex items-center gap-1"><input className={ic + ' w-14 font-medium'} defaultValue={entry.stockSymbol} onBlur={(e) => saveField(entry.id, 'stockSymbol', e.target.value, entry)} /><a href={`https://finance.yahoo.com/quote/${entry.stockSymbol}/`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 text-text-accent hover:underline text-[10px]" title="Yahoo Finance">↗</a></div></td>
                  <td className="px-2 py-1"><input className={ic + ' w-20'} defaultValue={entry.campaign || ''} onBlur={(e) => saveField(entry.id, 'campaign', e.target.value, entry)} placeholder="" /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.openDate)} onBlur={(e) => saveField(entry.id, 'openDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.expirationDate)} onBlur={(e) => saveField(entry.id, 'expirationDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1" style={{ minWidth: 100 }}><select className={sc} defaultValue={entry.strategyId} onChange={(e) => saveField(entry.id, 'strategyId', e.target.value, entry)}><option value="">—</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.strikePrice || ''} onBlur={(e) => saveField(entry.id, 'strikePrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.premium || ''} onBlur={(e) => saveField(entry.id, 'premium', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" className={ic + ' w-8'} defaultValue={entry.contracts || 1} onBlur={(e) => saveField(entry.id, 'contracts', e.target.value, entry)} /></td>
                  <td className="px-2 py-1 text-right text-text-secondary">{formatCurrency(entry.premium * (entry.contracts || 1) * 100)}</td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.exitPrice ?? ''} onBlur={(e) => saveField(entry.id, 'exitPrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.closeDate)} onBlur={(e) => saveField(entry.id, 'closeDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input className={ic + ' w-24'} defaultValue={entry.notes || ''} onBlur={(e) => saveField(entry.id, 'notes', e.target.value, entry)} placeholder="Note..." title={entry.notes || ''} /></td>
                  <td className="px-2 py-1 text-text-secondary">{entry.dte || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.ditc || '—'}</td>
                  <td className={`px-2 py-1 font-medium ${(entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{entry.profitLoss != null ? formatProfitLoss(entry.profitLoss) : '—'}</td>
                  <td className={`px-2 py-1 ${entry.profitLoss != null && entry.premium ? (entry.profitLoss >= 0 ? 'text-success' : 'text-error') : 'text-text-secondary'}`}>{entry.profitLoss != null && entry.premium ? `${((entry.profitLoss / Math.abs(entry.premium * (entry.contracts || 1) * 100)) * 100).toFixed(1)}%` : '—'}</td>
                  <td className={`px-2 py-1 font-medium ${entry.winLoss === 'Win' ? 'text-success' : entry.winLoss === 'Loss' ? 'text-error' : ''}`}>{entry.winLoss || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.daysHeld ?? '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.marginAnnualizedROR != null ? `${Math.abs(entry.marginAnnualizedROR).toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1"><select className={sc + ' w-18'} defaultValue={entry.tradeStatus} onChange={(e) => saveField(entry.id, 'tradeStatus', e.target.value, entry)}><option value="Open">Open</option><option value="Closed">Closed</option><option value="Expired">Expired</option><option value="Assigned">Assigned</option></select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.marginCashReserve ?? ''} onBlur={(e) => saveField(entry.id, 'marginCashReserve', e.target.value, entry)} /></td>
                </tr>
                {showInlineAdd && insertAfterId === entry.id && activePlanId && (
                  <InlineTradeRow
                    strategies={strategies}
                    portfolios={portfolios}
                    planId={activePlanId}
                    onSave={handleInlineSave}
                    onCancel={() => { setShowInlineAdd(false); setInsertAfterId(null); }}
                  />
                )}
                </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                sortedEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                <tr className={getRowClass(entry)}>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error transition-opacity p-0.5 rounded" onClick={() => setDeleteTargetId(entry.id)} title="Delete"><X size={12} /></button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary transition-opacity p-0.5 rounded ml-0.5" onClick={() => handleDuplicate(entry)} title="Duplicate">⧉</button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary transition-opacity p-0.5 rounded ml-0.5" onClick={() => { setInsertAfterId(entry.id); setShowInlineAdd(true); }} title="Insert below">+</button>
                  </td>
                  <td className="px-2 py-1"><span className={`text-xs px-1.5 py-0.5 rounded ${entry.instrumentType === 'Stock' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{entry.instrumentType === 'Stock' ? 'STK' : 'OPT'}</span></td>
                  <td className="px-2 py-1"><div className="flex items-center gap-1"><input className={ic + ' w-14 font-medium'} defaultValue={entry.stockSymbol} onBlur={(e) => saveField(entry.id, 'stockSymbol', e.target.value, entry)} /><a href={`https://finance.yahoo.com/quote/${entry.stockSymbol}/`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 text-text-accent hover:underline text-[10px]" title="Yahoo Finance">↗</a></div></td>
                  <td className="px-2 py-1"><input className={ic + ' w-20'} defaultValue={entry.campaign || ''} onBlur={(e) => saveField(entry.id, 'campaign', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.openDate)} onBlur={(e) => saveField(entry.id, 'openDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.expirationDate)} onBlur={(e) => saveField(entry.id, 'expirationDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1" style={{ minWidth: 100 }}><select className={sc} defaultValue={entry.strategyId} onChange={(e) => saveField(entry.id, 'strategyId', e.target.value, entry)}><option value="">—</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.strikePrice || ''} onBlur={(e) => saveField(entry.id, 'strikePrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.premium || ''} onBlur={(e) => saveField(entry.id, 'premium', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="number" className={ic + ' w-8'} defaultValue={entry.contracts || 1} onBlur={(e) => saveField(entry.id, 'contracts', e.target.value, entry)} /></td>
                  <td className="px-2 py-1 text-right text-text-secondary">{formatCurrency(entry.premium * (entry.contracts || 1) * 100)}</td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-14'} defaultValue={entry.exitPrice ?? ''} onBlur={(e) => saveField(entry.id, 'exitPrice', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input type="date" className={ic + ' w-28'} defaultValue={toDateInput(entry.closeDate)} onBlur={(e) => saveField(entry.id, 'closeDate', e.target.value, entry)} /></td>
                  <td className="px-2 py-1"><input className={ic + ' w-24'} defaultValue={entry.notes || ''} onBlur={(e) => saveField(entry.id, 'notes', e.target.value, entry)} placeholder="Note..." title={entry.notes || ''} /></td>
                  <td className="px-2 py-1 text-text-secondary">{entry.dte || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.ditc || '—'}</td>
                  <td className={`px-2 py-1 font-medium ${(entry.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{entry.profitLoss != null ? formatProfitLoss(entry.profitLoss) : '—'}</td>
                  <td className={`px-2 py-1 ${entry.profitLoss != null && entry.premium ? (entry.profitLoss >= 0 ? 'text-success' : 'text-error') : 'text-text-secondary'}`}>{entry.profitLoss != null && entry.premium ? `${((entry.profitLoss / Math.abs(entry.premium * (entry.contracts || 1) * 100)) * 100).toFixed(1)}%` : '—'}</td>
                  <td className={`px-2 py-1 font-medium ${entry.winLoss === 'Win' ? 'text-success' : entry.winLoss === 'Loss' ? 'text-error' : ''}`}>{entry.winLoss || '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.daysHeld ?? '—'}</td>
                  <td className="px-2 py-1 text-text-secondary">{entry.marginAnnualizedROR != null ? `${Math.abs(entry.marginAnnualizedROR).toFixed(1)}%` : '—'}</td>
                  <td className="px-2 py-1"><select className={sc + ' w-18'} defaultValue={entry.tradeStatus} onChange={(e) => saveField(entry.id, 'tradeStatus', e.target.value, entry)}><option value="Open">Open</option><option value="Closed">Closed</option><option value="Expired">Expired</option><option value="Assigned">Assigned</option></select></td>
                  <td className="px-2 py-1"><input type="number" step="0.01" className={ic + ' w-16'} defaultValue={entry.marginCashReserve ?? ''} onBlur={(e) => saveField(entry.id, 'marginCashReserve', e.target.value, entry)} /></td>
                </tr>
                {showInlineAdd && insertAfterId === entry.id && activePlanId && (
                  <InlineTradeRow
                    strategies={strategies}
                    portfolios={portfolios}
                    planId={activePlanId}
                    onSave={handleInlineSave}
                    onCancel={() => { setShowInlineAdd(false); setInsertAfterId(null); }}
                  />
                )}
                </React.Fragment>
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
