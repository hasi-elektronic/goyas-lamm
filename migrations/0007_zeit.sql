-- Arbeitszeiterfassung.
-- Hintergrund: § 17 MiLoG verpflichtet Gaststättenbetriebe, Beginn, Ende und Dauer
-- der täglichen Arbeitszeit innerhalb von sieben Tagen aufzuzeichnen und die
-- Aufzeichnungen zwei Jahre bereitzuhalten. Genau das bildet diese Tabelle ab.

CREATE TABLE IF NOT EXISTS staff (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,                        -- Küche / Service / Bar / Aushilfe
  pin_hash   TEXT,                        -- SHA-256 aus PIN + IP_SALT, nie im Klartext
  active     INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id         TEXT PRIMARY KEY,
  staff_id   TEXT NOT NULL,
  work_date  TEXT NOT NULL,               -- YYYY-MM-DD, Tag des Arbeitsbeginns (Berlin)
  start_at   TEXT NOT NULL,               -- HH:MM
  end_at     TEXT,                        -- HH:MM, NULL = Schicht läuft noch
  break_min  INTEGER NOT NULL DEFAULT 0,
  note       TEXT,
  source     TEXT NOT NULL DEFAULT 'stempel',   -- stempel | admin
  corrected  INTEGER NOT NULL DEFAULT 0,   -- 1 = nachträglich vom Chef geändert
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shifts_month ON shifts(work_date, staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_open  ON shifts(staff_id, end_at);
