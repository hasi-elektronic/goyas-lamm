-- Abwesenheiten: Urlaub, Krankheit und alles andere, was jemanden vom Dienst fernhält.
--
-- ── Warum eine Tabelle für alles ──────────────────────────────────────
-- Urlaub und Krankheit sind organisatorisch dasselbe: eine Person, ein
-- Zeitraum, ein Grund. Getrennte Tabellen hätten dieselben Spalten und
-- dieselben Abfragen — und beim Dienstplan müsste man beide zusammensuchen.
--
-- ── Was hier NICHT steht ──────────────────────────────────────────────
-- **Keine Diagnose. Kein Krankheitsgrund. Kein Attest als Datei.**
-- Gesundheitsdaten sind nach Art. 9 DSGVO besonders geschützt. Was der
-- Betrieb wissen muss und darf, ist: von wann bis wann, und ob die
-- Arbeitsunfähigkeitsbescheinigung vorliegt (§ 5 EntgFG). Warum jemand krank
-- ist, geht den Arbeitgeber nichts an — und deshalb gibt es hier kein Feld
-- dafür. Wer eins vermisst, hat die Frage falsch gestellt.
--
-- ── Status ────────────────────────────────────────────────────────────
-- beantragt  — Mitarbeiter hat über /zeit Urlaub beantragt, Chef hat noch
--              nicht entschieden. Zählt als „geplant", nicht als „genommen".
-- genehmigt  — gilt. Erscheint im Dienstplan, zählt aufs Urlaubskonto.
-- abgelehnt  — bleibt stehen, damit man später sieht, dass gefragt wurde.
-- storniert  — zurückgezogen oder hinfällig.
--
-- Krankmeldungen legt ausschließlich der Chef an; sie sind sofort
-- „genehmigt", weil es nichts zu genehmigen gibt.

CREATE TABLE IF NOT EXISTS absences (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT NOT NULL,
  art         TEXT NOT NULL,             -- urlaub | krank | unbezahlt | eltern | schulung | sonder
  von         TEXT NOT NULL,             -- YYYY-MM-DD, erster Tag
  bis         TEXT NOT NULL,             -- YYYY-MM-DD, letzter Tag (einschließlich)
  tage        INTEGER,                   -- angerechnete Werktage; NULL = nicht aufs Konto
  status      TEXT NOT NULL DEFAULT 'genehmigt',
  notiz       TEXT,                      -- Anlass in einem Wort, NIE eine Diagnose
  au_bis      TEXT,                      -- Krankheit: bis wann die AU-Bescheinigung reicht
  au_da       INTEGER NOT NULL DEFAULT 0,-- 1 = Bescheinigung liegt vor
  quelle      TEXT NOT NULL DEFAULT 'chef',  -- chef | antrag
  entschieden_von TEXT,                  -- Anzeigename, wer genehmigt/abgelehnt hat
  entschieden_am  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_abw_person ON absences(staff_id, von);
CREATE INDEX IF NOT EXISTS idx_abw_zeitraum ON absences(von, bis);
CREATE INDEX IF NOT EXISTS idx_abw_offen ON absences(status) WHERE status = 'beantragt';

-- Urlaubskonto und Fristen an der Person.
-- urlaub_tage: gesetzlicher Mindesturlaub ist § 3 BUrlG — 24 Werktage bei
-- Sechstagewoche, also 20 bei Fünftagewoche. Der Wert wird NICHT geraten,
-- sondern eingetragen; die Seite schlägt ihn nur vor.
ALTER TABLE staff ADD COLUMN urlaub_tage      INTEGER;  -- Jahresanspruch in Werktagen
ALTER TABLE staff ADD COLUMN urlaub_rest_vj   INTEGER;  -- Übertrag aus dem Vorjahr
ALTER TABLE staff ADD COLUMN vertrag_am       TEXT;     -- Arbeitsvertrag unterschrieben am
ALTER TABLE staff ADD COLUMN titel_bis        TEXT;     -- Aufenthaltstitel/Arbeitserlaubnis gültig bis
