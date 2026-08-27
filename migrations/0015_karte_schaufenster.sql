-- „Schaufenster": welche Gerichte auf der Startseite stehen.
--
-- Die Startseite zeigte bisher alle 132 Gerichte — ein Viertel des gesamten
-- HTML nur für die Karte. Seit es die digitale Karte unter /karte gibt, hat
-- die Karte ein eigenes Zuhause; auf der Startseite reicht ein Schaufenster.
--
-- Warum eine Spalte und keine Liste im Code: Was ins Schaufenster gehört,
-- ändert sich mit der Saison und mit dem, was gerade gut läuft. Eine Liste im
-- Quelltext hieße, dass Gökhan dafür jedes Mal anrufen muss. So steht neben
-- jedem Gericht unter /admin/karte ein Knopf.
--
-- Ein ausgelistetes Gericht (`active = 0`) verschwindet auch aus dem
-- Schaufenster, ohne dass die Markierung gelöscht wird — kommt es zurück,
-- steht es wieder da.

ALTER TABLE menu_items ADD COLUMN highlight INTEGER NOT NULL DEFAULT 0;

-- Startbelegung: zwölf Gerichte, für die das Haus steht — drei Steaks, drei
-- schwäbische Teigwaren, drei Klassiker, zwei Vorspeisen, ein Nachtisch.
-- Zwölf, weil das Raster vier Spalten hat und drei volle Reihen ergibt; bei
-- vierzehn stünde die letzte Reihe halb leer.
UPDATE menu_items SET highlight = 1 WHERE id IN (
  'steak-1-3',        -- Filet
  'steak-1-2',        -- Rumpsteak
  'steak-1-1',        -- Hüftesteak
  'klassiker-1-6',    -- Rostbraten
  'klassiker-1-7',    -- Wiener Schnitzel vom Kalb
  'klassiker-1-8',    -- Doradenfilet
  'teigwaren-2-2',    -- Käsespätzle
  'teigwaren-2-3',    -- Maultaschen
  'teigwaren-2-4',    -- Manti
  'vorspeisen-2-4',   -- Buratta      (echtes Foto)
  'vorspeisen-3-4',   -- Salat Omega  (echtes Foto)
  'suesses-1-3'       -- Crème brûlée (echtes Foto)
);
