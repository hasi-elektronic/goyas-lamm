-- Privatkasse — Gökhans eigenes Haushaltsbuch.
--
-- ── Was das ist ───────────────────────────────────────────────────────
-- Ein Notizblock für Geld, das PRIVAT fließt: Miete, Versicherungen, Auto,
-- Einkauf, und auf der anderen Seite das, was privat hereinkommt. Gökhan hat
-- ausdrücklich danach gefragt, weil er den Überblick über seine eigenen
-- Ausgaben behalten will. Alles wird von Hand eingetragen — es hängt an keiner
-- Bank, an keiner Kasse und an keinem Beleg.
--
-- ── Was das ausdrücklich NICHT ist ────────────────────────────────────
-- **Nichts hiervon geht an den Steuerberater.** Es ist keine Buchhaltung, kein
-- Kassenbuch und keine Grundlage für irgendeine Erklärung. Diese Tabellen
-- tauchen in keiner Betriebsauswertung auf und werden nirgends mit
-- Betriebszahlen verrechnet — genau das ist der Sinn der Trennung.
--
-- Zwei Dinge, die daraus folgen und auf der Seite auch so stehen:
--   1. Eine **Privatentnahme** aus dem Betrieb ist buchhalterisch relevant und
--      muss dem Steuerberater weiterhin gemeldet werden. Sie hier einzutragen
--      ersetzt das nicht — hier steht sie nur, damit die private Seite stimmt.
--   2. Eine Ausgabe, die in Wahrheit **betrieblich** ist, gehört nicht hierher,
--      sondern auf den Beleg für den Steuerberater. Wer sie hier einträgt,
--      verliert sie für die Buchhaltung.
--
-- ── Warum Cent und kein Vorzeichen ────────────────────────────────────
-- Beträge stehen als positive Ganzzahl in Cent; die Richtung steht in einer
-- eigenen Spalte. Ein Minuszeichen im Betrag wäre eine zweite Wahrheit neben
-- der Richtung, und irgendwann widersprechen sich die beiden.

CREATE TABLE IF NOT EXISTS private_entries (
  id         TEXT PRIMARY KEY,
  tag        TEXT NOT NULL,                    -- YYYY-MM-DD, der Tag des Geldflusses
  richtung   TEXT NOT NULL DEFAULT 'aus',      -- 'aus' | 'ein'
  kategorie  TEXT NOT NULL,
  text       TEXT,                             -- freie Bezeichnung
  cent       INTEGER NOT NULL,                 -- immer positiv
  zahlart    TEXT,                             -- bar | konto | karte | NULL
  fix_id     TEXT,                             -- aus welcher Vorlage erzeugt (sonst NULL)
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_priv_tag ON private_entries(tag);
-- Verhindert, dass dieselbe Vorlage zweimal in denselben Monat gebucht wird.
-- `substr(tag,1,7)` ist der Monat — SQLite darf auf Ausdrücke indizieren.
CREATE UNIQUE INDEX IF NOT EXISTS idx_priv_fix_monat
  ON private_entries(fix_id, substr(tag, 1, 7)) WHERE fix_id IS NOT NULL;

-- Wiederkehrende Posten: einmal definieren, jeden Monat mit einem Griff buchen.
-- Bewusst KEIN Automatismus im Hintergrund — ein Eintrag, den niemand ausgelöst
-- hat, ist ein Eintrag, dem niemand traut. Der Knopf steht auf der Seite.
CREATE TABLE IF NOT EXISTS private_fix (
  id         TEXT PRIMARY KEY,
  richtung   TEXT NOT NULL DEFAULT 'aus',
  kategorie  TEXT NOT NULL,
  text       TEXT NOT NULL,
  cent       INTEGER NOT NULL,
  aktiv      INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_privfix ON private_fix(aktiv, sort);
