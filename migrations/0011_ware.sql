-- Wareneingang und Materialverfolgung.
--
-- Vier Ebenen, bewusst getrennt:
--   suppliers        wer liefert
--   articles         was geliefert wird (Stammdaten, langlebig)
--   deliveries       eine Lieferung — hier hängt die HACCP-Kontrolle dran
--   delivery_items   die Positionen dieser Lieferung, mit Preis
--   stock_counts     gezählte Bestände einer Inventur
--
-- Zwei Regeln, die im ganzen Projekt gelten und hier wieder auftauchen:
--   * Geld immer als ganzzahlige **Cent**, nie als Fließkomma.
--   * Mengen als ganzzahlige **Tausendstel** (`menge_milli`): 1,250 kg = 1250.
--     Damit summiert sich nichts schief, egal wie oft gerechnet wird.
--   * Temperatur als ganzzahlige **Zehntelgrad** (`temp_zehntel`): −18,0 °C = -180.
--
-- Gelöscht wird nichts, nur `active = 0`. Die Wareneingangskontrolle ist eine
-- Aufzeichnung — ein Löschknopf wäre bei einer Kontrolle eine Falle.

CREATE TABLE IF NOT EXISTS suppliers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kundennr   TEXT,
  kontakt    TEXT,
  telefon    TEXT,
  email      TEXT,
  note       TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  gruppe      TEXT,                      -- Warengruppe: fleisch, fisch, molkerei, ...
  einheit     TEXT NOT NULL DEFAULT 'kg',-- kg | l | stk | kiste | karton | packung | flasche
  supplier_id TEXT,                      -- Hauptlieferant, nur ein Vorschlag
  temp_klasse TEXT,                      -- NULL = ungekühlt; sonst Schlüssel aus _lib/ware.js
  lagerort    TEXT,                      -- für die Reihenfolge beim Zählen
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id           TEXT PRIMARY KEY,
  supplier_id  TEXT,
  day          TEXT NOT NULL,            -- YYYY-MM-DD, Tag der Annahme
  liefernr     TEXT,                     -- Lieferschein-/Rechnungsnummer
  beleg_key    TEXT,                     -- Schlüssel des Fotos in R2, NULL = kein Foto

  -- HACCP-Wareneingangskontrolle
  temp_zehntel INTEGER,                  -- gemessen, NULL = keine gekühlte Ware dabei
  temp_klasse  TEXT,                     -- wogegen gemessen wurde (Schlüssel aus _lib/ware.js)
  temp_ok      INTEGER,                  -- 1 innerhalb / 0 außerhalb des Grenzwerts
  mhd_ok       INTEGER NOT NULL DEFAULT 1,
  ware_ok      INTEGER NOT NULL DEFAULT 1,   -- Verpackung, Aussehen, Geruch
  massnahme    TEXT,                     -- angenommen | teilweise | zurueck
  note         TEXT,

  erfasst_von  TEXT,                     -- Anzeigename, wer angenommen hat
  created_at   TEXT NOT NULL,
  corrected    INTEGER NOT NULL DEFAULT 0,   -- 1 = nachträglich geändert
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id          TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  article_id  TEXT NOT NULL,
  menge_milli INTEGER NOT NULL,          -- 1,250 kg = 1250
  ep_cent     INTEGER,                   -- Preis je Einheit, NULL = kein Preis erfasst
  charge      TEXT,                      -- Chargennummer, für die Rückverfolgbarkeit
  mhd         TEXT,                      -- YYYY-MM-DD
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id          TEXT PRIMARY KEY,
  day         TEXT NOT NULL,             -- Stichtag der Inventur
  article_id  TEXT NOT NULL,
  menge_milli INTEGER NOT NULL,
  ep_cent     INTEGER,                   -- Bewertung; leer = letzter Einkaufspreis
  erfasst_von TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE(day, article_id)
);

-- D1 zählt **gelesene**, nicht gelieferte Zeilen. Ohne Index auf den Filterspalten
-- ist das Freikontingent bei einer Jahresauswertung schnell aufgebraucht.
CREATE INDEX IF NOT EXISTS idx_deliveries_tag    ON deliveries(day);
CREATE INDEX IF NOT EXISTS idx_deliveries_lief   ON deliveries(supplier_id, day);
CREATE INDEX IF NOT EXISTS idx_items_lieferung   ON delivery_items(delivery_id, sort);
CREATE INDEX IF NOT EXISTS idx_items_artikel     ON delivery_items(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_liste    ON articles(active, gruppe, sort);
CREATE INDEX IF NOT EXISTS idx_counts_tag        ON stock_counts(day);
