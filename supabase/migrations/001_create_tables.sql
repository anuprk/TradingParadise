how -- Migration: Create all data tables for TradingParadise
-- Tables: plans, portfolios, journal_entries, reminders, portfolio_transactions

-- =============================================================================
-- plans
-- =============================================================================
CREATE TABLE plans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  greeks_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_management JSONB NOT NULL DEFAULT '{}'::jsonb,
  trade_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  daily_management JSONB NOT NULL DEFAULT '{}'::jsonb,
  vacation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_regimes JSONB NOT NULL DEFAULT '[]'::jsonb,
  account_sizing JSONB NOT NULL DEFAULT '{}'::jsonb,
  core_strategies JSONB NOT NULL DEFAULT '[]'::jsonb,
  speculative_strategies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_year ON plans(year);

-- =============================================================================
-- portfolios
-- =============================================================================
CREATE TABLE portfolios (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolios_plan_id ON portfolios(plan_id);

-- =============================================================================
-- journal_entries
-- =============================================================================
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_symbol TEXT NOT NULL,
  open_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  option_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  stock_price_doc NUMERIC NOT NULL,
  dte INTEGER NOT NULL,
  ditc INTEGER NOT NULL,
  current_stock_price NUMERIC,
  break_even_price NUMERIC NOT NULL,
  strike_price NUMERIC NOT NULL,
  premium NUMERIC NOT NULL,
  cash_reserve NUMERIC NOT NULL,
  margin_cash_reserve NUMERIC,
  fees NUMERIC NOT NULL,
  exit_price NUMERIC,
  close_date DATE,
  profit_loss NUMERIC,
  win_loss TEXT,
  days_held INTEGER,
  annualized_ror NUMERIC,
  margin_annualized_ror NUMERIC,
  trade_status TEXT NOT NULL,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  unrealized_pl NUMERIC,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_portfolio_id ON journal_entries(portfolio_id);
CREATE INDEX idx_journal_entries_plan_id ON journal_entries(plan_id);
CREATE INDEX idx_journal_entries_trade_status ON journal_entries(trade_status);
CREATE INDEX idx_journal_entries_open_date ON journal_entries(open_date);
CREATE INDEX idx_journal_entries_stock_symbol ON journal_entries(stock_symbol);

-- =============================================================================
-- reminders
-- =============================================================================
CREATE TABLE reminders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  strategy_id TEXT,
  activity_type TEXT,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_plan_id ON reminders(plan_id);
CREATE INDEX idx_reminders_date ON reminders(date);
CREATE INDEX idx_reminders_status ON reminders(status);

-- =============================================================================
-- portfolio_transactions
-- =============================================================================
CREATE TABLE portfolio_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  settlement_date DATE,
  symbol TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  transaction_type TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  option_type TEXT,
  strike_price NUMERIC,
  expiration_date DATE,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  fees NUMERIC NOT NULL,
  source TEXT NOT NULL,
  raw_description TEXT,
  strategy_id TEXT,
  margin_used NUMERIC,
  annualized_return NUMERIC,
  return_on_margin NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_transactions_user_id ON portfolio_transactions(user_id);
CREATE INDEX idx_portfolio_transactions_portfolio_id ON portfolio_transactions(portfolio_id);
CREATE INDEX idx_portfolio_transactions_plan_id ON portfolio_transactions(plan_id);
CREATE INDEX idx_portfolio_transactions_transaction_date ON portfolio_transactions(transaction_date);
CREATE INDEX idx_portfolio_transactions_symbol ON portfolio_transactions(symbol);
