-- Goya´s Lamm — Reservierungssystem
-- D1 (Cloudflare), Region WEUR

CREATE TABLE IF NOT EXISTS reservations (
  id            TEXT PRIMARY KEY,           -- uuid
  token         TEXT NOT NULL UNIQUE,       -- Stornolink
  created_at    TEXT NOT NULL,              -- ISO
  res_date      TEXT NOT NULL,              -- YYYY-MM-DD (lokal, Europe/Berlin)
  res_time      TEXT NOT NULL,              -- HH:MM
  guests        INTEGER NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | cancelled
  cancelled_at  TEXT,
  source        TEXT NOT NULL DEFAULT 'web',
  ip_hash       TEXT,
  mail_guest    INTEGER NOT NULL DEFAULT 0,
  mail_house    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_res_slot   ON reservations(res_date, res_time, status);
CREATE INDEX IF NOT EXISTS idx_res_date   ON reservations(res_date, status);
CREATE INDEX IF NOT EXISTS idx_res_create ON reservations(created_at);

-- Schließtage / Urlaub / ausgebuchte Tage
CREATE TABLE IF NOT EXISTS closures (
  day     TEXT PRIMARY KEY,   -- YYYY-MM-DD
  reason  TEXT
);

-- Kapazität je Wochentag überschreibbar (0=So .. 6=Sa); NULL = Default
CREATE TABLE IF NOT EXISTS capacity_overrides (
  day        TEXT PRIMARY KEY,  -- YYYY-MM-DD
  seats_slot INTEGER
);
