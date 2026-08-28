-- Betriebliche Eigenkontrolle: die täglichen Kontrollen.
--
-- ── Warum das die andere Hälfte ist ───────────────────────────────────
-- Der Wareneingang deckt ab, was ins Haus kommt. Die Eigenkontrolle nach
-- Art. 5 VO (EG) 852/2004 verlangt aber ein Verfahren für den ganzen Betrieb —
-- und wonach der Kontrolleur als Erstes fragt, sind die **täglichen
-- Temperaturaufzeichnungen** der Kühlgeräte und der Reinigungsplan. Genau die
-- fehlten bisher.
--
-- ── Woher die Grenzwerte kommen ───────────────────────────────────────
-- Für Kühlung, Tiefkühlung und Heißhaltung gibt es keine einzelne Zahl im
-- Gesetz. Praxisstandard ist die **DIN 10508** (Temperaturen für Lebensmittel):
-- leicht verderbliche Ware bei +7 °C oder kälter, Tiefkühlware bei −18 °C oder
-- kälter, Heißhalten bei +65 °C oder wärmer. Produktbezogen strengere Werte
-- stehen in der VO (EG) 853/2004 — die kennt schon `_lib/ware.js`.
--
-- Eine DIN ist keine Rechtsnorm, sondern eine anerkannte Regel der Technik.
-- Deshalb sind die Werte hier **je Prüfpunkt änderbar** und nicht im Code
-- festgenagelt: Was im Haus gilt, steht im Hygienekonzept des Betriebs und
-- gehört einmal mit der Lebensmittelüberwachung des Landkreises abgeglichen.
--
-- ── Warum Punkte und Einträge getrennt sind ───────────────────────────
-- Ein Kühlschrank wird angeschafft, umbenannt und irgendwann ausgemustert.
-- Die Messwerte von zwei Jahren bleiben trotzdem im Blatt stehen — deshalb
-- wird ein Prüfpunkt nicht gelöscht, sondern auf `active = 0` gesetzt.

CREATE TABLE IF NOT EXISTS hygiene_punkte (
  id           TEXT PRIMARY KEY,
  art          TEXT NOT NULL,              -- kuehl | tk | heiss | fett | reinigung
  name         TEXT NOT NULL,
  min_zehntel  INTEGER,                    -- kälteste zulässige Temperatur (Heißhaltung)
  max_zehntel  INTEGER,                    -- wärmste zulässige Temperatur (Kühlung, TK)
  takt         TEXT NOT NULL DEFAULT 'taeglich',   -- taeglich | woechentlich
  sort         INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hygiene_log (
  id           TEXT PRIMARY KEY,
  punkt_id     TEXT NOT NULL,
  tag          TEXT NOT NULL,              -- YYYY-MM-DD
  temp_zehntel INTEGER,                    -- nur bei Temperaturpunkten
  ok           INTEGER NOT NULL DEFAULT 1, -- 0 = Abweichung
  massnahme    TEXT,                       -- bei Abweichung Pflicht
  wer          TEXT,
  erfasst_at   TEXT NOT NULL
);

-- Die Abfragen dieser Seite: „ein Tag" und „ein Monat je Punkt".
CREATE INDEX IF NOT EXISTS idx_hyg_tag   ON hygiene_log(tag, punkt_id);
CREATE INDEX IF NOT EXISTS idx_hyg_punkt ON hygiene_log(punkt_id, tag);

-- Startaufstellung. Bewusst kurz: Jede Quelle zum Thema sagt dasselbe wie beim
-- Wareneingang — wer mit dreißig Prüfpunkten anfängt, hört nach einem Monat
-- auf. Umbenennen und ergänzen kann der Chef selbst.
INSERT OR IGNORE INTO hygiene_punkte (id,art,name,min_zehntel,max_zehntel,takt,sort,active,created_at) VALUES
  ('hp-kuehl-kueche','kuehl','Kühlschrank Küche',        NULL,   70, 'taeglich',     10, 1, '2026-08-28'),
  ('hp-kuehl-haus',  'kuehl','Kühlhaus',                 NULL,   70, 'taeglich',     20, 1, '2026-08-28'),
  ('hp-kuehl-bar',   'kuehl','Kühlschrank Bar',          NULL,   70, 'taeglich',     30, 1, '2026-08-28'),
  ('hp-tk',          'tk',   'Tiefkühler',               NULL, -180, 'taeglich',     40, 1, '2026-08-28'),
  ('hp-heiss',       'heiss','Heißhaltung / Warmhalten',  650, NULL, 'taeglich',     50, 1, '2026-08-28'),
  ('hp-fett',        'fett', 'Frittierfett geprüft',     NULL, NULL, 'taeglich',     60, 1, '2026-08-28'),
  ('hp-rein-kueche', 'reinigung','Küche und Arbeitsflächen', NULL, NULL, 'taeglich',  70, 1, '2026-08-28'),
  ('hp-rein-wc',     'reinigung','Gasttoiletten',        NULL, NULL, 'taeglich',     80, 1, '2026-08-28'),
  ('hp-rein-kuehl',  'reinigung','Kühlgeräte innen',     NULL, NULL, 'woechentlich', 90, 1, '2026-08-28'),
  ('hp-rein-filter', 'reinigung','Fettfilter Dunstabzug', NULL, NULL, 'woechentlich',100, 1, '2026-08-28');
