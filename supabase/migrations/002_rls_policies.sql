-- Migration: Enable Row Level Security and create access policies
-- Applies to: plans, portfolios, journal_entries, reminders, portfolio_transactions
-- Each table gets four policies: SELECT, INSERT, UPDATE, DELETE
-- All restrict access to rows where user_id matches the authenticated user (auth.uid())

-- =============================================================================
-- plans
-- =============================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- portfolios
-- =============================================================================
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own portfolios"
  ON portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios"
  ON portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- journal_entries
-- =============================================================================
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own journal_entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal_entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal_entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal_entries"
  ON journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- reminders
-- =============================================================================
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- portfolio_transactions
-- =============================================================================
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own portfolio_transactions"
  ON portfolio_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio_transactions"
  ON portfolio_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio_transactions"
  ON portfolio_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio_transactions"
  ON portfolio_transactions FOR DELETE
  USING (auth.uid() = user_id);
