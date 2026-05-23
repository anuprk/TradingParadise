-- Add dividend_yield column to portfolio_holdings for manual override
ALTER TABLE portfolio_holdings ADD COLUMN dividend_yield NUMERIC;
