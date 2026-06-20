-- Migration: Add stock transaction support to journal_entries
-- Adds instrument_type and quantity columns to support both options and stock trades
-- in the same table. Existing entries default to 'Option'.

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS instrument_type TEXT NOT NULL DEFAULT 'Option',
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;

-- Add a check constraint for valid instrument types
ALTER TABLE journal_entries
  ADD CONSTRAINT chk_instrument_type CHECK (instrument_type IN ('Option', 'Stock'));

-- Index for filtering by instrument type
CREATE INDEX IF NOT EXISTS idx_journal_entries_instrument_type
  ON journal_entries (instrument_type);

-- Comment explaining the design:
-- Stock transactions use the same table as options for unified P/L tracking.
-- For stocks: quantity = number of shares, stock_price_doc = entry price per share,
--   exit_price = sell price per share. Option-specific fields (strike_price, premium,
--   expiration_date, etc.) are set to 0/same-as-open-date for stocks.
