-- Mehrere Anmeldungen statt eines geteilten Passworts.
--
-- Rollen:
--   chef    — alles, wie bisher
--   service — Reservierungen ansehen und pflegen, keine Speisekarte, kein Personal
--   demo    — nur ansehen, Gastnamen abgekürzt, keine personenbezogenen Listen
--
-- Der Notzugang über ADMIN_USER / ADMIN_PASS bleibt bestehen und ist an keine
-- Datenbank gebunden — falls diese Tabelle je leer oder kaputt ist, kommt man
-- immer noch hinein.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE,      -- klein geschrieben, ohne Leerzeichen
  name       TEXT NOT NULL,             -- Anzeigename
  pass_hash  TEXT NOT NULL,             -- pbkdf2$<iter>$<salt>$<hash>
  role       TEXT NOT NULL DEFAULT 'service',
  active     INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_name ON users(username, active);
