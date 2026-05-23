import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionsTab from '../TransactionsTab';
import type { PortfolioTransaction, TransactionFilterState } from '../../../types/transaction';

function makeTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: 'txn-1',
    portfolioId: 'port-1',
    planId: 'plan-1',
    transactionDate: new Date('2024-03-15'),
    symbol: 'AAPL',
    description: 'Buy AAPL',
    transactionType: 'Buy',
    assetType: 'Stock',
    quantity: 100,
    price: 175.5,
    amount: 17550.0,
    fees: 1.5,
    source: 'csv',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const defaultFilters: TransactionFilterState = {
  symbol: '',
  dateFrom: null,
  dateTo: null,
  transactionType: '',
  assetType: '',
};

const defaultProps = {
  transactions: [] as PortfolioTransaction[],
  totalCount: 0,
  currentPage: 1,
  isLoading: false,
  filters: defaultFilters,
  sortColumn: 'transactionDate',
  sortDirection: 'desc' as const,
  onFiltersChange: vi.fn(),
  onSortChange: vi.fn(),
  onPageChange: vi.fn(),
};

describe('TransactionsTab', () => {
  it('shows empty state when no transactions match', () => {
    render(<TransactionsTab {...defaultProps} />);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<TransactionsTab {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Loading transactions...')).toBeInTheDocument();
  });

  it('renders transactions table with correct columns', () => {
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent?.replace(/[▲▼]/, '').trim());
    expect(headerTexts).toContain('Date');
    expect(headerTexts).toContain('Symbol');
    expect(headerTexts).toContain('Option Type');
    expect(headerTexts).toContain('Direction');
    expect(headerTexts).toContain('Strike');
    expect(headerTexts).toContain('Premium');
    expect(headerTexts).toContain('Fees');
    expect(headerTexts).toContain('P/L');
  });

  it('displays transaction data correctly', () => {
    const transactions = [
      makeTransaction({
        transactionDate: new Date('2024-03-15'),
        symbol: 'MSFT',
        transactionType: 'Sell',
        optionType: 'Call',
        strikePrice: 400.0,
        price: 5.25,
        fees: 0.65,
        amount: 524.35,
        assetType: 'Option',
      }),
    ];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    expect(screen.getByText('03/15/2024')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Call')).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    expect(screen.getByText('$5.25')).toBeInTheDocument();
    expect(screen.getByText('$0.65')).toBeInTheDocument();
    expect(screen.getByText('$524.35')).toBeInTheDocument();

    // "Sell" appears in both the dropdown and the table cell, so check within the table
    const rows = screen.getAllByRole('row');
    const dataRow = rows[rows.length - 1]; // last row is the data row
    expect(dataRow).toHaveTextContent('Sell');
    expect(dataRow).toHaveTextContent('Call');
  });

  it('shows dash for missing option type and strike price', () => {
    const transactions = [makeTransaction({ optionType: undefined, strikePrice: undefined })];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(2); // optionType and strikePrice
  });

  it('color-codes positive P/L in green', () => {
    const transactions = [makeTransaction({ amount: 500.0 })];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    const plCell = screen.getByText('$500.00');
    expect(plCell).toHaveClass('text-success');
  });

  it('color-codes negative P/L in red', () => {
    const transactions = [makeTransaction({ amount: -200.0 })];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    const plCell = screen.getByText('-$200.00');
    expect(plCell).toHaveClass('text-error');
  });

  it('uses neutral styling for zero P/L', () => {
    const transactions = [makeTransaction({ amount: 0 })];
    render(
      <TransactionsTab {...defaultProps} transactions={transactions} totalCount={1} />,
    );

    const plCell = screen.getByText('$0.00');
    expect(plCell).toHaveClass('text-text-primary');
  });

  it('renders filter controls', () => {
    render(<TransactionsTab {...defaultProps} />);

    expect(screen.getByLabelText('Symbol')).toBeInTheDocument();
    expect(screen.getByLabelText('Date From')).toBeInTheDocument();
    expect(screen.getByLabelText('Date To')).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset Type')).toBeInTheDocument();
  });

  it('calls onFiltersChange when symbol filter changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionsTab {...defaultProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'AAPL' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ symbol: 'AAPL' });
  });

  it('calls onFiltersChange when transaction type filter changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionsTab {...defaultProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByLabelText('Transaction Type'), {
      target: { value: 'Buy' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ transactionType: 'Buy' });
  });

  it('calls onFiltersChange when asset type filter changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionsTab {...defaultProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByLabelText('Asset Type'), {
      target: { value: 'Option' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ assetType: 'Option' });
  });

  it('calls onSortChange when a column header is clicked', () => {
    const onSortChange = vi.fn();
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={1}
        onSortChange={onSortChange}
      />,
    );

    const symbolHeader = screen.getByRole('columnheader', { name: 'Symbol' });
    fireEvent.click(symbolHeader);
    expect(onSortChange).toHaveBeenCalledWith('symbol', 'desc');
  });

  it('toggles sort direction when same column is clicked', () => {
    const onSortChange = vi.fn();
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={1}
        sortColumn="transactionDate"
        sortDirection="desc"
        onSortChange={onSortChange}
      />,
    );

    const dateHeader = screen.getByRole('columnheader', { name: /Date/ });
    fireEvent.click(dateHeader);
    expect(onSortChange).toHaveBeenCalledWith('transactionDate', 'asc');
  });

  it('shows sort indicator on active column', () => {
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={1}
        sortColumn="transactionDate"
        sortDirection="desc"
      />,
    );

    expect(screen.getByLabelText('sorted desc')).toBeInTheDocument();
  });

  it('displays pagination controls with correct page info', () => {
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={120}
        currentPage={2}
      />,
    );

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  it('disables Previous button on first page', () => {
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={100}
        currentPage={1}
      />,
    );

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={50}
        currentPage={1}
      />,
    );

    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('calls onPageChange when Previous is clicked', () => {
    const onPageChange = vi.fn();
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={120}
        currentPage={2}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when Next is clicked', () => {
    const onPageChange = vi.fn();
    const transactions = [makeTransaction()];
    render(
      <TransactionsTab
        {...defaultProps}
        transactions={transactions}
        totalCount={120}
        currentPage={1}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
