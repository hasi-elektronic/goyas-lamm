-- Tische des Restaurants. Die Summe der Plätze aller aktiven Tische ist die
-- Kapazität je Zeitfenster — sofern für den Tag keine Ausnahme hinterlegt ist.
CREATE TABLE IF NOT EXISTS tables (
  id         TEXT PRIMARY KEY,           -- uuid
  name       TEXT NOT NULL,              -- „Tisch 1", „Fensterplatz", „Nebenzimmer"
  seats      INTEGER NOT NULL,           -- Plätze
  area       TEXT,                       -- Gastraum / Terrasse / Nebenzimmer
  active     INTEGER NOT NULL DEFAULT 1, -- 0 = zählt nicht mit
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tables_sort ON tables(active, sort, name);
