import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportPanel from '../ImportPanel';
import type { ParseResult, DuplicateReport, PortfolioTransaction } from '../../../../types/transaction';

// Mock dependencies
vi.mock('../../../../utils/parsers', () => ({
  detectAndParse: vi.fn(),
}));

vi.mock('../../../../utils/deduplication', () => ({
  findDuplicates: vi.fn(),
}));

vi.mock('../../../../db/transactionRepository', () => ({
  getTransactionsByPortfolio: vi.fn(),
}));

vi.mock('../../../../stores/transactionStore', () => ({
  useTransactionStore: vi.fn(),
}));

import { detectAndParse } from '../../../../utils/parsers';
import { findDuplicates } from '../../../../utils/deduplication';
import { getTransactionsByPortfolio } from '../../../../db/transactionRepository';
import { useTransactionStore } from '../../../../stores/transactionStore';

const mockDetectAndParse = vi.mocked(detectAndParse);
const mockFindDuplicates = vi.mocked(findDuplicates);
const mockGetTransactionsByPortfolio = vi.mocked(getTransactionsByPortfolio);
const mockUseTransactionStore = vi.mocked(useTransactionStore);

function createMockTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2)}`,
    portfolioId: 'portfolio-1',
    planId: 'plan-1',
    transactionDate: new Date('2024-03-15'),
    symbol: 'AAPL',
    description: 'Buy AAPL',
    transactionType: 'Buy',
    assetType: 'Stock',
    quantity: 10,
    price: 150.0,
    amount: 1500.0,
    fees: 1.0,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockParseResult(transactions: PortfolioTransaction[] = []): ParseResult {
  return {
    transactions,
    errors: [],
    skipped: 0,
    total: transactions.length,
  };
}

function createMockDuplicateReport(
  unique: PortfolioTransaction[] = [],
  duplicates: PortfolioTransaction[] = [],
): DuplicateReport {
  return {
    unique,
    duplicates: duplicates.map((txn) => ({
      transaction: txn,
      existingId: `existing-${txn.id}`,
      fingerprint: `fp-${txn.id}`,
      overrideInclude: false,
    })),
  };
}

describe('ImportPanel', () => {
  const mockAddTransactions = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTransactionStore.mockImplementation((selector: any) => {
      const state = { addTransactions: mockAddTransactions };
      return selector(state);
    });
    mockGetTransactionsByPortfolio.mockResolvedValue([]);
  });

  describe('initial render', () => {
    it('renders the import panel with upload state', () => {
      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);
      expect(screen.getByTestId('import-panel')).toBeInTheDocument();
      expect(screen.getByText('Import Transactions')).toBeInTheDocument();
      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
    });

    it('does not show back button in upload state', () => {
      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);
      expect(screen.queryByTestId('import-reset-btn')).not.toBeInTheDocument();
    });
  });

  describe('parsing flow', () => {
    it('shows parsing state when file is selected', async () => {
      // Make detectAndParse hang so we can observe the parsing state
      mockDetectAndParse.mockImplementation(() => new Promise(() => {}));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-parsing')).toBeInTheDocument();
      });
      expect(screen.getByText(/parsing file/i)).toBeInTheDocument();
    });

    it('transitions to preview state after successful parse', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });
    });

    it('calls detectAndParse with correct arguments', async () => {
      mockDetectAndParse.mockResolvedValue(createMockParseResult([createMockTransaction()]));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport([createMockTransaction()]));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockDetectAndParse).toHaveBeenCalledWith(file, 'portfolio-1', 'plan-1');
      });
    });

    it('calls findDuplicates with parsed transactions and existing transactions', async () => {
      const txns = [createMockTransaction()];
      const existingTxns = [createMockTransaction({ id: 'existing-1' })];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockGetTransactionsByPortfolio.mockResolvedValue(existingTxns);
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockFindDuplicates).toHaveBeenCalledWith(txns, existingTxns);
      });
    });
  });

  describe('error handling', () => {
    it('shows error state when parsing returns only errors', async () => {
      mockDetectAndParse.mockResolvedValue({
        transactions: [],
        errors: [{ row: 0, content: '', reason: 'Unsupported format' }],
        skipped: 0,
        total: 0,
      });

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'bad.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Unsupported format')).toBeInTheDocument();
    });

    it('shows error state when detectAndParse throws', async () => {
      mockDetectAndParse.mockRejectedValue(new Error('PDF parsing failed'));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'corrupt.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-error')).toBeInTheDocument();
      });
      expect(screen.getByText('PDF parsing failed')).toBeInTheDocument();
    });

    it('shows Try Again button in error state that resets to upload', async () => {
      mockDetectAndParse.mockRejectedValue(new Error('Failed'));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'bad.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Try Again'));
      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
    });
  });

  describe('confirm import', () => {
    it('saves unique transactions on confirm and shows success', async () => {
      const txns = [createMockTransaction({ id: 'txn-1' }), createMockTransaction({ id: 'txn-2' })];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('import-success')).toBeInTheDocument();
      });
      expect(screen.getByText('Successfully imported 2 transactions')).toBeInTheDocument();
    });

    it('calls addTransactions with portfolioId and transactions', async () => {
      const txns = [createMockTransaction({ id: 'txn-1' })];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(mockAddTransactions).toHaveBeenCalledWith('portfolio-1', txns);
      });
    });

    it('calls onImportComplete callback on successful import', async () => {
      const onImportComplete = vi.fn();
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(
        <ImportPanel portfolioId="portfolio-1" planId="plan-1" onImportComplete={onImportComplete} />,
      );

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(onImportComplete).toHaveBeenCalled();
      });
    });

    it('shows error when save fails', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockRejectedValue(new Error('Database write failed'));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('import-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/database write failed/i)).toBeInTheDocument();
    });
  });

  describe('cancel import', () => {
    it('returns to upload state on cancel', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-cancel-btn'));

      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
      expect(screen.queryByTestId('import-preview')).not.toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('shows Import More button that resets to upload', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('import-success')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import More'));
      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
    });
  });

  describe('back button', () => {
    it('shows back button in success state', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('import-reset-btn')).toBeInTheDocument();
      });
    });

    it('resets to upload when back button is clicked', async () => {
      const txns = [createMockTransaction()];
      mockDetectAndParse.mockResolvedValue(createMockParseResult(txns));
      mockFindDuplicates.mockReturnValue(createMockDuplicateReport(txns));
      mockAddTransactions.mockResolvedValue(undefined);

      render(<ImportPanel portfolioId="portfolio-1" planId="plan-1" />);

      const input = screen.getByTestId('file-input');
      const file = new File(['test'], 'trades.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('import-preview')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('import-success')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('import-reset-btn'));
      expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
    });
  });
});
