-- Gestempelte Pausen.
--
-- Bisher wurde die Pause beim Feierabend aus einer Auswahlliste geschätzt
-- („30 Minuten"). Das ist besser als nichts, aber es ist eine Erinnerung, keine
-- Aufzeichnung — und § 17 MiLoG will die tatsächliche Arbeitszeit. Wer die
-- Pause stempelt, hat Beginn und Ende schwarz auf weiß.
--
-- Warum eine eigene Tabelle und nicht zwei Spalten in `shifts`:
-- An einem Abend gibt es mehr als eine Pause. Zwei Spalten könnten genau eine
-- abbilden; die zweite würde die erste überschreiben.
--
-- `shifts.break_min` bleibt bestehen und bleibt die Summe in Minuten. Beim
-- Beenden einer Pause wird sie neu gerechnet. Damit rechnen Arbeitszeit,
-- Stundennachweis und Trinkgeldverteilung unverändert weiter — sie müssen von
-- dieser Tabelle nichts wissen.

CREATE TABLE IF NOT EXISTS shift_breaks (
  id         TEXT PRIMARY KEY,
  shift_id   TEXT NOT NULL,
  start_at   TEXT NOT NULL,            -- HH:MM, Serverzeit Europe/Berlin
  end_at     TEXT,                     -- NULL = Pause läuft gerade
  source     TEXT NOT NULL DEFAULT 'stempel',   -- stempel | admin
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_breaks_shift ON shift_breaks(shift_id);
CREATE INDEX IF NOT EXISTS idx_breaks_offen ON shift_breaks(shift_id) WHERE end_at IS NULL;
