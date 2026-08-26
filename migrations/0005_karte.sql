-- Speisekarte in der Datenbank: Reiter → Gruppen → Gerichte.
-- Preise sind Text, weil es „7,50 €", „6,00 – 10,00 €" und mehrzeilige
-- Gramm-Staffeln gibt. Nicht rechnen, nur anzeigen.

CREATE TABLE IF NOT EXISTS menu_tabs (
  id      TEXT PRIMARY KEY,            -- Slug, wird zur Anker-ID im HTML
  title   TEXT NOT NULL,
  sort    INTEGER NOT NULL DEFAULT 0,
  cols    INTEGER NOT NULL DEFAULT 1,  -- 2 = zweispaltiges Layout (Getränke)
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_groups (
  id      TEXT PRIMARY KEY,
  tab_id  TEXT NOT NULL,
  title   TEXT NOT NULL,
  note    TEXT,
  sort    INTEGER NOT NULL DEFAULT 0,
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id       TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name     TEXT NOT NULL,
  descr    TEXT,
  price    TEXT,
  sort     INTEGER NOT NULL DEFAULT 0,
  active   INTEGER NOT NULL DEFAULT 1   -- 0 = heute nicht verfügbar, bleibt in der Liste
);

CREATE INDEX IF NOT EXISTS idx_menu_groups ON menu_groups(tab_id, sort);
CREATE INDEX IF NOT EXISTS idx_menu_items  ON menu_items(group_id, sort);

-- Freitexte rund um die Karte (Kopfzeile, Fußnote, Stand)
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);
