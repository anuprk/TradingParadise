-- Dividend calendar: stores projected/actual monthly dividends per symbol
-- Past months are locked (actual received), future months update with latest projections
CREATE TABLE dividend_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  projected_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC, -- NULL means not yet received, set when month passes
  frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, monthly, quarterly, yearly
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, portfolio_id, symbol, year, month)
);

CREATE INDEX idx_dividend_calendar_portfolio ON dividend_calendar(portfolio_id, year, month);
ALTER TABLE dividend_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dividend calendar" ON dividend_calendar FOR ALL USING (auth.uid() = user_id);
