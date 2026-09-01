-- Discord Trade Alerts: alert sources (community + chat room) and stored trade alerts.
-- Per-user RLS consistent with existing tables (see 008_portfolio_holdings.sql).

-- =============================================================================
-- discord_alert_sources
-- =============================================================================
CREATE TABLE discord_alert_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  community TEXT NOT NULL,
  chat_room TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Requirement 2.1: community and chat room names are 1..100 characters (trimmed).
  CONSTRAINT discord_alert_sources_community_len
    CHECK (char_length(btrim(community)) BETWEEN 1 AND 100),
  CONSTRAINT discord_alert_sources_chat_room_len
    CHECK (char_length(btrim(chat_room)) BETWEEN 1 AND 100)
);

-- Requirement 2.5: case-insensitive, trimmed duplicate prevention per user.
-- Expression-based uniqueness requires a unique index (not a UNIQUE constraint).
CREATE UNIQUE INDEX idx_discord_alert_sources_unique
  ON discord_alert_sources (user_id, lower(btrim(community)), lower(btrim(chat_room)));

ALTER TABLE discord_alert_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own discord_alert_sources"
  ON discord_alert_sources FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- discord_trade_alerts
-- =============================================================================
CREATE TABLE discord_trade_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES discord_alert_sources(id) ON DELETE CASCADE, -- Requirement 2.4, 2.7
  message_id TEXT NOT NULL,                 -- Requirement 3.2 (parser-derived FNV-1a hash)
  raw_content TEXT NOT NULL,                -- Requirement 5.7, 6.1 (always retained)
  submission_timestamp TIMESTAMPTZ NOT NULL, -- Requirement 3.2, 7.2
  action_type TEXT NOT NULL,                -- Requirement 4.1, 4.6 (Open/Adjust/Close/Unclassified)
  -- Extracted structured fields (all nullable; Requirement 5.4/5.5)
  symbol TEXT,
  strategy TEXT,
  expiration TEXT,
  strikes TEXT,
  direction TEXT,                           -- 'buy' | 'sell' (Requirement 5.2)
  fill_price NUMERIC,
  amount NUMERIC,
  amount_kind TEXT,                         -- 'credit' | 'debit' (Requirement 5.3)
  links JSONB NOT NULL DEFAULT '[]',        -- Requirement 5.8 (<= 50, deduped)
  extracted_any_field BOOLEAN NOT NULL DEFAULT false, -- Requirement 5.6
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Requirement 3.4 / 6.3: de-duplication per user + source + message id.
  UNIQUE(user_id, source_id, message_id)
);

CREATE INDEX idx_discord_trade_alerts_source ON discord_trade_alerts(source_id);

ALTER TABLE discord_trade_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own discord_trade_alerts"
  ON discord_trade_alerts FOR ALL USING (auth.uid() = user_id);
