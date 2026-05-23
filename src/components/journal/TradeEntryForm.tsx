import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import NotesEditor from '../notes/NotesEditor';
import type { TradeJournalEntry, OptionType, TradeDirection, TradeStatus } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';
import { useJournal } from '../../hooks/useJournal';

/**
 * Trade Entry Form — create and edit trade journal entries.
 * Displays all 26 fields from Requirement 13.1 organized in logical groups.
 * Auto-calculates: DTE, DITC, Break-Even Price, Annualized ROR,
 * Margin Annualized ROR, P/L, Win/Loss, Days Held.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 17.7
 */

interface TradeEntryFormProps {
  entry?: TradeJournalEntry;
  strategies: Strategy[];
  portfolios: Portfolio[];
  planId: string;
  onSave: (entry: TradeJournalEntry) => void;
  onCancel: () => void;
}

const OPTION_TYPE_OPTIONS = [
  { value: 'Call', label: 'Call' },
  { value: 'Put', label: 'Put' },
];

const DIRECTION_OPTIONS = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
];

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Assigned', label: 'Assigned' },
];

function toDateInputValue(d: Date | string | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

interface FormData {
  stockSymbol: string;
  openDate: string;
  expirationDate: string;
  optionType: OptionType;
  direction: TradeDirection;
  tradeStatus: TradeStatus;
  strikePrice: string;
  premium: string;
  exitPrice: string;
  stockPriceDOC: string;
  currentStockPrice: string;
  cashReserve: string;
  marginCashReserve: string;
  fees: string;
  closeDate: string;
  strategyId: string;
  portfolioId: string;
  notes: string;
}

function buildInitialForm(entry?: TradeJournalEntry): FormData {
  if (entry) {
    return {
      stockSymbol: entry.stockSymbol,
      openDate: toDateInputValue(entry.openDate),
      expirationDate: toDateInputValue(entry.expirationDate),
      optionType: entry.optionType,
      direction: entry.direction,
      tradeStatus: entry.tradeStatus,
      strikePrice: String(entry.strikePrice),
      premium: String(entry.premium),
      exitPrice: entry.exitPrice != null ? String(entry.exitPrice) : '',
      stockPriceDOC: String(entry.stockPriceDOC),
      currentStockPrice: entry.currentStockPrice != null ? String(entry.currentStockPrice) : '',
      cashReserve: String(entry.cashReserve),
      marginCashReserve: entry.marginCashReserve != null ? String(entry.marginCashReserve) : '',
      fees: String(entry.fees),
      closeDate: toDateInputValue(entry.closeDate),
      strategyId: entry.strategyId,
      portfolioId: entry.portfolioId,
      notes: entry.notes ?? '',
    };
  }
  return {
    stockSymbol: '',
    openDate: '',
    expirationDate: '',
    optionType: 'Put',
    direction: 'Sell',
    tradeStatus: 'Open',
    strikePrice: '',
    premium: '',
    exitPrice: '',
    stockPriceDOC: '',
    currentStockPrice: '',
    cashReserve: '',
    marginCashReserve: '',
    fees: '0',
    closeDate: '',
    strategyId: '',
    portfolioId: '',
    notes: '',
  };
}

interface ValidationErrors {
  [key: string]: string;
}

function validate(form: FormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.stockSymbol.trim()) errors.stockSymbol = 'Stock symbol is required';
  if (!form.openDate) errors.openDate = 'Open date is required';
  if (!form.expirationDate) errors.expirationDate = 'Expiration date is required';
  if (!form.strikePrice || Number(form.strikePrice) <= 0) errors.strikePrice = 'Strike price must be > 0';
  if (!form.premium || Number(form.premium) < 0) errors.premium = 'Premium is required';
  if (!form.stockPriceDOC || Number(form.stockPriceDOC) <= 0) errors.stockPriceDOC = 'Stock price DOC is required';
  if (!form.cashReserve || Number(form.cashReserve) < 0) errors.cashReserve = 'Cash reserve is required';
  if (!form.fees && form.fees !== '0') errors.fees = 'Fees is required';
  if (!form.strategyId) errors.strategyId = 'Strategy is required';
  if (!form.portfolioId) errors.portfolioId = 'Portfolio is required';
  return errors;
}

export default function TradeEntryForm({
  entry,
  strategies,
  portfolios,
  planId,
  onSave,
  onCancel,
}: TradeEntryFormProps) {
  const { autoCalculate } = useJournal();
  const [form, setForm] = useState<FormData>(() => buildInitialForm(entry));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const isEdit = !!entry;

  // Reset form when entry prop changes
  useEffect(() => {
    setForm(buildInitialForm(entry));
    setErrors({});
  }, [entry]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      // Clear field error on change
      setErrors((prev) => {
        if (prev[name]) {
          const next = { ...prev };
          delete next[name];
          return next;
        }
        return prev;
      });
    },
    [],
  );

  // Build a partial entry from form data for auto-calculation
  const partialEntry = useMemo((): Partial<TradeJournalEntry> => {
    return {
      openDate: form.openDate ? new Date(form.openDate) : undefined,
      expirationDate: form.expirationDate ? new Date(form.expirationDate) : undefined,
      optionType: form.optionType,
      direction: form.direction,
      tradeStatus: form.tradeStatus,
      strikePrice: form.strikePrice ? Number(form.strikePrice) : undefined,
      premium: form.premium ? Number(form.premium) : undefined,
      exitPrice: form.exitPrice ? Number(form.exitPrice) : undefined,
      cashReserve: form.cashReserve ? Number(form.cashReserve) : undefined,
      marginCashReserve: form.marginCashReserve ? Number(form.marginCashReserve) : undefined,
      fees: form.fees ? Number(form.fees) : 0,
      closeDate: form.closeDate ? new Date(form.closeDate) : undefined,
    };
  }, [form.openDate, form.expirationDate, form.optionType, form.direction, form.tradeStatus,
      form.strikePrice, form.premium, form.exitPrice, form.cashReserve,
      form.marginCashReserve, form.fees, form.closeDate]);

  const computed = useMemo(() => autoCalculate(partialEntry), [autoCalculate, partialEntry]);

  const strategyOptions = useMemo(
    () => strategies.map((s) => ({ value: s.id, label: `${s.name} (${s.classification})` })),
    [strategies],
  );

  const portfolioOptions = useMemo(
    () => portfolios.map((p) => ({ value: p.id, label: p.name })),
    [portfolios],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const now = new Date();
    const journalEntry: TradeJournalEntry = {
      id: entry?.id ?? uuidv4(),
      stockSymbol: form.stockSymbol.trim().toUpperCase(),
      openDate: new Date(form.openDate),
      expirationDate: new Date(form.expirationDate),
      optionType: form.optionType,
      direction: form.direction,
      stockPriceDOC: Number(form.stockPriceDOC),
      dte: computed.dte ?? 0,
      ditc: computed.ditc ?? 0,
      currentStockPrice: form.currentStockPrice ? Number(form.currentStockPrice) : undefined,
      breakEvenPrice: computed.breakEvenPrice ?? 0,
      strikePrice: Number(form.strikePrice),
      premium: Number(form.premium),
      contracts: 1,
      cashReserve: Number(form.cashReserve),
      marginCashReserve: form.marginCashReserve ? Number(form.marginCashReserve) : undefined,
      fees: Number(form.fees),
      exitPrice: form.exitPrice ? Number(form.exitPrice) : undefined,
      closeDate: form.closeDate ? new Date(form.closeDate) : undefined,
      profitLoss: computed.profitLoss,
      winLoss: computed.winLoss ?? null,
      daysHeld: computed.daysHeld,
      annualizedROR: computed.annualizedROR,
      marginAnnualizedROR: computed.marginAnnualizedROR,
      tradeStatus: form.tradeStatus,
      portfolioId: form.portfolioId,
      strategyId: form.strategyId,
      planId,
      unrealizedPL: computed.profitLoss != null ? undefined : (form.tradeStatus === 'Open' ? computed.profitLoss : undefined),
      notes: form.notes,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(journalEntry);
  };

  const fmt = (v: number | undefined) => (v != null ? v.toFixed(2) : '—');
  const fmtPct = (v: number | undefined) => (v != null ? `${v.toFixed(2)}%` : '—');

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="trade-entry-form">
      {/* Basic Info */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Basic Info</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Stock Symbol"
            name="stockSymbol"
            value={form.stockSymbol}
            onChange={handleChange}
            error={errors.stockSymbol}
            placeholder="e.g. AAPL"
          />
          <Select
            label="Option Type"
            name="optionType"
            value={form.optionType}
            onChange={handleChange}
            options={OPTION_TYPE_OPTIONS}
          />
          <Select
            label="Direction"
            name="direction"
            value={form.direction}
            onChange={handleChange}
            options={DIRECTION_OPTIONS}
          />
          <Select
            label="Trade Status"
            name="tradeStatus"
            value={form.tradeStatus}
            onChange={handleChange}
            options={STATUS_OPTIONS}
          />
        </div>
      </fieldset>

      {/* Dates */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Dates</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Open Date"
            name="openDate"
            type="date"
            value={form.openDate}
            onChange={handleChange}
            error={errors.openDate}
          />
          <Input
            label="Expiration Date"
            name="expirationDate"
            type="date"
            value={form.expirationDate}
            onChange={handleChange}
            error={errors.expirationDate}
          />
          <Input
            label="Close Date"
            name="closeDate"
            type="date"
            value={form.closeDate}
            onChange={handleChange}
          />
        </div>
      </fieldset>

      {/* Pricing */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Pricing</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Strike Price"
            name="strikePrice"
            type="number"
            step="0.01"
            value={form.strikePrice}
            onChange={handleChange}
            error={errors.strikePrice}
          />
          <Input
            label="Premium"
            name="premium"
            type="number"
            step="0.01"
            value={form.premium}
            onChange={handleChange}
            error={errors.premium}
          />
          <Input
            label="Exit Price"
            name="exitPrice"
            type="number"
            step="0.01"
            value={form.exitPrice}
            onChange={handleChange}
          />
          <Input
            label="Stock Price DOC"
            name="stockPriceDOC"
            type="number"
            step="0.01"
            value={form.stockPriceDOC}
            onChange={handleChange}
            error={errors.stockPriceDOC}
          />
          <Input
            label="Current Stock Price"
            name="currentStockPrice"
            type="number"
            step="0.01"
            value={form.currentStockPrice}
            onChange={handleChange}
          />
        </div>
      </fieldset>

      {/* Reserves & Fees */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Reserves &amp; Fees</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Cash Reserve"
            name="cashReserve"
            type="number"
            step="0.01"
            value={form.cashReserve}
            onChange={handleChange}
            error={errors.cashReserve}
          />
          <Input
            label="Margin Cash Reserve"
            name="marginCashReserve"
            type="number"
            step="0.01"
            value={form.marginCashReserve}
            onChange={handleChange}
          />
          <Input
            label="Fees"
            name="fees"
            type="number"
            step="0.01"
            value={form.fees}
            onChange={handleChange}
            error={errors.fees}
          />
        </div>
      </fieldset>

      {/* Linking */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Linking</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Strategy"
            name="strategyId"
            value={form.strategyId}
            onChange={handleChange}
            options={strategyOptions}
            placeholder="Select a strategy"
            error={errors.strategyId}
          />
          <Select
            label="Portfolio / Account"
            name="portfolioId"
            value={form.portfolioId}
            onChange={handleChange}
            options={portfolioOptions}
            placeholder="Select a portfolio"
            error={errors.portfolioId}
          />
        </div>
      </fieldset>

      {/* Auto-Calculated Fields */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Auto-Calculated</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">DTE</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-dte">
              {computed.dte != null ? computed.dte : '—'}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">DITC</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-ditc">
              {computed.ditc != null ? computed.ditc : '—'}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">Break-Even Price</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-breakeven">
              {fmt(computed.breakEvenPrice)}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">Days Held</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-daysheld">
              {computed.daysHeld != null ? computed.daysHeld : '—'}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">Annualized ROR</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-ror">
              {fmtPct(computed.annualizedROR)}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">Margin Ann. ROR</span>
            <span className="block text-sm text-text-primary bg-surface-tertiary rounded-md border border-border px-3 py-2" data-testid="calc-margin-ror">
              {fmtPct(computed.marginAnnualizedROR)}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">P/L</span>
            <span
              className={`block text-sm rounded-md border border-border px-3 py-2 ${
                computed.profitLoss != null
                  ? computed.profitLoss > 0
                    ? 'text-success bg-success/10'
                    : 'text-error bg-error/10'
                  : 'text-text-primary bg-surface-tertiary'
              }`}
              data-testid="calc-pl"
            >
              {fmt(computed.profitLoss)}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-text-secondary mb-1">Win/Loss</span>
            <span
              className={`block text-sm rounded-md border border-border px-3 py-2 ${
                computed.winLoss === 'Win'
                  ? 'text-success bg-success/10'
                  : computed.winLoss === 'Loss'
                    ? 'text-error bg-error/10'
                    : 'text-text-primary bg-surface-tertiary'
              }`}
              data-testid="calc-winloss"
            >
              {computed.winLoss ?? '—'}
            </span>
          </div>
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset>
        <legend className="text-lg font-semibold text-text-primary mb-3">Notes</legend>
        <div>
          <NotesEditor
            content={form.notes}
            onChange={(html) => setForm((prev) => ({ ...prev, notes: html }))}
            placeholder="Trade rationale, market conditions, lessons learned..."
          />
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEdit ? 'Update Trade' : 'Save Trade'}
        </Button>
      </div>
    </form>
  );
}
