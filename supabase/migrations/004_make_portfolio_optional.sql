-- Make portfolio_id optional for journal entries (journal and portfolio are independent)
ALTER TABLE journal_entries ALTER COLUMN portfolio_id DROP NOT NULL;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_portfolio_id_fkey;
