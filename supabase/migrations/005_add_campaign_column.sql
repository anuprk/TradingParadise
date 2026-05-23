-- Add campaign column to journal_entries
ALTER TABLE journal_entries ADD COLUMN campaign TEXT NOT NULL DEFAULT '';
