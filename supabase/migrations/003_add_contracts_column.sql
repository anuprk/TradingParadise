-- Add contracts column to journal_entries
ALTER TABLE journal_entries ADD COLUMN contracts INTEGER NOT NULL DEFAULT 1;
