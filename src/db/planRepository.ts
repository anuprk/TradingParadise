import { supabase } from '../lib/supabase';
import type { TradingPlan } from '../types/tradingPlan';

/**
 * Maps a TradingPlan object (camelCase) to the Supabase row format (snake_case).
 * Excludes `id` since it's handled separately in inserts/updates.
 */
function toRow(plan: TradingPlan) {
  return {
    id: plan.id,
    name: plan.name,
    author: plan.author,
    year: plan.year,
    goals: plan.goals,
    greeks_targets: plan.greeksTargets,
    risk_management: plan.riskManagement,
    trade_rules: plan.tradeRules,
    daily_management: plan.dailyManagement,
    vacation_rules: plan.vacationRules,
    market_regimes: plan.marketRegimes,
    account_sizing: plan.accountSizing,
    core_strategies: plan.coreStrategies,
    speculative_strategies: plan.speculativeStrategies,
    created_at: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
    updated_at: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt,
  };
}

/**
 * Maps a Supabase row (snake_case) back to a TradingPlan object (camelCase).
 */
function fromRow(row: Record<string, unknown>): TradingPlan {
  return {
    id: row.id as string,
    name: row.name as string,
    author: row.author as string,
    year: row.year as number,
    goals: row.goals as TradingPlan['goals'],
    greeksTargets: row.greeks_targets as TradingPlan['greeksTargets'],
    riskManagement: row.risk_management as TradingPlan['riskManagement'],
    tradeRules: row.trade_rules as TradingPlan['tradeRules'],
    dailyManagement: row.daily_management as TradingPlan['dailyManagement'],
    vacationRules: row.vacation_rules as TradingPlan['vacationRules'],
    marketRegimes: row.market_regimes as TradingPlan['marketRegimes'],
    accountSizing: row.account_sizing as TradingPlan['accountSizing'],
    coreStrategies: row.core_strategies as TradingPlan['coreStrategies'],
    speculativeStrategies: row.speculative_strategies as TradingPlan['speculativeStrategies'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Create a new trading plan.
 */
export async function createPlan(plan: TradingPlan): Promise<string> {
  const now = new Date();
  const planToSave: TradingPlan = {
    ...plan,
    createdAt: now,
    updatedAt: now,
  };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('You must be signed in to create a plan.');
  }

  const row = toRow(planToSave);
  const { data, error } = await supabase
    .from('plans')
    .insert({ ...row, user_id: userId })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create plan: ${error.message}`);
  }

  return data.id;
}

/**
 * Get a trading plan by ID.
 */
export async function getPlan(id: string): Promise<TradingPlan | undefined> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load plan: ${error.message}`);
  }

  return data ? fromRow(data) : undefined;
}

/**
 * Update an existing trading plan. Always bumps `updatedAt`.
 */
export async function updatePlan(
  id: string,
  changes: Partial<TradingPlan>,
): Promise<void> {
  const updatedFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (changes.name !== undefined) updatedFields.name = changes.name;
  if (changes.author !== undefined) updatedFields.author = changes.author;
  if (changes.year !== undefined) updatedFields.year = changes.year;
  if (changes.goals !== undefined) updatedFields.goals = changes.goals;
  if (changes.greeksTargets !== undefined) updatedFields.greeks_targets = changes.greeksTargets;
  if (changes.riskManagement !== undefined) updatedFields.risk_management = changes.riskManagement;
  if (changes.tradeRules !== undefined) updatedFields.trade_rules = changes.tradeRules;
  if (changes.dailyManagement !== undefined) updatedFields.daily_management = changes.dailyManagement;
  if (changes.vacationRules !== undefined) updatedFields.vacation_rules = changes.vacationRules;
  if (changes.marketRegimes !== undefined) updatedFields.market_regimes = changes.marketRegimes;
  if (changes.accountSizing !== undefined) updatedFields.account_sizing = changes.accountSizing;
  if (changes.coreStrategies !== undefined) updatedFields.core_strategies = changes.coreStrategies;
  if (changes.speculativeStrategies !== undefined) updatedFields.speculative_strategies = changes.speculativeStrategies;

  const { error } = await supabase
    .from('plans')
    .update(updatedFields)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update plan: ${error.message}`);
  }
}

/**
 * Delete a trading plan by ID.
 */
export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete plan: ${error.message}`);
  }
}

/**
 * List all trading plans, ordered by most recently updated first.
 */
export async function listPlans(): Promise<TradingPlan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load plans: ${error.message}`);
  }

  return (data ?? []).map(fromRow);
}

/**
 * Get the most recently updated (last accessed) trading plan.
 * Returns undefined when no plans exist.
 */
export async function getLastAccessed(): Promise<TradingPlan | undefined> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load last accessed plan: ${error.message}`);
  }

  return data ? fromRow(data) : undefined;
}
