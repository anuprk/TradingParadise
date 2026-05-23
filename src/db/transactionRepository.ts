import { supabase } from '../lib/supabase';
import type {
  PortfolioTransaction,
  TransactionFilterState,
} from '../types/transaction';

const TABLE = 'portfolio_transactions';

/**
 * Convert a camelCase PortfolioTransaction to the snake_case DB row format.
 */
function toDbRow(txn: PortfolioTransaction) {
  return {
    id: txn.id,
    portfolio_id: txn.portfolioId,
    plan_id: txn.planId,
    transaction_date: txn.transactionDate,
    settlement_date: txn.settlementDate ?? null,
    symbol: txn.symbol,
    description: txn.description,
    transaction_type: txn.transactionType,
    asset_type: txn.assetType,
    option_type: txn.optionType ?? null,
    strike_price: txn.strikePrice ?? null,
    expiration_date: txn.expirationDate ?? null,
    quantity: txn.quantity,
    price: txn.price,
    amount: txn.amount,
    fees: txn.fees,
    source: txn.source,
    raw_description: txn.rawDescription ?? null,
    strategy_id: txn.strategyId ?? null,
    margin_used: txn.marginUsed ?? null,
    annualized_return: txn.annualizedReturn ?? null,
    return_on_margin: txn.returnOnMargin ?? null,
  };
}

/**
 * Convert a snake_case DB row to a camelCase PortfolioTransaction.
 */
function fromDbRow(row: Record<string, unknown>): PortfolioTransaction {
  return {
    id: row.id as string,
    portfolioId: row.portfolio_id as string,
    planId: row.plan_id as string,
    transactionDate: new Date(row.transaction_date as string),
    settlementDate: row.settlement_date
      ? new Date(row.settlement_date as string)
      : undefined,
    symbol: row.symbol as string,
    description: row.description as string,
    transactionType: row.transaction_type as PortfolioTransaction['transactionType'],
    assetType: row.asset_type as PortfolioTransaction['assetType'],
    optionType: (row.option_type as PortfolioTransaction['optionType']) ?? undefined,
    strikePrice: row.strike_price != null ? Number(row.strike_price) : undefined,
    expirationDate: row.expiration_date
      ? new Date(row.expiration_date as string)
      : undefined,
    quantity: Number(row.quantity),
    price: Number(row.price),
    amount: Number(row.amount),
    fees: Number(row.fees),
    source: row.source as PortfolioTransaction['source'],
    rawDescription: (row.raw_description as string) ?? undefined,
    strategyId: (row.strategy_id as string) ?? undefined,
    marginUsed: row.margin_used != null ? Number(row.margin_used) : undefined,
    annualizedReturn:
      row.annualized_return != null ? Number(row.annualized_return) : undefined,
    returnOnMargin:
      row.return_on_margin != null ? Number(row.return_on_margin) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Get the authenticated user's ID. Throws if not authenticated.
 */
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Not authenticated. Please sign in to continue.');
  }
  return data.user.id;
}

/**
 * Add a single transaction to the database.
 */
export async function addTransaction(
  transaction: PortfolioTransaction,
): Promise<string> {
  const userId = await getUserId();
  const row = toDbRow(transaction);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...row, user_id: userId })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to add transaction: ${error.message}`);
  }
  return data.id;
}

/**
 * Add multiple transactions in a single bulk operation.
 */
export async function bulkAddTransactions(
  transactions: PortfolioTransaction[],
): Promise<void> {
  if (transactions.length === 0) return;

  const userId = await getUserId();
  const rows = transactions.map((txn) => ({
    ...toDbRow(txn),
    user_id: userId,
  }));

  const { error } = await supabase.from(TABLE).insert(rows);

  if (error) {
    throw new Error(`Failed to bulk add transactions: ${error.message}`);
  }
}

/**
 * Get all transactions for a given portfolio.
 */
export async function getTransactionsByPortfolio(
  portfolioId: string,
): Promise<PortfolioTransaction[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('transaction_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }
  return (data ?? []).map(fromDbRow);
}

/**
 * Get transactions for a portfolio with optional filters and pagination.
 * Supports offset/limit for paginated queries.
 */
export async function getTransactionsByPortfolioFiltered(
  portfolioId: string,
  filters?: Partial<TransactionFilterState>,
  offset = 0,
  limit = 50,
): Promise<PortfolioTransaction[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('portfolio_id', portfolioId);

  if (filters) {
    if (filters.symbol) {
      query = query.ilike('symbol', `%${filters.symbol}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('transaction_date', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      query = query.lte('transaction_date', filters.dateTo.toISOString());
    }
    if (filters.transactionType) {
      query = query.eq('transaction_type', filters.transactionType);
    }
    if (filters.assetType) {
      query = query.eq('asset_type', filters.assetType);
    }
  }

  query = query
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch filtered transactions: ${error.message}`);
  }
  return (data ?? []).map(fromDbRow);
}

/**
 * Delete all transactions associated with a portfolio.
 */
export async function deleteTransactionsByPortfolio(
  portfolioId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('portfolio_id', portfolioId);

  if (error) {
    throw new Error(
      `Failed to delete transactions for portfolio: ${error.message}`,
    );
  }
}

/**
 * Delete a single transaction by ID.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete transaction: ${error.message}`);
  }
}

/**
 * Update a single transaction by ID.
 */
export async function updateTransaction(
  id: string,
  changes: Partial<PortfolioTransaction>,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (changes.transactionDate !== undefined) updatePayload.transaction_date = changes.transactionDate;
  if (changes.settlementDate !== undefined) updatePayload.settlement_date = changes.settlementDate ?? null;
  if (changes.symbol !== undefined) updatePayload.symbol = changes.symbol;
  if (changes.description !== undefined) updatePayload.description = changes.description;
  if (changes.transactionType !== undefined) updatePayload.transaction_type = changes.transactionType;
  if (changes.assetType !== undefined) updatePayload.asset_type = changes.assetType;
  if (changes.optionType !== undefined) updatePayload.option_type = changes.optionType ?? null;
  if (changes.strikePrice !== undefined) updatePayload.strike_price = changes.strikePrice ?? null;
  if (changes.expirationDate !== undefined) updatePayload.expiration_date = changes.expirationDate ?? null;
  if (changes.quantity !== undefined) updatePayload.quantity = changes.quantity;
  if (changes.price !== undefined) updatePayload.price = changes.price;
  if (changes.amount !== undefined) updatePayload.amount = changes.amount;
  if (changes.fees !== undefined) updatePayload.fees = changes.fees;
  if (changes.strategyId !== undefined) updatePayload.strategy_id = changes.strategyId ?? null;
  if (changes.marginUsed !== undefined) updatePayload.margin_used = changes.marginUsed ?? null;

  const { error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update transaction: ${error.message}`);
  }
}

/**
 * Count the total number of transactions for a portfolio,
 * optionally applying filters.
 */
export async function countTransactionsByPortfolio(
  portfolioId: string,
  filters?: Partial<TransactionFilterState>,
): Promise<number> {
  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId);

  if (filters && !isEmptyFilters(filters)) {
    if (filters.symbol) {
      query = query.ilike('symbol', `%${filters.symbol}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('transaction_date', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      query = query.lte('transaction_date', filters.dateTo.toISOString());
    }
    if (filters.transactionType) {
      query = query.eq('transaction_type', filters.transactionType);
    }
    if (filters.assetType) {
      query = query.eq('asset_type', filters.assetType);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count transactions: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Check if a filters object has no active filter values.
 */
function isEmptyFilters(filters: Partial<TransactionFilterState>): boolean {
  return (
    !filters.symbol &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.transactionType &&
    !filters.assetType
  );
}
