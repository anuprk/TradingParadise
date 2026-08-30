import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import HoldingsTab from '../HoldingsTab';
import type { PortfolioHolding } from '../../../db/holdingsRepository';

// The current HoldingsTab is a container that loads holdings from the repository
// for a given portfolioId and renders an inline-editable grid. These tests drive
// that behavior by mocking the repository and the live-quote fetch.

const mockGetHoldings = vi.fn();

vi.mock('../../../db/holdingsRepository', () => ({
  getHoldings: (...args: unknown[]) => mockGetHoldings(...args),
  upsertHolding: vi.fn().mockResolvedValue(undefined),
  updateHoldingField: vi.fn().mockResolvedValue(undefined),
  bulkUpdatePrices: vi.fn().mockResolvedValue(undefined),
  deleteHolding: vi.fn().mockResolvedValue(undefined),
}));

// Avoid network/live-price side effects during rendering.
vi.mock('../../../utils/stockPrice', () => ({
  fetchStockQuotes: vi.fn().mockResolvedValue(new Map()),
}));

function makeHolding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  const now = new Date();
  return {
    id: `h-${overrides.symbol ?? 'AAPL'}`,
    portfolioId: 'p1',
    symbol: 'AAPL',
    quantity: 100,
    avgCost: 150,
    currentPrice: 175,
    dividendFrequency: 'quarterly',
    dividendYield: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function renderWithHoldings(holdings: PortfolioHolding[]) {
  mockGetHoldings.mockResolvedValue(holdings);
  render(<HoldingsTab portfolioId="p1" />);
  // Wait for the async load to settle (loading message disappears).
  await waitFor(() => {
    expect(screen.queryByText('Loading holdings...')).not.toBeInTheDocument();
  });
}

describe('HoldingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads holdings for the given portfolio', async () => {
    await renderWithHoldings([makeHolding()]);
    expect(mockGetHoldings).toHaveBeenCalledWith('p1');
  });

  it('renders holdings table with the current columns', async () => {
    await renderWithHoldings([makeHolding()]);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼]/g, '').trim());
    expect(headers).toContain('Symbol');
    expect(headers).toContain('Qty');
    expect(headers).toContain('Avg Cost');
    expect(headers).toContain('Value');
    expect(headers).toContain('P/L');
  });

  it('displays holding data correctly', async () => {
    await renderWithHoldings([
      makeHolding({ symbol: 'MSFT', quantity: 50, avgCost: 300, currentPrice: 320 }),
    ]);
    // Symbol renders as text; editable numeric fields render as inputs.
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    // The data row is the second row (after the header). Scope value assertions to it,
    // since the footer/totals row repeats the same figures for a single holding.
    const dataRow = screen.getAllByRole('row')[1];
    // Original = 50 * 300 = $15,000.00 ; Value = 50 * 320 = $16,000.00 (rendered as text)
    expect(within(dataRow).getByText('$15,000.00')).toBeInTheDocument();
    expect(within(dataRow).getByText('$16,000.00')).toBeInTheDocument();
  });

  it('sorts holdings by symbol ascending by default', async () => {
    await renderWithHoldings([
      makeHolding({ symbol: 'TSLA', quantity: 10 }),
      makeHolding({ symbol: 'AAPL', quantity: 20 }),
      makeHolding({ symbol: 'MSFT', quantity: 30 }),
    ]);
    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; data rows follow in Symbol-ascending order.
    expect(rows[1]).toHaveTextContent('AAPL');
    expect(rows[2]).toHaveTextContent('MSFT');
    expect(rows[3]).toHaveTextContent('TSLA');
  });

  it('color-codes positive P/L in green', async () => {
    // P/L = (currentPrice - avgCost) * qty = (160 - 150) * 100 = +$1,000.00
    await renderWithHoldings([makeHolding({ currentPrice: 160 })]);
    const dataRow = screen.getAllByRole('row')[1];
    const plCell = within(dataRow).getByText('+$1,000.00');
    expect(plCell.className).toContain('text-success');
  });

  it('color-codes negative P/L in red', async () => {
    // P/L = (140 - 150) * 100 = -$1,000.00
    await renderWithHoldings([makeHolding({ currentPrice: 140 })]);
    const dataRow = screen.getAllByRole('row')[1];
    const plCell = within(dataRow).getByText('-$1,000.00');
    expect(plCell.className).toContain('text-error');
  });

  it('renders multiple holdings correctly', async () => {
    await renderWithHoldings([
      makeHolding({ symbol: 'AAPL', quantity: 100 }),
      makeHolding({ symbol: 'GOOGL', quantity: 25 }),
      makeHolding({ symbol: 'TSLA', quantity: 50 }),
    ]);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('only shows holdings with a positive quantity', async () => {
    await renderWithHoldings([
      makeHolding({ symbol: 'AAPL', quantity: 100 }),
      makeHolding({ symbol: 'SOLD', quantity: 0 }),
    ]);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('SOLD')).not.toBeInTheDocument();
  });
});
