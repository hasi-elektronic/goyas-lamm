-- Die Karte wird zweisprachig und bekommt Bilder.
--
-- Für die digitale Karte, die per QR-Code am Tisch aufgerufen wird
-- (`/karte`). Die gedruckte Fassung und der Abschnitt auf der Startseite
-- bleiben unverändert deutsch und ohne Bilder — sie lesen dieselben Spalten
-- und ignorieren die neuen einfach.
--
-- `bild` ist ein Kurzname ohne Endung und ohne Pfad, z. B. `rumpsteak`.
-- Die Dateien liegen als `/assets/karte/<bild>-{600,900,1400}.{webp,jpg}`.
-- Kein Pfad in der Datenbank: sonst müsste man bei jedem Formatwechsel alle
-- Zeilen anfassen.
--
-- Die englischen Spalten sind NULL, solange nichts übersetzt ist. Die Seite
-- fällt dann auf den deutschen Text zurück — eine halb übersetzte Karte darf
-- keine leeren Zeilen zeigen.

ALTER TABLE menu_items  ADD COLUMN bild     TEXT;
ALTER TABLE menu_items  ADD COLUMN name_en  TEXT;
ALTER TABLE menu_items  ADD COLUMN descr_en TEXT;

ALTER TABLE menu_groups ADD COLUMN title_en TEXT;
ALTER TABLE menu_groups ADD COLUMN note_en  TEXT;

ALTER TABLE menu_tabs   ADD COLUMN title_en TEXT;
