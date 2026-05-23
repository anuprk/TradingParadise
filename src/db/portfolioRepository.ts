import { supabase } from '../lib/supabase';
import type { Portfolio } from '../types/portfolio';
import { deleteTransactionsByPortfolio as deleteTransactions } from './transactionRepository';

/**
 * Maps a Supabase row (snake_case) to a Portfolio object (camelCase).
 */
function toPortfolio(row: Record<string, unknown>): Portfolio {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    initialBalance: row.initial_balance as number,
    planId: row.plan_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Maps a Portfolio object (camelCase) to a Supabase row (snake_case) for insert/update.
 */
function toRow(portfolio: Partial<Portfolio>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (portfolio.id !== undefined) row.id = portfolio.id;
  if (portfolio.name !== undefined) row.name = portfolio.name;
  if (portfolio.description !== undefined) row.description = portfolio.description;
  if (portfolio.initialBalance !== undefined) row.initial_balance = portfolio.initialBalance;
  if (portfolio.planId !== undefined) row.plan_id = portfolio.planId;
  if (portfolio.createdAt !== undefined) row.created_at = portfolio.createdAt instanceof Date ? portfolio.createdAt.toISOString() : portfolio.createdAt;
  if (portfolio.updatedAt !== undefined) row.updated_at = portfolio.updatedAt instanceof Date ? portfolio.updatedAt.toISOString() : portfolio.updatedAt;
  return row;
}

/**
 * Create a new portfolio.
 */
export async function createPortfolio(portfolio: Portfolio): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      id: portfolio.id,
      user_id: userId,
      name: portfolio.name,
      description: portfolio.description,
      initial_balance: portfolio.initialBalance,
      plan_id: portfolio.planId,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create portfolio: ${error.message}`);
  return data.id;
}

/**
 * Get a portfolio by ID.
 */
export async function getPortfolio(
  id: string,
): Promise<Portfolio | undefined> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get portfolio: ${error.message}`);
  if (!data) return undefined;
  return toPortfolio(data);
}

/**
 * Update an existing portfolio. Always bumps `updatedAt`.
 */
export async function updatePortfolio(
  id: string,
  changes: Partial<Portfolio>,
): Promise<void> {
  const row = toRow(changes);
  row.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('portfolios')
    .update(row)
    .eq('id', id);

  if (error) throw new Error(`Failed to update portfolio: ${error.message}`);
}

/**
 * Delete a portfolio by ID.
 * Cascade-deletes all associated transactions before removing the portfolio record.
 */
export async function deletePortfolio(id: string): Promise<void> {
  await deleteTransactions(id);

  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete portfolio: ${error.message}`);
}

/**
 * List all portfolios for a given plan.
 */
export async function listPortfolios(planId: string): Promise<Portfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list portfolios: ${error.message}`);
  return (data || []).map(toPortfolio);
}

/**
 * List every portfolio in the database.
 */
export async function listAllPortfolios(): Promise<Portfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list all portfolios: ${error.message}`);
  return (data || []).map(toPortfolio);
}
