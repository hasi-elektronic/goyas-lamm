-- Kennzeichnung und Details je Gericht — für die Detailtafel in der digitalen Karte.
--
-- ── Das Freigabe-Kennzeichen ist der wichtigste Teil ──────────────────
-- Solange `kennz_ok` auf 0 steht, sieht der Gast von Allergenen und
-- Zusatzstoffen **nichts**. Grund: **Allergene sind kein „ungefähr".** Wer
-- Erdnuss oder Gluten nicht verträgt, verlässt sich darauf. Eine geratene
-- Angabe ist schlimmer als gar keine, weil sie Sicherheit vortäuscht. Die
-- Daten kommen aus der Küche und aus den Produktspezifikationen der
-- Lieferanten — nicht aus einer Ableitung.
--
-- Deshalb wird hier nichts vorbelegt. Die Spalten sind leer, und leer heißt
-- auf der Karte weiterhin: „Sprechen Sie uns an."
--
-- **Nährwerte gibt es bewusst nicht.** Für Gastronomie sind sie nicht
-- vorgeschrieben, ohne Rezeptur mit Gramm-Mengen nicht seriös zu rechnen —
-- und auf der Karte eines Steakhauses wirken Makrowerte eher nach
-- Fitness-App als nach gutem Essen. Wenn sie je kommen, dann erst mit dem
-- Rezepturmodul und mit einem eigenen Freigabe-Kennzeichen.
--
-- ── Rechtlicher Hintergrund ───────────────────────────────────────────
-- Allergene (14, VO (EU) 1169/2011 i. V. m. LMIDV): dürfen bei loser Ware
-- auch **mündlich** gegeben werden — dann muss eine schriftliche oder
-- elektronische Dokumentation auf Nachfrage leicht zugänglich sein und ein
-- deutlicher Hinweis im Betrieb hängen. Genau diese elektronische Fassung
-- kann die QR-Karte sein.
-- Zusatzstoffe (14 Funktionsklassen, ZZulV): müssen **schriftlich** kenntlich
-- gemacht werden — Speisekarte, Aushang oder ein leicht zugängliches Blatt.
-- ⚠️ Beides vor dem Scharfschalten mit der Lebensmittelüberwachung abgleichen.

-- Kennzeichnung. Schlüssel als Kommaliste, Bedeutung in _lib/kennzeichnung.js.
ALTER TABLE menu_items ADD COLUMN allergene  TEXT;   -- "a,c,g"
ALTER TABLE menu_items ADD COLUMN zusatz     TEXT;   -- "1,8"
ALTER TABLE menu_items ADD COLUMN marken     TEXT;   -- "vegetarisch,scharf"
ALTER TABLE menu_items ADD COLUMN kennz_ok   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN kennz_am   TEXT;
ALTER TABLE menu_items ADD COLUMN kennz_von  TEXT;

-- Erzählung. Das, was ein Steakhaus wirklich auszeichnet — und was ohnehin
-- jemand im Haus weiß, ohne es erst ausrechnen zu müssen.
ALTER TABLE menu_items ADD COLUMN herkunft      TEXT;
ALTER TABLE menu_items ADD COLUMN herkunft_en   TEXT;
ALTER TABLE menu_items ADD COLUMN reifung       TEXT;
ALTER TABLE menu_items ADD COLUMN reifung_en    TEXT;
ALTER TABLE menu_items ADD COLUMN garstufe      TEXT;
ALTER TABLE menu_items ADD COLUMN garstufe_en   TEXT;
ALTER TABLE menu_items ADD COLUMN wein          TEXT;   -- Weinname, nicht übersetzt
ALTER TABLE menu_items ADD COLUMN geschichte    TEXT;
ALTER TABLE menu_items ADD COLUMN geschichte_en TEXT;
