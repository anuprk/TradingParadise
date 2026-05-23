import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '../ui/Button';
import type { PortfolioTransaction, TransactionType, AssetType } from '../../types/transaction';

interface AddTransactionFormProps {
  portfolioId: string;
  planId: string;
  onAdd: (transaction: PortfolioTransaction) => void;
  onCancel: () => void;
}

const TRANSACTION_TYPES: TransactionType[] = ['Buy', 'Sell', 'Dividend', 'Fee', 'Transfer'];
const ASSET_TYPES: AssetType[] = ['Stock', 'ETF', 'Option', 'Cash'];

export default function AddTransactionForm({ portfolioId, planId, onAdd, onCancel }: AddTransactionFormProps) {
  const [form, setForm] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    symbol: '',
    description: '',
    transactionType: 'Buy' as TransactionType,
    assetType: 'ETF' as AssetType,
    quantity: '',
    price: '',
    amount: '',
    fees: '0',
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol.trim()) return;

    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;
    const fees = Number(form.fees) || 0;
    // Auto-calculate amount if not provided
    let amount = Number(form.amount) || 0;
    if (!form.amount && quantity && price) {
      amount = form.transactionType === 'Sell' || form.transactionType === 'Dividend'
        ? quantity * price - fees
        : -(quantity * price) - fees;
    }

    const now = new Date();
    const transaction: PortfolioTransaction = {
      id: uuidv4(),
      portfolioId,
      planId,
      transactionDate: new Date(form.transactionDate),
      symbol: form.symbol.trim().toUpperCase(),
      description: form.description || `${form.transactionType} ${form.symbol.toUpperCase()}`,
      transactionType: form.transactionType,
      assetType: form.assetType,
      quantity: Math.abs(quantity),
      price,
      amount,
      fees,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    onAdd(transaction);
  }, [form, portfolioId, planId, onAdd]);

  const ic = 'px-2 py-1.5 text-sm border border-border rounded bg-transparent text-text-primary focus:outline-none focus:ring-1 focus:ring-text-accent';

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 bg-surface-tertiary/30">
      <h4 className="text-sm font-semibold text-text-primary mb-3">Add Transaction</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Date</label>
          <input type="date" className={ic + ' w-full'} value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Symbol *</label>
          <input type="text" className={ic + ' w-full'} placeholder="AAPL" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Type</label>
          <select className={ic + ' w-full'} value={form.transactionType} onChange={(e) => setForm({ ...form, transactionType: e.target.value as TransactionType })}>
            {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Asset</label>
          <select className={ic + ' w-full'} value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetType })}>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Quantity</label>
          <input type="number" step="0.01" className={ic + ' w-full'} placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Price</label>
          <input type="number" step="0.01" className={ic + ' w-full'} placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Amount</label>
          <input type="number" step="0.01" className={ic + ' w-full'} placeholder="Auto" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Fees</label>
          <input type="number" step="0.01" className={ic + ' w-full'} placeholder="0" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-text-secondary mb-1">Description (optional)</label>
        <input type="text" className={ic + ' w-full'} placeholder="e.g. Monthly dividend" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Add</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
