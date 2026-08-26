-- Warteliste: wenn ein Zeitfenster voll ist, hinterlässt der Gast seine Nummer.
-- Wird ein Platz frei, sieht das Restaurant sofort, wen es anrufen kann.
-- Keine automatische Zusage — es ruft immer ein Mensch an.

CREATE TABLE IF NOT EXISTS waitlist (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  res_date   TEXT NOT NULL,          -- YYYY-MM-DD
  res_time   TEXT,                   -- HH:MM, NULL = „egal, an dem Abend"
  guests     INTEGER NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  phone_key  TEXT,
  email      TEXT,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'offen',   -- offen | erledigt | abgesagt
  closed_at  TEXT,
  ip_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_wait_day ON waitlist(res_date, status);
