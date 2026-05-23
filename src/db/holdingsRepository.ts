import { supabase } from '../lib/supabase';

export interface PortfolioHolding {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  dividendFrequency: 'monthly' | 'quarterly' | 'yearly';
  dividendYield: number | null; // Annual yield % (user-editable, not overwritten by refresh)
  createdAt: Date;
  updatedAt: Date;
}

function fromRow(row: Record<string, unknown>): PortfolioHolding {
  return {
    id: row.id as string,
    portfolioId: row.portfolio_id as string,
    symbol: row.symbol as string,
    quantity: Number(row.quantity),
    avgCost: Number(row.avg_cost),
    currentPrice: row.current_price != null ? Number(row.current_price) : null,
    dividendFrequency: (row.dividend_frequency as PortfolioHolding['dividendFrequency']) || 'monthly',
    dividendYield: row.dividend_yield != null ? Number(row.dividend_yield) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Get all holdings for a portfolio.
 */
export async function getHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('symbol');

  if (error) throw new Error(`Failed to load holdings: ${error.message}`);
  return (data ?? []).map(fromRow);
}

/**
 * Upsert a holding (create or update by portfolio + symbol).
 */
export async function upsertHolding(
  portfolioId: string,
  symbol: string,
  changes: Partial<Pick<PortfolioHolding, 'quantity' | 'avgCost' | 'currentPrice' | 'dividendFrequency' | 'dividendYield'>>,
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('portfolio_holdings')
    .upsert(
      {
        user_id: userId,
        portfolio_id: portfolioId,
        symbol: symbol.toUpperCase(),
        quantity: changes.quantity ?? 0,
        avg_cost: changes.avgCost ?? 0,
        current_price: changes.currentPrice ?? null,
        dividend_frequency: changes.dividendFrequency ?? 'monthly',
        dividend_yield: changes.dividendYield ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,portfolio_id,symbol' },
    );

  if (error) throw new Error(`Failed to save holding: ${error.message}`);
}

/**
 * Update a single field on a holding.
 */
export async function updateHoldingField(
  portfolioId: string,
  symbol: string,
  field: 'quantity' | 'avgCost' | 'currentPrice' | 'dividendFrequency' | 'dividendYield',
  value: number | string | null,
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const columnMap: Record<string, string> = {
    quantity: 'quantity',
    avgCost: 'avg_cost',
    currentPrice: 'current_price',
    dividendFrequency: 'dividend_frequency',
    dividendYield: 'dividend_yield',
  };

  const { error } = await supabase
    .from('portfolio_holdings')
    .update({ [columnMap[field]]: value, updated_at: new Date().toISOString() })
    .eq('portfolio_id', portfolioId)
    .eq('symbol', symbol.toUpperCase())
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to update holding: ${error.message}`);
}

/**
 * Delete a holding.
 */
export async function deleteHolding(portfolioId: string, symbol: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_holdings')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('symbol', symbol.toUpperCase());

  if (error) throw new Error(`Failed to delete holding: ${error.message}`);
}

/**
 * Bulk update current prices for all holdings in a portfolio.
 */
export async function bulkUpdatePrices(
  portfolioId: string,
  prices: Record<string, number>,
): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  for (const [symbol, price] of Object.entries(prices)) {
    await supabase
      .from('portfolio_holdings')
      .update({ current_price: price, updated_at: now })
      .eq('portfolio_id', portfolioId)
      .eq('symbol', symbol.toUpperCase())
      .eq('user_id', userId);
  }
}
