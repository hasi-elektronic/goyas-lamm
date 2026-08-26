-- Fehlgeschlagene Anmeldeversuche am Admin-Bereich (Bruteforce-Bremse)
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash  TEXT PRIMARY KEY,
  fails    INTEGER NOT NULL DEFAULT 0,
  last_at  TEXT NOT NULL
);
