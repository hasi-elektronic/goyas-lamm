-- Lohn, Trinkgeld und die Chef-PIN.
--
-- Beträge stehen überall als ganze **Cent** in INTEGER-Spalten. Kommazahlen sind
-- für Geld die falsche Bauform: 0.1 + 0.2 ergibt in jeder Sprache mit Fließkomma
-- nicht 0.3, und bei Monatssummen läuft das sichtbar auseinander.

-- Stundenlohn je Mitarbeiter, NULL = nicht hinterlegt (dann wird nichts gerechnet).
ALTER TABLE staff ADD COLUMN wage_cent INTEGER;

-- Trinkgeld-Topf eines Abends. Ein Eintrag je Tag; verteilt wird nach den
-- gearbeiteten Minuten dieses Tages, gerechnet erst bei der Anzeige.
CREATE TABLE IF NOT EXISTS tips (
  day         TEXT PRIMARY KEY,          -- YYYY-MM-DD
  amount_cent INTEGER NOT NULL,
  note        TEXT,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tips_day ON tips(day);
