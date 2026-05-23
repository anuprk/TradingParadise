import { useState, useMemo } from 'react';
import type { TradeJournalEntry } from '../../types/journal';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Select from '../ui/Select';
import { formatCurrency } from '../../utils/formatters';

/**
 * Displays open positions derived from journal entries with status 'Open'.
 * Supports filtering by symbol and option type, and sorting by columns.
 *
 * Requirements: 17.5, 17.6
 */

interface PositionsListProps {
  entries: TradeJournalEntry[];
}

type SortKey = 'stockSymbol' | 'optionType' | 'strikePrice' | 'expirationDate' | 'premium' | 'currentStockPrice' | 'unrealizedPL';
type SortDir = 'asc' | 'desc';

export default function PositionsList({ entries }: PositionsListProps) {
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterOptionType, setFilterOptionType] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('expirationDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const openPositions = useMemo(
    () => entries.filter((e) => e.tradeStatus === 'Open'),
    [entries],
  );

  const symbols = useMemo(
    () => [...new Set(openPositions.map((e) => e.stockSymbol))].sort(),
    [openPositions],
  );

  const filtered = useMemo(() => {
    let result = openPositions;
    if (filterSymbol) result = result.filter((e) => e.stockSymbol === filterSymbol);
    if (filterOptionType) result = result.filter((e) => e.optionType === filterOptionType);
    return result;
  }, [openPositions, filterSymbol, filterOptionType]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: number | string | Date = a[sortKey] as never;
      let bVal: number | string | Date = b[sortKey] as never;
      if (sortKey === 'expirationDate') {
        aVal = new Date(a.expirationDate).getTime();
        bVal = new Date(b.expirationDate).getTime();
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const formatDate = (d: Date) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card title="Open Positions">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-40">
          <Select
            label="Symbol"
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            options={symbols.map((s) => ({ value: s, label: s }))}
            placeholder="All Symbols"
          />
        </div>
        <div className="w-40">
          <Select
            label="Option Type"
            value={filterOptionType}
            onChange={(e) => setFilterOptionType(e.target.value)}
            options={[
              { value: 'Call', label: 'Call' },
              { value: 'Put', label: 'Put' },
            ]}
            placeholder="All Types"
          />
        </div>
        {(filterSymbol || filterOptionType) && (
          <div className="flex items-end">
            <button
              type="button"
              className="text-sm text-text-accent hover:text-indigo-800"
              onClick={() => { setFilterSymbol(''); setFilterOptionType(''); }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-6">No open positions</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-tertiary">
                <tr>
                  {([
                    ['stockSymbol', 'Symbol'],
                    ['optionType', 'Type'],
                    ['strikePrice', 'Strike'],
                    ['expirationDate', 'Expiration'],
                    ['premium', 'Entry Price'],
                    ['currentStockPrice', 'Current Price'],
                    ['unrealizedPL', 'Unrealized P/L'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase cursor-pointer hover:text-text-primary"
                      onClick={() => handleSort(key)}
                    >
                      {label}{sortIndicator(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((pos) => (
                  <tr key={pos.id}>
                    <td className="px-3 py-2 font-medium text-text-primary">{pos.stockSymbol}</td>
                    <td className="px-3 py-2">
                      <Badge variant={pos.optionType === 'Call' ? 'info' : 'warning'}>{pos.optionType}</Badge>
                    </td>
                    <td className="px-3 py-2">{formatCurrency(pos.strikePrice)}</td>
                    <td className="px-3 py-2">{formatDate(pos.expirationDate)}</td>
                    <td className="px-3 py-2">{formatCurrency(pos.premium)}</td>
                    <td className="px-3 py-2">{pos.currentStockPrice != null ? formatCurrency(pos.currentStockPrice) : '—'}</td>
                    <td className={`px-3 py-2 font-medium ${(pos.unrealizedPL ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                      {pos.unrealizedPL != null ? formatCurrency(pos.unrealizedPL) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {sorted.map((pos) => (
              <div key={pos.id} className="bg-surface-tertiary rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-primary">{pos.stockSymbol}</span>
                  <Badge variant={pos.optionType === 'Call' ? 'info' : 'warning'}>{pos.optionType}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Strike</span>
                  <span>{formatCurrency(pos.strikePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Expiration</span>
                  <span>{formatDate(pos.expirationDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Entry Price</span>
                  <span>{formatCurrency(pos.premium)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Current Price</span>
                  <span>{pos.currentStockPrice != null ? formatCurrency(pos.currentStockPrice) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Unrealized P/L</span>
                  <span className={`font-medium ${(pos.unrealizedPL ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                    {pos.unrealizedPL != null ? formatCurrency(pos.unrealizedPL) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
