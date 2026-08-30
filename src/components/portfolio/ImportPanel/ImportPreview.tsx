import { useState, useCallback, useMemo } from 'react';
import type { ParseResult, DuplicateReport } from '../../../types/transaction';
import Button from '../../ui/Button';
import { useTableSort } from '../../../hooks/useTableSort';

const PAGE_SIZE = 50;

interface ImportPreviewProps {
  parseResult: ParseResult;
  duplicateReport: DuplicateReport;
  onConfirm: (overrides: string[]) => void;
  onCancel: () => void;
}

export default function ImportPreview({
  parseResult,
  duplicateReport,
  onConfirm,
  onCancel,
}: ImportPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [overriddenIds, setOverriddenIds] = useState<Set<string>>(new Set());

  // Build a set of duplicate transaction IDs for quick lookup
  const duplicateIds = useMemo(() => {
    return new Set(duplicateReport.duplicates.map((d) => d.transaction.id));
  }, [duplicateReport.duplicates]);

  // Sortable duplicates list — default Symbol ascending.
  const dupSort = useTableSort<DuplicateReport['duplicates'][number], 'symbol' | 'date' | 'strikePrice'>(
    duplicateReport.duplicates,
    (dup, key) => {
      switch (key) {
        case 'symbol': return dup.transaction.symbol;
        case 'date': {
          const d = dup.transaction.transactionDate;
          return d instanceof Date ? d.getTime() : new Date(d).getTime();
        }
        case 'strikePrice': return dup.transaction.strikePrice ?? null;
        default: return null;
      }
    },
    { initialKey: 'symbol', initialDir: 'asc', defaultDirForKey: { date: 'desc', strikePrice: 'desc' } },
  );

  // Build a set of error row numbers for quick lookup
  const errorRowNumbers = useMemo(() => {
    return new Set(parseResult.errors.map((e) => e.row));
  }, [parseResult.errors]);

  // All transactions from the parse result for the preview table.
  // Capture each row's original 1-based position so error highlighting stays
  // correct regardless of sort order.
  const allTransactions = useMemo(
    () => parseResult.transactions.map((txn, i) => ({ ...txn, __rowNumber: i + 1 })),
    [parseResult.transactions],
  );

  // Sortable preview — default Symbol ascending.
  const previewSort = useTableSort<typeof allTransactions[number], 'transactionDate' | 'symbol' | 'transactionType' | 'quantity' | 'price' | 'fees'>(
    allTransactions,
    (row, key) => {
      if (key === 'transactionDate') {
        const d = row.transactionDate;
        return d instanceof Date ? d.getTime() : new Date(d).getTime();
      }
      return row[key] as string | number | null | undefined;
    },
    { initialKey: 'symbol', initialDir: 'asc', defaultDirForKey: { transactionDate: 'desc', quantity: 'desc', price: 'desc', fees: 'desc' } },
  );

  const totalPages = Math.max(1, Math.ceil(allTransactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return previewSort.sorted.slice(start, start + PAGE_SIZE);
  }, [previewSort.sorted, currentPage]);

  const handleOverrideToggle = useCallback((transactionId: string) => {
    setOverriddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(overriddenIds));
  }, [onConfirm, overriddenIds]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  function formatDate(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  function formatNumber(value: number, decimals = 2): string {
    if (value == null || isNaN(value)) return '—';
    return value.toFixed(decimals);
  }

  return (
    <div className="space-y-4" data-testid="import-preview">
      {/* Stats Section */}
      <div
        className="grid grid-cols-3 gap-4"
        data-testid="import-stats"
      >
        <div className="bg-text-accent/10 border border-text-accent/30 rounded-md p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {parseResult.transactions.length}
          </p>
          <p className="text-xs text-blue-600">Total Transactions</p>
        </div>
        <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-center">
          <p className="text-2xl font-bold text-warning">
            {duplicateReport.duplicates.length}
          </p>
          <p className="text-xs text-warning">Duplicates Detected</p>
        </div>
        <div className="bg-error/10 border border-error/30 rounded-md p-3 text-center">
          <p className="text-2xl font-bold text-error">
            {parseResult.errors.length}
          </p>
          <p className="text-xs text-error">Errors / Skipped</p>
        </div>
      </div>

      {/* Duplicates List */}
      {duplicateReport.duplicates.length > 0 && (
        <div data-testid="duplicates-list" className="space-y-2">
          <h4 className="text-sm font-medium text-text-primary">
            Duplicate Transactions (excluded by default)
          </h4>
          <div className="border border-warning/30 rounded-md overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-warning/10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-amber-800">
                    Include
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-amber-800 cursor-pointer select-none" onClick={() => dupSort.handleSort('symbol')}>
                    Symbol{dupSort.sortIndicator('symbol')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-amber-800 cursor-pointer select-none" onClick={() => dupSort.handleSort('date')}>
                    Date{dupSort.sortIndicator('date')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-amber-800 cursor-pointer select-none" onClick={() => dupSort.handleSort('strikePrice')}>
                    Strike Price{dupSort.sortIndicator('strikePrice')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {dupSort.sorted.map((dup) => (
                  <tr key={dup.transaction.id} className="bg-amber-25">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={overriddenIds.has(dup.transaction.id)}
                        onChange={() => handleOverrideToggle(dup.transaction.id)}
                        aria-label={`Include duplicate ${dup.transaction.symbol} ${formatDate(dup.transaction.transactionDate)}`}
                        className="h-4 w-4 text-text-accent border-border rounded focus:ring-text-accent"
                        data-testid={`override-checkbox-${dup.transaction.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-text-primary">
                      {dup.transaction.symbol}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {formatDate(dup.transaction.transactionDate)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {dup.transaction.strikePrice != null
                        ? `$${formatNumber(dup.transaction.strikePrice)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div data-testid="preview-table" className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">
          Transaction Preview
          {allTransactions.length > PAGE_SIZE && (
            <span className="text-text-secondary font-normal ml-2">
              (Page {currentPage} of {totalPages})
            </span>
          )}
        </h4>
        <div className="border border-border rounded-md overflow-auto max-h-96">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-tertiary sticky top-0">
              <tr className="[&>th]:cursor-pointer [&>th]:select-none [&>th]:hover:text-text-primary">
                <th className="px-3 py-2 text-left font-medium text-text-secondary" onClick={() => previewSort.handleSort('transactionDate')}>
                  <span>Date</span><span>{previewSort.sortIndicator('transactionDate')}</span>
                </th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary" onClick={() => previewSort.handleSort('symbol')}>
                  <span>Symbol</span><span>{previewSort.sortIndicator('symbol')}</span>
                </th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary" onClick={() => previewSort.handleSort('transactionType')}>
                  <span>Type</span><span>{previewSort.sortIndicator('transactionType')}</span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary" onClick={() => previewSort.handleSort('quantity')}>
                  <span>Quantity</span><span>{previewSort.sortIndicator('quantity')}</span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary" onClick={() => previewSort.handleSort('price')}>
                  <span>Price</span><span>{previewSort.sortIndicator('price')}</span>
                </th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary" onClick={() => previewSort.handleSort('fees')}>
                  <span>Fees</span><span>{previewSort.sortIndicator('fees')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedTransactions.map((txn) => {
                const isDuplicate = duplicateIds.has(txn.id);
                const isError = errorRowNumbers.has(txn.__rowNumber);

                let rowClass = 'bg-surface-secondary';
                if (isDuplicate) {
                  rowClass = 'bg-warning/10';
                } else if (isError) {
                  rowClass = 'bg-error/10';
                }

                return (
                  <tr
                    key={txn.id}
                    className={rowClass}
                    data-testid={`preview-row-${txn.id}`}
                    data-duplicate={isDuplicate || undefined}
                    data-error={isError || undefined}
                  >
                    <td className="px-3 py-2 text-text-primary">
                      {formatDate(txn.transactionDate)}
                    </td>
                    <td className="px-3 py-2 font-medium text-text-primary">
                      {txn.symbol}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {txn.transactionType}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      {formatNumber(txn.quantity, 4)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      ${formatNumber(txn.price)}
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      ${formatNumber(txn.fees)}
                    </td>
                  </tr>
                );
              })}
              {paginatedTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-text-secondary"
                  >
                    No transactions to preview.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between pt-2"
            data-testid="pagination-controls"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Error Details */}
      {parseResult.errors.length > 0 && (
        <div data-testid="error-details" className="space-y-2">
          <h4 className="text-sm font-medium text-text-primary">
            Errors ({parseResult.errors.length})
          </h4>
          <div className="border border-error/30 rounded-md overflow-hidden max-h-40 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-error/10 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-error">
                    Row
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-error">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {parseResult.errors.map((err, idx) => (
                  <tr key={idx} className="bg-red-25">
                    <td className="px-3 py-2 text-text-primary">{err.row}</td>
                    <td className="px-3 py-2 text-text-primary">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm / Cancel Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          data-testid="import-cancel-btn"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleConfirm}
          data-testid="import-confirm-btn"
        >
          Confirm Import
          {duplicateReport.unique.length > 0 && (
            <span className="ml-1">
              ({duplicateReport.unique.length + overriddenIds.size} transactions)
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
