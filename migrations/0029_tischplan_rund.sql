-- Runde Tische: rund=1 zeichnet das Kärtchen als Kreis. Runde Tische sind im
-- Raster immer quadratisch (Durchmesser = Kantenlänge), „Drehen" entfällt.
ALTER TABLE tables ADD COLUMN rund INTEGER NOT NULL DEFAULT 0;
