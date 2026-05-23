import { useMemo, useState, useCallback } from 'react';
import type {
  PortfolioTransaction,
  TransactionFilterState,
  TransactionType,
  AssetType,
} from '../../types/transaction';
import { formatCurrency } from '../../utils/formatters';

/**
 * Displays portfolio transactions in a sortable, filterable, paginated table.
 * Columns: Date, Symbol, Option Type, Direction, Strike, Premium, Fees, P/L, Status.
 * Default sort by date descending. Supports filtering by symbol, date range,
 * transaction type, and asset type. Pagination at 50 records per page.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

const PAGE_SIZE = 50;

interface TransactionsTabProps {
  transactions: PortfolioTransaction[];
  totalCount: number;
  currentPage: number;
  isLoading: boolean;
  filters: TransactionFilterState;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onFiltersChange: (filters: Partial<TransactionFilterState>) => void;
  onSortChange: (column: string, direction: 'asc' | 'desc') => void;
  onPageChange: (page: number) => void;
  onDeleteTransaction?: (transactionId: string) => void;
  onEditTransaction?: (transactionId: string, changes: Partial<PortfolioTransaction>) => void;
}

const TRANSACTION_TYPES: TransactionType[] = [
  'Buy',
  'Sell',
  'Dividend',
  'Fee',
  'Transfer',
  'Expiration',
  'Assignment',
];

const ASSET_TYPES: AssetType[] = ['Stock', 'ETF', 'Option', 'Cash'];

interface ColumnDef {
  key: string;
  label: string;
  align: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'transactionDate', label: 'Date', align: 'left' },
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'transactionType', label: 'Direction', align: 'left' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'fees', label: 'Fees', align: 'right' },
  { key: 'amount', label: 'P/L', align: 'right' },
  { key: 'actions', label: '', align: 'right' },
];

function formatDate(date: Date): string {
  const d = new Date(date);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TransactionsTab({
  transactions,
  totalCount,
  currentPage,
  isLoading,
  filters,
  sortColumn,
  sortDirection,
  onFiltersChange,
  onSortChange,
  onPageChange,
  onDeleteTransaction,
  onEditTransaction,
}: TransactionsTabProps) {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PortfolioTransaction>>({});

  const startEdit = useCallback((txn: PortfolioTransaction) => {
    setEditingId(txn.id);
    setEditForm({
      transactionDate: txn.transactionDate,
      symbol: txn.symbol,
      transactionType: txn.transactionType,
      quantity: txn.quantity,
      price: txn.price,
      fees: txn.fees,
      amount: txn.amount,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && onEditTransaction) {
      onEditTransaction(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  }, [editingId, editForm, onEditTransaction]);

  function handleSort(column: string) {
    if (sortColumn === column) {
      onSortChange(column, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(column, 'desc');
    }
  }

  function renderSortIndicator(column: string) {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1" aria-label={`sorted ${sortDirection}`}>
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" role="status" aria-label="Loading transactions" />
        <p className="mt-2 text-sm text-text-secondary">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Controls */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label htmlFor="filter-symbol" className="block text-xs font-medium text-text-secondary mb-1">
            Symbol
          </label>
          <input
            id="filter-symbol"
            type="text"
            placeholder="Search symbol..."
            value={filters.symbol}
            onChange={(e) => onFiltersChange({ symbol: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="filter-date-from" className="block text-xs font-medium text-text-secondary mb-1">
            Date From
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={formatDateForInput(filters.dateFrom)}
            onChange={(e) =>
              onFiltersChange({
                dateFrom: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="filter-date-to" className="block text-xs font-medium text-text-secondary mb-1">
            Date To
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={formatDateForInput(filters.dateTo)}
            onChange={(e) =>
              onFiltersChange({
                dateTo: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="filter-transaction-type" className="block text-xs font-medium text-text-secondary mb-1">
            Transaction Type
          </label>
          <select
            id="filter-transaction-type"
            value={filters.transactionType}
            onChange={(e) =>
              onFiltersChange({ transactionType: e.target.value as TransactionType | '' })
            }
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-asset-type" className="block text-xs font-medium text-text-secondary mb-1">
            Asset Type
          </label>
          <select
            id="filter-asset-type"
            value={filters.assetType}
            onChange={(e) =>
              onFiltersChange({ assetType: e.target.value as AssetType | '' })
            }
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Assets</option>
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-text-secondary">No transactions found</p>
        </div>
      ) : (
        <>
          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-tertiary">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-xs font-medium text-text-secondary uppercase cursor-pointer hover:bg-surface-tertiary select-none ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortColumn === col.key
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {col.label}
                      {renderSortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((txn) => (
                  editingId === txn.id ? (
                    <tr key={txn.id} className="bg-surface-tertiary/50">
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          className="w-full px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary"
                          value={editForm.transactionDate ? new Date(editForm.transactionDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setEditForm({ ...editForm, transactionDate: e.target.value ? new Date(e.target.value) : undefined })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-full px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary"
                          value={editForm.symbol || ''}
                          onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary"
                          value={editForm.transactionType || ''}
                          onChange={(e) => setEditForm({ ...editForm, transactionType: e.target.value as TransactionType })}
                        >
                          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary text-right"
                          value={editForm.price ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-16 px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary text-right"
                          value={editForm.fees ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, fees: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-1 py-1 text-xs border border-border rounded bg-transparent text-text-primary text-right"
                          value={editForm.amount ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={saveEdit}
                          className="text-success hover:text-green-300 text-xs font-medium mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-text-secondary hover:text-text-primary text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                  <tr key={txn.id}>
                    <td className="px-3 py-2 text-text-primary">
                      {formatDate(txn.transactionDate)}
                    </td>
                    <td className="px-3 py-2 font-medium text-text-primary">
                      {txn.symbol}
                    </td>
                    <td className="px-3 py-2 text-text-primary">
                      {txn.transactionType}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      {formatCurrency(txn.price)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      {formatCurrency(txn.fees)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        txn.amount > 0
                          ? 'text-success'
                          : txn.amount < 0
                            ? 'text-error'
                            : 'text-text-primary'
                      }`}
                    >
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {onEditTransaction && (
                        <button
                          onClick={() => startEdit(txn)}
                          className="text-text-secondary hover:text-text-accent transition-colors p-1 rounded mr-1"
                          aria-label={`Edit transaction ${txn.symbol}`}
                          title="Edit"
                        >
                          ✎
                        </button>
                      )}
                      {onDeleteTransaction && (
                        <button
                          onClick={() => onDeleteTransaction(txn.id)}
                          className="text-text-secondary hover:text-error transition-colors p-1 rounded"
                          aria-label={`Delete transaction ${txn.symbol}`}
                          title="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
