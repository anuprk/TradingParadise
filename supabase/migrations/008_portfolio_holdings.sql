-- Portfolio holdings table: stores user-editable holding data
CREATE TABLE portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC,
  dividend_frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, portfolio_id, symbol)
);

CREATE INDEX idx_portfolio_holdings_portfolio ON portfolio_holdings(portfolio_id);
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own holdings" ON portfolio_holdings FOR ALL USING (auth.uid() = user_id);
