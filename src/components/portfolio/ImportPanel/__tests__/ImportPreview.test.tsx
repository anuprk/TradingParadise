import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportPreview from '../ImportPreview';
import type { ParseResult, DuplicateReport, PortfolioTransaction } from '../../../../types/transaction';

function createTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2, 8)}`,
    portfolioId: 'portfolio-1',
    planId: 'plan-1',
    transactionDate: new Date('2024-03-15'),
    symbol: 'AAPL',
    description: 'Buy AAPL',
    transactionType: 'Buy',
    assetType: 'Stock',
    quantity: 10,
    price: 175.5,
    amount: 1755,
    fees: 1.5,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createParseResult(count: number, errorCount = 0): ParseResult {
  const transactions = Array.from({ length: count }, (_, i) =>
    createTransaction({ id: `txn-${i}`, symbol: `SYM${i}` }),
  );
  const errors = Array.from({ length: errorCount }, (_, i) => ({
    row: i + 1,
    content: `bad row ${i}`,
    reason: `Missing field at row ${i + 1}`,
  }));
  return {
    transactions,
    errors,
    skipped: errorCount,
    total: count + errorCount,
  };
}

function createDuplicateReport(
  transactions: PortfolioTransaction[],
  duplicateIds: string[] = [],
): DuplicateReport {
  const duplicates = transactions
    .filter((t) => duplicateIds.includes(t.id))
    .map((t) => ({
      transaction: t,
      existingId: `existing-${t.id}`,
      fingerprint: `fp-${t.id}`,
      overrideInclude: false,
    }));
  const unique = transactions.filter((t) => !duplicateIds.includes(t.id));
  return { duplicates, unique };
}

describe('ImportPreview', () => {
  describe('stats section', () => {
    it('displays total transactions, duplicate count, and error count', () => {
      const parseResult = createParseResult(25, 3);
      const duplicateReport = createDuplicateReport(parseResult.transactions, [
        'txn-0',
        'txn-1',
      ]);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const stats = screen.getByTestId('import-stats');
      expect(stats).toBeInTheDocument();
      // Use within to scope queries to the stats section
      const statCards = stats.querySelectorAll('.text-2xl');
      expect(statCards[0]).toHaveTextContent('25');
      expect(statCards[1]).toHaveTextContent('2');
      expect(statCards[2]).toHaveTextContent('3');
      expect(screen.getByText('Total Transactions')).toBeInTheDocument();
      expect(screen.getByText('Duplicates Detected')).toBeInTheDocument();
      expect(screen.getByText('Errors / Skipped')).toBeInTheDocument();
    });
  });

  describe('duplicates list', () => {
    it('shows duplicates list when duplicates exist', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, [
        'txn-0',
        'txn-1',
      ]);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('duplicates-list')).toBeInTheDocument();
      expect(
        screen.getByText(/duplicate transactions/i),
      ).toBeInTheDocument();
    });

    it('does not show duplicates list when no duplicates', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('duplicates-list')).not.toBeInTheDocument();
    });

    it('renders override checkboxes for each duplicate', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, [
        'txn-0',
        'txn-1',
      ]);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('override-checkbox-txn-0')).toBeInTheDocument();
      expect(screen.getByTestId('override-checkbox-txn-1')).toBeInTheDocument();
    });

    it('toggles override checkbox and includes overridden IDs on confirm', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, [
        'txn-0',
        'txn-1',
      ]);
      const onConfirm = vi.fn();

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      );

      const checkbox = screen.getByTestId('override-checkbox-txn-0');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      fireEvent.click(screen.getByTestId('import-confirm-btn'));
      expect(onConfirm).toHaveBeenCalledWith(['txn-0']);
    });
  });

  describe('preview table', () => {
    it('renders transaction rows with correct columns', () => {
      const parseResult = createParseResult(3);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('preview-table')).toBeInTheDocument();
      // Check column headers
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Symbol')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Quantity')).toBeInTheDocument();
      expect(screen.getByText('Price')).toBeInTheDocument();
      expect(screen.getByText('Fees')).toBeInTheDocument();
    });

    it('highlights duplicate rows with amber background', () => {
      const parseResult = createParseResult(3);
      const duplicateReport = createDuplicateReport(parseResult.transactions, ['txn-0']);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const dupRow = screen.getByTestId('preview-row-txn-0');
      expect(dupRow).toHaveClass('bg-warning/10');
      expect(dupRow).toHaveAttribute('data-duplicate');
    });

    it('shows empty state when no transactions', () => {
      const parseResult: ParseResult = {
        transactions: [],
        errors: [],
        skipped: 0,
        total: 0,
      };
      const duplicateReport: DuplicateReport = { duplicates: [], unique: [] };

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByText(/no transactions to preview/i)).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('does not show pagination controls when transactions fit in one page', () => {
      const parseResult = createParseResult(30);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument();
    });

    it('shows pagination controls when transactions exceed 50', () => {
      const parseResult = createParseResult(75);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('navigates to next page', () => {
      const parseResult = createParseResult(75);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });

    it('disables Previous button on first page', () => {
      const parseResult = createParseResult(75);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('disables Next button on last page', () => {
      const parseResult = createParseResult(75);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });
  });

  describe('error details', () => {
    it('shows error details section when errors exist', () => {
      const parseResult = createParseResult(5, 2);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByTestId('error-details')).toBeInTheDocument();
      expect(screen.getByText('Errors (2)')).toBeInTheDocument();
    });

    it('does not show error details when no errors', () => {
      const parseResult = createParseResult(5, 0);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('error-details')).not.toBeInTheDocument();
    });
  });

  describe('confirm and cancel buttons', () => {
    it('calls onConfirm with empty overrides when no duplicates are overridden', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, ['txn-0']);
      const onConfirm = vi.fn();

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('import-confirm-btn'));
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('calls onCancel when cancel button is clicked', () => {
      const parseResult = createParseResult(5);
      const duplicateReport = createDuplicateReport(parseResult.transactions, []);
      const onCancel = vi.fn();

      render(
        <ImportPreview
          parseResult={parseResult}
          duplicateReport={duplicateReport}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />,
      );

      fireEvent.click(screen.getByTestId('import-cancel-btn'));
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
