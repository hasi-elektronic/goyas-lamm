-- Rechnungen für Feiern und Firmenessen.
--
-- ── Wofür das gedacht ist ─────────────────────────────────────────────
-- Für das, was NICHT über die Kasse läuft: Geburtstagsfeier, Firmenessen,
-- Trauerkaffee — Anlässe, die auf Rechnung gehen und per Überweisung bezahlt
-- werden. Der Gast am Tisch bekommt weiterhin den Kassenbon.
--
-- ── Wofür es ausdrücklich NICHT gedacht ist ───────────────────────────
-- Als **Bewirtungsbeleg** zum Absetzen taugt eine hier geschriebene Rechnung
-- nicht: Seit 2020 muss ein Bewirtungsbeleg aus einem elektronischen
-- Aufzeichnungssystem mit zertifizierter Sicherheitseinrichtung stammen
-- (§ 4 Abs. 5 Nr. 2 EStG, BMF-Schreiben vom 30.06.2021). Das ist die Kasse,
-- nicht dieses Panel. Der Hinweis steht auf der Seite. Nicht wegkürzen.
--
-- ── Nummern ───────────────────────────────────────────────────────────
-- Die Rechnungsnummer muss einmalig und fortlaufend sein (§ 14 Abs. 4 Nr. 4
-- UStG). Deshalb wird sie NICHT beim Anlegen vergeben, sondern erst beim
-- Ausstellen — ein verworfener Entwurf reißt sonst eine Lücke, die man später
-- dem Prüfer erklären darf. Der Zähler steht in `settings` unter
-- `rechnung_nr_<jahr>`.
--
-- ── Was nach dem Ausstellen passiert ──────────────────────────────────
-- Nichts mehr. Eine gestellte Rechnung ist unveränderlich; korrigiert wird sie
-- durch eine Stornorechnung mit eigener Nummer, die auf das Original verweist.
-- Alles andere wäre nach GoBD eine nachträgliche Änderung ohne Spur.

CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  nummer        TEXT,                    -- z. B. „2026-0007"; NULL solange Entwurf
  jahr          INTEGER,
  status        TEXT NOT NULL DEFAULT 'entwurf',  -- entwurf | gestellt | bezahlt | storniert

  -- Leistungsempfänger (§ 14 Abs. 4 Nr. 1 UStG)
  empfaenger    TEXT NOT NULL,
  adresse       TEXT,                    -- mehrzeilig
  email         TEXT,

  anlass        TEXT,                    -- „Geburtstagsfeier, 24 Personen"
  leistung_von  TEXT NOT NULL,           -- Zeitpunkt der Leistung (§ 14 Abs. 4 Nr. 6)
  leistung_bis  TEXT,                    -- bei mehrtägigen Veranstaltungen
  datum         TEXT,                    -- Ausstellungsdatum, gesetzt beim Ausstellen
  faellig_am    TEXT,
  hinweis       TEXT,                    -- freier Text unter den Positionen

  bezahlt_am    TEXT,
  storno_von    TEXT,                    -- id der Rechnung, die hiermit storniert wird
  erstellt_von  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rg_nummer ON invoices(nummer) WHERE nummer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rg_status ON invoices(status, leistung_von);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL,
  text        TEXT NOT NULL,
  menge_milli INTEGER NOT NULL DEFAULT 1000,   -- 1,5 Portionen = 1500
  einheit     TEXT,                            -- „Personen", „Pauschale", leer
  ep_cent     INTEGER NOT NULL DEFAULT 0,      -- Einzelpreis NETTO
  steuer      INTEGER NOT NULL DEFAULT 7,      -- Prozentsatz: 7 | 19 | 0
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rgpos ON invoice_items(invoice_id, sort);
