import { supabase } from '../lib/supabase';
import type { Reminder, ReminderStatus } from '../types/reminder';

/**
 * Maps a Supabase row (snake_case) to a Reminder object (camelCase).
 */
function toReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    strategyId: row.strategy_id as string | undefined,
    activityType: row.activity_type as string | undefined,
    date: new Date(row.date as string),
    time: row.time as string,
    recurrence: row.recurrence as Reminder['recurrence'],
    status: row.status as Reminder['status'],
    planId: row.plan_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Maps a Reminder object (camelCase) to a Supabase row (snake_case).
 * Excludes `id`, `created_at`, and `updated_at` which are handled separately.
 */
function toRow(reminder: Partial<Reminder>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (reminder.title !== undefined) row.title = reminder.title;
  if (reminder.description !== undefined) row.description = reminder.description;
  if (reminder.strategyId !== undefined) row.strategy_id = reminder.strategyId;
  if (reminder.activityType !== undefined) row.activity_type = reminder.activityType;
  if (reminder.date !== undefined) {
    row.date = reminder.date instanceof Date
      ? reminder.date.toISOString().split('T')[0]
      : reminder.date;
  }
  if (reminder.time !== undefined) row.time = reminder.time;
  if (reminder.recurrence !== undefined) row.recurrence = reminder.recurrence;
  if (reminder.status !== undefined) row.status = reminder.status;
  if (reminder.planId !== undefined) row.plan_id = reminder.planId;
  return row;
}

/**
 * Create a new reminder.
 */
export async function createReminder(reminder: Reminder): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      id: reminder.id,
      user_id: userId,
      ...toRow(reminder),
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create reminder: ${error.message}`);
  return data.id;
}

/**
 * Get a reminder by ID.
 */
export async function getReminder(
  id: string,
): Promise<Reminder | undefined> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get reminder: ${error.message}`);
  if (!data) return undefined;
  return toReminder(data);
}

/**
 * Update an existing reminder. Always bumps `updatedAt`.
 */
export async function updateReminder(
  id: string,
  changes: Partial<Reminder>,
): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({
      ...toRow(changes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to update reminder: ${error.message}`);
}

/**
 * Delete a reminder by ID.
 */
export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete reminder: ${error.message}`);
}

/**
 * List all reminders for a given plan, sorted by date ascending.
 */
export async function listReminders(planId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('plan_id', planId)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to list reminders: ${error.message}`);
  return (data ?? []).map(toReminder);
}

/**
 * Query reminders by status (e.g. 'pending', 'snoozed').
 */
export async function getRemindersByStatus(
  status: ReminderStatus,
  planId?: string,
): Promise<Reminder[]> {
  let query = supabase
    .from('reminders')
    .select('*')
    .eq('status', status);

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get reminders by status: ${error.message}`);
  return (data ?? []).map(toReminder);
}

/**
 * Query reminders due on or before a given date.
 * Useful for the reminder engine to find overdue / due-today reminders.
 */
export async function getRemindersDueBy(
  date: Date,
  planId?: string,
): Promise<Reminder[]> {
  const threshold = date.toISOString().split('T')[0];

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('status', 'pending')
    .lte('date', threshold)
    .order('date', { ascending: true });

  if (planId) {
    query = query.eq('plan_id', planId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get reminders due by date: ${error.message}`);
  return (data ?? []).map(toReminder);
}
