import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TradeJournalEntry, InstrumentType, OptionType, TradeDirection, TradeStatus } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';

interface InlineTradeRowProps {
  strategies: Strategy[];
  portfolios: Portfolio[];
  planId: string;
  onSave: (entry: TradeJournalEntry) => Promise<void>;
  onCancel: () => void;
}

interface InlineFormData {
  instrumentType: InstrumentType;
  stockSymbol: string;
  campaign: string;
  openDate: string;
  expirationDate: string;
  optionType: OptionType;
  direction: TradeDirection;
  stockPriceDOC: string;
  dte: string;
  ditc: string;
  currentStockPrice: string;
  breakEvenPrice: string;
  strikePrice: string;
  premium: string;
  contracts: string;
  quantity: string;
  cashReserve: string;
  marginCashReserve: string;
  fees: string;
  exitPrice: string;
  closeDate: string;
  profitLoss: string;
  winLoss: string;
  daysHeld: string;
  annualizedROR: string;
  marginAnnualizedROR: string;
  tradeStatus: TradeStatus;
  portfolioId: string;
  unrealizedPL: string;
  strategyId: string;
}

const emptyForm: InlineFormData = {
  instrumentType: 'Option',
  stockSymbol: '',
  campaign: '',
  openDate: '',
  expirationDate: '',
  optionType: 'Put',
  direction: 'Sell',
  stockPriceDOC: '',
  dte: '',
  ditc: '',
  currentStockPrice: '',
  breakEvenPrice: '',
  strikePrice: '',
  premium: '',
  contracts: '1',
  quantity: '',
  cashReserve: '',
  marginCashReserve: '',
  fees: '0',
  exitPrice: '',
  closeDate: '',
  profitLoss: '',
  winLoss: '',
  daysHeld: '',
  annualizedROR: '',
  marginAnnualizedROR: '',
  tradeStatus: 'Open',
  portfolioId: '',
  unrealizedPL: '',
  strategyId: '',
};

export default function InlineTradeRow({
  strategies,
  portfolios,
  planId,
  onSave,
  onCancel,
}: InlineTradeRowProps) {
  // Find default strategies by name
  const shortPutStrategy = strategies.find((s) => s.name.toLowerCase().includes('short put'));
  const shortCallStrategy = strategies.find((s) => s.name.toLowerCase().includes('short call'));
  const leapStrategy = strategies.find((s) => s.name.toLowerCase().includes('leap'));
  const doubleCalendarStrategy = strategies.find((s) => s.name.toLowerCase().includes('double calendar'));
  const defaultStrategyId = shortPutStrategy?.id || strategies[0]?.id || '';

  const [form, setForm] = useState<InlineFormData>({
    ...emptyForm,
    portfolioId: portfolios[0]?.id || '',
    strategyId: defaultStrategyId,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = useCallback((field: keyof InlineFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form],
  );

  const handleSubmit = async () => {
    const isStock = form.instrumentType === 'Stock';

    if (!form.stockSymbol.trim()) {
      setError('Symbol is required');
      return;
    }
    if (!form.openDate) {
      setError('Open date is required');
      return;
    }

    if (isStock) {
      if (!form.quantity || Number(form.quantity) <= 0) {
        setError('Number of shares is required');
        return;
      }
      if (!form.stockPriceDOC || Number(form.stockPriceDOC) <= 0) {
        setError('Entry price is required');
        return;
      }
    } else {
      if (!form.strikePrice || Number(form.strikePrice) <= 0) {
        setError('Strike price is required');
        return;
      }
      if (form.premium === '' || form.premium === undefined) {
        setError('Premium is required');
        return;
      }
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const openDate = new Date(form.openDate + 'T12:00:00');
      const expirationDate = form.expirationDate ? new Date(form.expirationDate + 'T12:00:00') : openDate;
      const closeDate = form.closeDate ? new Date(form.closeDate + 'T12:00:00') : undefined;
      const strikePrice = Number(form.strikePrice);
      const premium = Number(form.premium);
      const contracts = Number(form.contracts) || 1;
      const exitPrice = form.exitPrice !== '' ? Number(form.exitPrice) : undefined;

      // Auto-calculate DTE = Expiry Date - Current Date
      const dte = form.dte
        ? Number(form.dte)
        : Math.max(0, Math.round((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Auto-calculate DIT = Current Date - Open Date
      const ditc = form.ditc
        ? Number(form.ditc)
        : Math.max(0, Math.round((now.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Auto-calculate Margin Reserve = 20% of (Strike * 100), capped at 10000
      const marginCashReserve = form.marginCashReserve
        ? Number(form.marginCashReserve)
        : Math.min(strikePrice * 100 * 0.20, 10000);

      // Auto-calculate Days Held = Close Date - Open Date
      const daysHeld = form.daysHeld
        ? Number(form.daysHeld)
        : closeDate
          ? Math.round((closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

      // Auto-calculate P/L = (Premium - Exit Price) * 100 * contracts
      // If exit price is provided, treat as closed trade
      let tradeStatus = form.tradeStatus as TradeJournalEntry['tradeStatus'];

      let profitLoss: number | undefined = form.profitLoss ? Number(form.profitLoss) : undefined;
      if (profitLoss == null && exitPrice != null && tradeStatus !== 'Open') {
        // Credit trades (premium >= 0): P/L = (Premium - Exit) × 100 × Contracts
        // Debit trades (premium < 0): P/L = (Premium + Exit) × 100 × Contracts
        profitLoss = premium < 0
          ? (premium + exitPrice) * 100 * contracts
          : (premium - exitPrice) * 100 * contracts;
      }

      // Auto-calculate Win/Loss: Win if P/L > 0, otherwise Loss
      let winLoss: 'Win' | 'Loss' | null = form.winLoss === 'Win' ? 'Win' : form.winLoss === 'Loss' ? 'Loss' : null;
      if (!winLoss && profitLoss != null) {
        winLoss = profitLoss > 0 ? 'Win' : 'Loss';
      }

      const entry: TradeJournalEntry = {
        id: uuidv4(),
        instrumentType: form.instrumentType,
        stockSymbol: form.stockSymbol.trim().toUpperCase(),
        campaign: form.campaign.trim(),
        openDate,
        expirationDate,
        optionType: form.optionType,
        direction: form.direction,
        stockPriceDOC: Number(form.stockPriceDOC) || 0,
        dte,
        ditc,
        currentStockPrice: form.currentStockPrice ? Number(form.currentStockPrice) : undefined,
        breakEvenPrice: Number(form.breakEvenPrice) || 0,
        strikePrice: isStock ? 0 : strikePrice,
        premium: isStock ? 0 : premium,
        contracts: isStock ? 0 : contracts,
        quantity: isStock ? (Number(form.quantity) || 0) : 0,
        cashReserve: isStock ? (Number(form.stockPriceDOC) || 0) * (Number(form.quantity) || 0) : (Number(form.cashReserve) || 0),
        marginCashReserve,
        fees: Number(form.fees) || 0,
        exitPrice,
        closeDate,
        profitLoss: isStock
          ? (exitPrice != null ? (form.direction === 'Buy'
              ? (exitPrice - (Number(form.stockPriceDOC) || 0)) * (Number(form.quantity) || 0) - (Number(form.fees) || 0)
              : ((Number(form.stockPriceDOC) || 0) - exitPrice) * (Number(form.quantity) || 0) - (Number(form.fees) || 0))
            : profitLoss)
          : profitLoss,
        winLoss: (() => {
          const pl = isStock && exitPrice != null
            ? (form.direction === 'Buy'
                ? (exitPrice - (Number(form.stockPriceDOC) || 0)) * (Number(form.quantity) || 0) - (Number(form.fees) || 0)
                : ((Number(form.stockPriceDOC) || 0) - exitPrice) * (Number(form.quantity) || 0) - (Number(form.fees) || 0))
            : profitLoss;
          if (pl != null) return pl > 0 ? 'Win' : 'Loss';
          return winLoss;
        })(),
        daysHeld,
        annualizedROR: form.annualizedROR ? Number(form.annualizedROR) : undefined,
        marginAnnualizedROR: form.marginAnnualizedROR ? Number(form.marginAnnualizedROR) : undefined,
        tradeStatus,
        portfolioId: form.portfolioId || portfolios[0]?.id || undefined,
        strategyId: (() => {
          // Auto-assign strategy: Leap if DTE > 150, Short Call if Call+Sell, Double Calendar if premium < 0, else Short Put
          if (form.strategyId && form.strategyId !== defaultStrategyId) return form.strategyId;
          if (isStock) return form.strategyId || defaultStrategyId;
          if (premium < 0 && doubleCalendarStrategy) return doubleCalendarStrategy.id;
          if (dte > 150 && leapStrategy) return leapStrategy.id;
          if (form.optionType === 'Call' && form.direction === 'Sell' && shortCallStrategy) return shortCallStrategy.id;
          return defaultStrategyId;
        })(),
        planId,
        unrealizedPL: form.unrealizedPL ? Number(form.unrealizedPL) : undefined,
        notes: '',
        createdAt: now,
        updatedAt: now,
      };

      await onSave(entry);
      setForm({
        ...emptyForm,
        portfolioId: portfolios[0]?.id || '',
        strategyId: defaultStrategyId,
      });
      firstInputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full bg-transparent border-0 border-b border-border/50 focus:border-text-accent focus:outline-none text-xs px-1 py-1.5 text-text-primary placeholder:text-text-secondary/50';
  const selectClass =
    'w-full bg-transparent border-0 border-b border-border/50 focus:border-text-accent focus:outline-none text-xs px-0 py-1.5 text-text-primary';

  return (
    <>
      <tr className="bg-surface-tertiary/50 border-t-2 border-text-accent/30" onKeyDown={handleKeyDown}>
        {/* Save/Cancel */}
        <td className="px-1 py-1 whitespace-nowrap">
          <button type="button" className="text-success hover:text-green-300 text-xs font-medium disabled:opacity-50" onClick={handleSubmit} disabled={isSaving} tabIndex={0}>
            {isSaving ? '…' : '✓'}
          </button>
          <button type="button" className="text-text-secondary hover:text-text-primary text-xs font-medium ml-1" onClick={onCancel} tabIndex={0}>
            ✕
          </button>
        </td>
        {/* Instrument Type */}
        <td className="px-2 py-1">
          <select className={selectClass + ' w-16'} value={form.instrumentType} onChange={(e) => handleChange('instrumentType', e.target.value)} tabIndex={0}>
            <option value="Option">Option</option>
            <option value="Stock">Stock</option>
          </select>
        </td>
        {/* Symbol */}
        <td className="px-2 py-1">
          <input ref={firstInputRef} type="text" className={inputClass + ' w-14'} placeholder="AAPL" value={form.stockSymbol} onChange={(e) => handleChange('stockSymbol', e.target.value)} tabIndex={0} />
        </td>
        {/* Campaign */}
        <td className="px-2 py-1">
          <input type="text" className={inputClass + ' w-20'} placeholder="" value={form.campaign} onChange={(e) => handleChange('campaign', e.target.value)} tabIndex={0} />
        </td>
        {/* Open Date */}
        <td className="px-2 py-1">
          <input type="date" className={inputClass + ' w-28'} value={form.openDate} onChange={(e) => handleChange('openDate', e.target.value)} tabIndex={0} />
        </td>
        {/* Exp Date */}
        <td className="px-2 py-1">
          {form.instrumentType === 'Option' ? (
            <input type="date" className={inputClass + ' w-28'} value={form.expirationDate} onChange={(e) => handleChange('expirationDate', e.target.value)} tabIndex={0} />
          ) : (
            <span className="text-text-secondary text-xs">—</span>
          )}
        </td>
        {/* Strategy */}
        <td className="px-2 py-1" style={{ minWidth: 100 }}>
          <select className={selectClass} value={form.strategyId} onChange={(e) => handleChange('strategyId', e.target.value)} tabIndex={0}>
            {strategies.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </td>
        {/* Strike / Entry Price */}
        <td className="px-2 py-1">
          {form.instrumentType === 'Option' ? (
            <input type="number" step="0.01" className={inputClass + ' w-16'} placeholder="Strike" value={form.strikePrice} onChange={(e) => handleChange('strikePrice', e.target.value)} tabIndex={0} />
          ) : (
            <input type="number" step="0.01" className={inputClass + ' w-16'} placeholder="Entry$" value={form.stockPriceDOC} onChange={(e) => handleChange('stockPriceDOC', e.target.value)} tabIndex={0} />
          )}
        </td>
        {/* Premium / Quantity */}
        <td className="px-2 py-1">
          {form.instrumentType === 'Option' ? (
            <input type="number" step="0.01" className={inputClass + ' w-14'} placeholder="Prem" value={form.premium} onChange={(e) => handleChange('premium', e.target.value)} tabIndex={0} />
          ) : (
            <input type="number" step="1" className={inputClass + ' w-14'} placeholder="Shares" value={form.quantity} onChange={(e) => handleChange('quantity', e.target.value)} tabIndex={0} />
          )}
        </td>
        {/* Contracts / Direction */}
        <td className="px-2 py-1">
          {form.instrumentType === 'Option' ? (
            <input type="number" className={inputClass + ' w-8'} placeholder="1" value={form.contracts} onChange={(e) => handleChange('contracts', e.target.value)} tabIndex={0} />
          ) : (
            <select className={selectClass + ' w-12'} value={form.direction} onChange={(e) => handleChange('direction', e.target.value)} tabIndex={0}>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
            </select>
          )}
        </td>
        {/* Premium Received (auto-calculated) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* Exit Price */}
        <td className="px-2 py-1">
          <input type="number" step="0.01" className={inputClass + ' w-14'} placeholder="" value={form.exitPrice} onChange={(e) => handleChange('exitPrice', e.target.value)} tabIndex={0} />
        </td>
        {/* Close Date */}
        <td className="px-2 py-1">
          <input type="date" className={inputClass + ' w-28'} value={form.closeDate} onChange={(e) => handleChange('closeDate', e.target.value)} tabIndex={0} />
        </td>
        {/* Note */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* DTE (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* DIT (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* P/L (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* %Prem (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* W/L (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* Days (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* Margin ROR (auto) */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
        {/* Status */}
        <td className="px-2 py-1">
          <select className={selectClass + ' w-16'} value={form.tradeStatus} onChange={(e) => handleChange('tradeStatus', e.target.value)} tabIndex={0}>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Expired">Expired</option>
            <option value="Assigned">Assigned</option>
          </select>
        </td>
        {/* Margin Reserve */}
        <td className="px-2 py-1 text-text-secondary text-xs">—</td>
      </tr>
      {error && (
        <tr className="bg-error/5">
          <td colSpan={20} className="px-4 py-1 text-xs text-error">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
