import { supabase } from '../lib/supabase';
import type { TradeJournalEntry, OptionType, TradeStatus, WinLoss } from '../types/journal';

/**
 * Optional filters for querying journal entries.
 * All fields are optional — only supplied fields are applied.
 */
export interface JournalFilters {
  strategyId?: string;
  portfolioId?: string;
  planId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  stockSymbol?: string;
  optionType?: OptionType;
  tradeStatus?: TradeStatus;
  winLoss?: WinLoss;
}

/**
 * Formats a Date as a YYYY-MM-DD string for PostgreSQL DATE columns.
 * Falls back to today's date if the input is invalid to prevent DB errors.
 */
function toDateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns null if the value is NaN, Infinity, undefined, or null.
 * Otherwise returns the numeric value. Ensures PostgreSQL NUMERIC columns
 * never receive invalid input.
 */
function safeNumeric(value: number | undefined | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Same as safeNumeric but returns 0 instead of null for NOT NULL columns.
 */
function safeNumericNotNull(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

/**
 * Returns null if the value is NaN or undefined, otherwise the integer.
 */
function safeInt(value: number | undefined | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/**
 * Maps a camelCase TradeJournalEntry to the snake_case DB row format.
 */
function toDbRow(entry: TradeJournalEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    stock_symbol: entry.stockSymbol,
    campaign: entry.campaign || '',
    open_date: toDateString(entry.openDate),
    expiration_date: toDateString(entry.expirationDate),
    option_type: entry.optionType,
    direction: entry.direction,
    stock_price_doc: safeNumericNotNull(entry.stockPriceDOC),
    dte: Number.isFinite(entry.dte) ? entry.dte : 0,
    ditc: Number.isFinite(entry.ditc) ? entry.ditc : 0,
    current_stock_price: safeNumeric(entry.currentStockPrice),
    break_even_price: safeNumericNotNull(entry.breakEvenPrice),
    strike_price: safeNumericNotNull(entry.strikePrice),
    premium: safeNumericNotNull(entry.premium),
    contracts: entry.contracts ?? 1,
    cash_reserve: safeNumericNotNull(entry.cashReserve),
    margin_cash_reserve: safeNumeric(entry.marginCashReserve),
    fees: safeNumericNotNull(entry.fees),
    exit_price: safeNumeric(entry.exitPrice),
    close_date: entry.closeDate ? toDateString(entry.closeDate) : null,
    profit_loss: safeNumeric(entry.profitLoss),
    win_loss: entry.winLoss ?? null,
    days_held: safeInt(entry.daysHeld),
    annualized_ror: safeNumeric(entry.annualizedROR),
    margin_annualized_ror: safeNumeric(entry.marginAnnualizedROR),
    trade_status: entry.tradeStatus,
    portfolio_id: entry.portfolioId || null,
    strategy_id: entry.strategyId,
    plan_id: entry.planId,
    unrealized_pl: safeNumeric(entry.unrealizedPL),
    notes: entry.notes,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
  };
}

/**
 * Maps a snake_case DB row back to a camelCase TradeJournalEntry.
 */
function fromDbRow(row: Record<string, unknown>): TradeJournalEntry {
  return {
    id: row.id as string,
    stockSymbol: row.stock_symbol as string,
    campaign: (row.campaign as string) || '',
    openDate: new Date((row.open_date as string) + 'T12:00:00'),
    expirationDate: new Date((row.expiration_date as string) + 'T12:00:00'),
    optionType: row.option_type as OptionType,
    direction: row.direction as TradeJournalEntry['direction'],
    stockPriceDOC: Number(row.stock_price_doc),
    dte: row.dte as number,
    ditc: row.ditc as number,
    currentStockPrice: row.current_stock_price != null ? Number(row.current_stock_price) : undefined,
    breakEvenPrice: Number(row.break_even_price),
    strikePrice: Number(row.strike_price),
    premium: Number(row.premium),
    contracts: row.contracts != null ? Number(row.contracts) : 1,
    cashReserve: Number(row.cash_reserve),
    marginCashReserve: row.margin_cash_reserve != null ? Number(row.margin_cash_reserve) : undefined,
    fees: Number(row.fees),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : undefined,
    closeDate: row.close_date ? new Date((row.close_date as string) + 'T12:00:00') : undefined,
    profitLoss: row.profit_loss != null ? Number(row.profit_loss) : undefined,
    winLoss: (row.win_loss as WinLoss) ?? null,
    daysHeld: row.days_held != null ? (row.days_held as number) : undefined,
    annualizedROR: row.annualized_ror != null ? Number(row.annualized_ror) : undefined,
    marginAnnualizedROR: row.margin_annualized_ror != null ? Number(row.margin_annualized_ror) : undefined,
    tradeStatus: row.trade_status as TradeStatus,
    portfolioId: (row.portfolio_id as string) ?? undefined,
    strategyId: row.strategy_id as string,
    planId: row.plan_id as string,
    unrealizedPL: row.unrealized_pl != null ? Number(row.unrealized_pl) : undefined,
    notes: row.notes as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Create a new journal entry.
 */
export async function createJournalEntry(
  entry: TradeJournalEntry,
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  // Validate required UUID fields to prevent "invalid input syntax for type uuid"
  if (!entry.planId || entry.planId.trim() === '') {
    throw new Error('Plan is required. Please select a plan before importing.');
  }

  // Validate required dates to prevent "invalid input syntax for type date"
  if (!(entry.openDate instanceof Date) || isNaN(entry.openDate.getTime())) {
    throw new Error(`Invalid open date for ${entry.stockSymbol || 'unknown symbol'}`);
  }
  if (!(entry.expirationDate instanceof Date) || isNaN(entry.expirationDate.getTime())) {
    throw new Error(`Invalid expiration date for ${entry.stockSymbol || 'unknown symbol'}`);
  }

  const now = new Date().toISOString();
  const row = toDbRow({ ...entry, createdAt: new Date(now), updatedAt: new Date(now) }, userId);

  const { error } = await supabase
    .from('journal_entries')
    .insert(row);

  if (error) throw new Error(`Failed to create journal entry: ${error.message}`);
  return entry.id;
}

/**
 * Get a journal entry by ID.
 */
export async function getJournalEntry(
  id: string,
): Promise<TradeJournalEntry | undefined> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get journal entry: ${error.message}`);
  if (!data) return undefined;
  return fromDbRow(data);
}

/**
 * Update an existing journal entry. Always bumps `updatedAt`.
 */
export async function updateJournalEntry(
  id: string,
  changes: Partial<TradeJournalEntry>,
): Promise<void> {
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (changes.stockSymbol !== undefined) updatePayload.stock_symbol = changes.stockSymbol;
  if (changes.campaign !== undefined) updatePayload.campaign = changes.campaign;
  if (changes.openDate !== undefined) updatePayload.open_date = changes.openDate;
  if (changes.expirationDate !== undefined) updatePayload.expiration_date = changes.expirationDate;
  if (changes.optionType !== undefined) updatePayload.option_type = changes.optionType;
  if (changes.direction !== undefined) updatePayload.direction = changes.direction;
  if (changes.stockPriceDOC !== undefined) updatePayload.stock_price_doc = changes.stockPriceDOC;
  if (changes.dte !== undefined) updatePayload.dte = changes.dte;
  if (changes.ditc !== undefined) updatePayload.ditc = changes.ditc;
  if (changes.currentStockPrice !== undefined) updatePayload.current_stock_price = changes.currentStockPrice;
  if (changes.breakEvenPrice !== undefined) updatePayload.break_even_price = changes.breakEvenPrice;
  if (changes.strikePrice !== undefined) updatePayload.strike_price = changes.strikePrice;
  if (changes.premium !== undefined) updatePayload.premium = changes.premium;
  if (changes.contracts !== undefined) updatePayload.contracts = changes.contracts;
  if (changes.cashReserve !== undefined) updatePayload.cash_reserve = changes.cashReserve;
  if (changes.marginCashReserve !== undefined) updatePayload.margin_cash_reserve = changes.marginCashReserve;
  if (changes.fees !== undefined) updatePayload.fees = changes.fees;
  if (changes.exitPrice !== undefined) updatePayload.exit_price = changes.exitPrice;
  if (changes.closeDate !== undefined) updatePayload.close_date = changes.closeDate;
  if (changes.profitLoss !== undefined) updatePayload.profit_loss = changes.profitLoss;
  if (changes.winLoss !== undefined) updatePayload.win_loss = changes.winLoss;
  if (changes.daysHeld !== undefined) updatePayload.days_held = changes.daysHeld;
  if (changes.annualizedROR !== undefined) updatePayload.annualized_ror = changes.annualizedROR;
  if (changes.marginAnnualizedROR !== undefined) updatePayload.margin_annualized_ror = changes.marginAnnualizedROR;
  if (changes.tradeStatus !== undefined) updatePayload.trade_status = changes.tradeStatus;
  if (changes.portfolioId !== undefined) updatePayload.portfolio_id = changes.portfolioId || null;
  if (changes.strategyId !== undefined) updatePayload.strategy_id = changes.strategyId;
  if (changes.planId !== undefined) updatePayload.plan_id = changes.planId;
  if (changes.unrealizedPL !== undefined) updatePayload.unrealized_pl = changes.unrealizedPL;
  if (changes.notes !== undefined) updatePayload.notes = changes.notes;

  const { error } = await supabase
    .from('journal_entries')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw new Error(`Failed to update journal entry: ${error.message}`);
}

/**
 * Delete a journal entry by ID.
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete journal entry: ${error.message}`);
}

/**
 * Bulk update strategy_id for entries matching criteria.
 * Used to assign default strategies to existing records.
 */
export async function bulkAssignStrategy(
  planId: string,
  strategyId: string,
  criteria: { optionType?: string; direction?: string; dteGreaterThan?: number },
): Promise<number> {
  let query = supabase
    .from('journal_entries')
    .update({ strategy_id: strategyId, updated_at: new Date().toISOString() })
    .eq('plan_id', planId);

  if (criteria.optionType) {
    query = query.eq('option_type', criteria.optionType);
  }
  if (criteria.direction) {
    query = query.eq('direction', criteria.direction);
  }
  if (criteria.dteGreaterThan != null) {
    query = query.gt('dte', criteria.dteGreaterThan);
  }

  const { error, count } = await query.select('id', { count: 'exact', head: true });
  // Actually perform the update (the above was just for count)
  if (error) throw new Error(`Failed to bulk assign strategy: ${error.message}`);
  return count ?? 0;
}

/**
 * Assign default strategies to all entries in a plan based on rules:
 * Applied in order (last wins for overlapping criteria):
 * 1. ALL entries → Short Put (default)
 * 2. Call + Sell → Short Call
 * 3. DTE > 150 → Leap
 */
export async function assignDefaultStrategies(
  planId: string,
  shortPutId: string,
  shortCallId: string,
  leapId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Step 1: Assign Short Put to ALL entries in this plan
  if (shortPutId) {
    const { error } = await supabase
      .from('journal_entries')
      .update({ strategy_id: shortPutId, updated_at: now })
      .eq('plan_id', planId);
    if (error) throw new Error(`Failed to assign Short Put: ${error.message}`);
  }

  // Step 2: Override with Short Call for Call + Sell
  if (shortCallId) {
    const { error } = await supabase
      .from('journal_entries')
      .update({ strategy_id: shortCallId, updated_at: now })
      .eq('plan_id', planId)
      .eq('option_type', 'Call')
      .eq('direction', 'Sell');
    if (error) throw new Error(`Failed to assign Short Call: ${error.message}`);
  }

  // Step 3: Override with Leap for DTE > 150
  if (leapId) {
    const { error } = await supabase
      .from('journal_entries')
      .update({ strategy_id: leapId, updated_at: now })
      .eq('plan_id', planId)
      .gt('dte', 150);
    if (error) throw new Error(`Failed to assign Leap: ${error.message}`);
  }
}

export interface DailyPL { date: string; pl: number; wins: number; losses: number }
export interface WeeklyPL { weekStart: string; pl: number; wins: number; losses: number; trades: number }
export interface MonthlyPLBreakdown { month: string; label: string; pl: number; wins: number; losses: number; trades: number; winRate: number }
export interface YearlyStats { year: number; pl: number; wins: number; losses: number; trades: number; winRate: number; highestWin: number; highestLoss: number }

/**
 * Get aggregated P/L stats for all closed trades in a plan.
 */
export async function getJournalStats(planId: string): Promise<{
  totalPL: number;
  winCount: number;
  lossCount: number;
  closedCount: number;
  monthlyPL: number;
  yearlyPL: Record<number, number>;
  dailyPL: DailyPL[];
  weeklyPL: WeeklyPL[];
  monthlyBreakdown: MonthlyPLBreakdown[];
  yearlyStats: YearlyStats[];
  campaignStats: { campaign: string; pl: number; wins: number; losses: number; trades: number; winRate: number }[];
}> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('profit_loss, win_loss, close_date, trade_status, campaign')
    .eq('plan_id', planId)
    .neq('trade_status', 'Open');

  if (error) throw new Error(`Failed to get journal stats: ${error.message}`);

  const rows = data ?? [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalPL = 0;
  let winCount = 0;
  let lossCount = 0;
  let monthlyPL = 0;
  const yearlyPL: Record<number, number> = {};
  const dailyMap = new Map<string, { pl: number; wins: number; losses: number }>();
  const weeklyMap = new Map<string, { pl: number; wins: number; losses: number; trades: number }>();
  const monthlyMap = new Map<string, { pl: number; wins: number; losses: number; trades: number }>();
  const yearlyStatsMap = new Map<number, { pl: number; wins: number; losses: number; trades: number; highestWin: number; highestLoss: number }>();
  const campaignMap = new Map<string, { pl: number; wins: number; losses: number; trades: number }>();

  for (const row of rows) {
    const pl = row.profit_loss != null ? Number(row.profit_loss) : 0;
    const isWin = row.win_loss === 'Win';
    const isLoss = row.win_loss === 'Loss';
    totalPL += pl;
    if (isWin) winCount++;
    if (isLoss) lossCount++;

    if (row.close_date) {
      const closeDate = new Date((row.close_date as string) + 'T12:00:00');
      const closeYear = closeDate.getFullYear();
      const closeMonth = closeDate.getMonth();

      if (closeMonth === currentMonth && closeYear === currentYear) monthlyPL += pl;
      yearlyPL[closeYear] = (yearlyPL[closeYear] || 0) + pl;

      // Daily (current month)
      if (closeMonth === currentMonth && closeYear === currentYear) {
        const dayKey = closeDate.toISOString().split('T')[0];
        const d = dailyMap.get(dayKey) || { pl: 0, wins: 0, losses: 0 };
        d.pl += pl; if (isWin) d.wins++; if (isLoss) d.losses++;
        dailyMap.set(dayKey, d);
      }

      // Weekly (current month)
      if (closeMonth === currentMonth && closeYear === currentYear) {
        const weekNum = Math.ceil(closeDate.getDate() / 7);
        const weekStart = new Date(closeYear, closeMonth, (weekNum - 1) * 7 + 1).toISOString().split('T')[0];
        const w = weeklyMap.get(weekStart) || { pl: 0, wins: 0, losses: 0, trades: 0 };
        w.pl += pl; w.trades++; if (isWin) w.wins++; if (isLoss) w.losses++;
        weeklyMap.set(weekStart, w);
      }

      // Monthly (current year)
      if (closeYear === currentYear) {
        const monthKey = `${closeYear}-${String(closeMonth + 1).padStart(2, '0')}`;
        const m = monthlyMap.get(monthKey) || { pl: 0, wins: 0, losses: 0, trades: 0 };
        m.pl += pl; m.trades++; if (isWin) m.wins++; if (isLoss) m.losses++;
        monthlyMap.set(monthKey, m);
      }

      // Yearly stats
      const ys = yearlyStatsMap.get(closeYear) || { pl: 0, wins: 0, losses: 0, trades: 0, highestWin: 0, highestLoss: 0 };
      ys.pl += pl; ys.trades++;
      if (isWin) { ys.wins++; if (pl > ys.highestWin) ys.highestWin = pl; }
      if (isLoss) { ys.losses++; if (pl < ys.highestLoss) ys.highestLoss = pl; }
      yearlyStatsMap.set(closeYear, ys);
    }

    // Campaign stats
    const campaign = (row.campaign as string) || '';
    if (campaign) {
      const cs = campaignMap.get(campaign) || { pl: 0, wins: 0, losses: 0, trades: 0 };
      cs.pl += pl; cs.trades++;
      if (isWin) cs.wins++;
      if (isLoss) cs.losses++;
      campaignMap.set(campaign, cs);
    }
  }

  const ML = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return {
    totalPL, winCount, lossCount, closedCount: rows.length, monthlyPL, yearlyPL,
    dailyPL: Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date)),
    weeklyPL: Array.from(weeklyMap.entries()).map(([weekStart, w]) => ({ weekStart, ...w })).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    monthlyBreakdown: Array.from(monthlyMap.entries()).map(([month, m]) => ({ month, label: ML[parseInt(month.split('-')[1]) - 1], ...m, winRate: m.trades > 0 ? (m.wins / m.trades) * 100 : 0 })).sort((a, b) => a.month.localeCompare(b.month)),
    yearlyStats: Array.from(yearlyStatsMap.entries()).map(([year, ys]) => ({ year, ...ys, winRate: ys.trades > 0 ? (ys.wins / ys.trades) * 100 : 0 })).sort((a, b) => b.year - a.year),
    campaignStats: Array.from(campaignMap.entries()).map(([campaign, cs]) => ({ campaign, ...cs, winRate: cs.trades > 0 ? (cs.wins / cs.trades) * 100 : 0 })).sort((a, b) => b.pl - a.pl),
  };
}

/**
 * List all journal entries for a given plan, sorted by openDate descending.
 */
export async function listJournalEntries(
  planId: string,
): Promise<TradeJournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('plan_id', planId)
    .order('open_date', { ascending: false });

  if (error) throw new Error(`Failed to list journal entries: ${error.message}`);
  return (data ?? []).map(fromDbRow);
}

/**
 * Filter journal entries using flexible optional criteria.
 * Builds a Supabase query with all supplied filters applied server-side.
 */
export async function filterJournalEntries(
  filters: JournalFilters,
  offset = 0,
  limit = 20,
): Promise<{ entries: TradeJournalEntry[]; total: number }> {
  let query = supabase
    .from('journal_entries')
    .select('*', { count: 'exact' });

  if (filters.planId) {
    query = query.eq('plan_id', filters.planId);
  }
  if (filters.strategyId) {
    query = query.eq('strategy_id', filters.strategyId);
  }
  if (filters.portfolioId) {
    query = query.eq('portfolio_id', filters.portfolioId);
  }
  if (filters.stockSymbol) {
    query = query.eq('stock_symbol', filters.stockSymbol);
  }
  if (filters.optionType) {
    query = query.eq('option_type', filters.optionType);
  }
  if (filters.tradeStatus) {
    query = query.eq('trade_status', filters.tradeStatus);
  }
  if (filters.winLoss !== undefined) {
    if (filters.winLoss === null) {
      query = query.is('win_loss', null);
    } else {
      query = query.eq('win_loss', filters.winLoss);
    }
  }
  if (filters.dateFrom) {
    query = query.gte('open_date', filters.dateFrom.toISOString().split('T')[0]);
  }
  if (filters.dateTo) {
    query = query.lte('open_date', filters.dateTo.toISOString().split('T')[0]);
  }

  query = query.order('open_date', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to filter journal entries: ${error.message}`);
  return { entries: (data ?? []).map(fromDbRow), total: count ?? 0 };
}
