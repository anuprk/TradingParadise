import { supabase } from '../lib/supabase';

export interface DailyNote {
  id: string;
  noteDate: string; // YYYY-MM-DD
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all daily notes for the current user, sorted by date descending.
 */
export async function listNotes(): Promise<DailyNote[]> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('*')
    .order('note_date', { ascending: false });

  if (error) throw new Error(`Failed to load notes: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    noteDate: row.note_date,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Upsert a note for a given date. Creates if doesn't exist, updates if it does.
 */
export async function upsertNote(noteDate: string, content: string): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('daily_notes')
    .upsert(
      { user_id: userId, note_date: noteDate, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,note_date' },
    );

  if (error) throw new Error(`Failed to save note: ${error.message}`);
}

/**
 * Delete a note by date.
 */
export async function deleteNote(noteDate: string): Promise<void> {
  const { error } = await supabase
    .from('daily_notes')
    .delete()
    .eq('note_date', noteDate);

  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}
