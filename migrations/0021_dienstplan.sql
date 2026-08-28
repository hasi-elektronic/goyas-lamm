-- Dienstplan: wer wann arbeiten SOLL.
--
-- ── Warum eine eigene Tabelle neben `shifts` ──────────────────────────
-- `shifts` ist die Aufzeichnung nach § 17 MiLoG: was tatsächlich gestempelt
-- wurde. Das ist ein Dokument, an dem später niemand mehr drehen soll. Der
-- Plan dagegen ist eine Absicht — er wird verschoben, gestrichen und neu
-- geschrieben, oft mehrmals in derselben Woche. Beides in einer Tabelle zu
-- führen hieße, dass eine Planänderung wie eine Korrektur der Aufzeichnung
-- aussieht. Deshalb zwei Tabellen und ein Vergleich auf der Seite: geplant
-- gegen gestempelt.
--
-- ── Warum es hier keinen Abwesenheitsgrund „krank" gibt ───────────────
-- Krankmeldungen sind Gesundheitsdaten (Art. 9 DSGVO) und gehören getrennt
-- von der übrigen Personalverwaltung aufbewahrt — dieselbe Entscheidung wie
-- bei der Personalkarte. Für die Planung reicht die Information, dass jemand
-- an diesem Tag nicht da ist. Deshalb: Urlaub, Frei, Abwesend. Warum jemand
-- abwesend ist, steht im Ordner des Chefs, nicht in dieser Datenbank.

CREATE TABLE IF NOT EXISTS shift_plan (
  id         TEXT PRIMARY KEY,
  staff_id   TEXT NOT NULL,
  work_date  TEXT NOT NULL,               -- YYYY-MM-DD
  art        TEXT NOT NULL DEFAULT 'schicht',  -- schicht | urlaub | frei | abwesend
  start_at   TEXT,                        -- HH:MM, nur bei art='schicht'
  end_at     TEXT,                        -- HH:MM, nur bei art='schicht'
  rolle      TEXT,                        -- abweichender Bereich, sonst der aus `staff`
  note       TEXT,
  published  INTEGER NOT NULL DEFAULT 0,  -- 0 = Entwurf, 1 = ausgehängt
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Die Woche ist die Abfrage, die diese Seite immer stellt.
CREATE INDEX IF NOT EXISTS idx_plan_woche  ON shift_plan(work_date, staff_id);
CREATE INDEX IF NOT EXISTS idx_plan_person ON shift_plan(staff_id, work_date);
