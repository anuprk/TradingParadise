-- Daily notes table
CREATE TABLE daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, note_date)
);

CREATE INDEX idx_daily_notes_user_date ON daily_notes(user_id, note_date DESC);

-- RLS
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notes" ON daily_notes FOR ALL USING (auth.uid() = user_id);
