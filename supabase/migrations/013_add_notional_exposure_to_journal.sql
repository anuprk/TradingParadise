-- Add notional_exposure column to journal_entries: dollar value of the
-- underlying position at risk. Manually editable, similar to margin_cash_reserve.
-- Options: strike * 100 * contracts (0 for debit trades, premium < 0).
-- Stock: entry price * quantity.
ALTER TABLE journal_entries ADD COLUMN notional_exposure NUMERIC;

-- Backfill existing rows so aggregates (e.g. the Total Notional banner stat)
-- remain accurate immediately after migration, without requiring every row
-- to be individually edited first.
UPDATE journal_entries
SET notional_exposure = CASE
  WHEN instrument_type = 'Stock' THEN COALESCE(stock_price_doc, 0) * COALESCE(quantity, 0)
  WHEN COALESCE(premium, 0) < 0 THEN 0
  ELSE COALESCE(strike_price, 0) * 100 * COALESCE(contracts, 1)
END;
