-- Tischplan: jeder Tisch bekommt einen Platz auf einem Raster (24 × 14 Felder je Bereich)
-- und eine Größe in Feldern. NULL bei pos_x/pos_y = noch nie im Plan verschoben,
-- der Plan legt ihn dann automatisch in die nächste freie Lücke.
ALTER TABLE tables ADD COLUMN pos_x INTEGER;
ALTER TABLE tables ADD COLUMN pos_y INTEGER;
ALTER TABLE tables ADD COLUMN w INTEGER NOT NULL DEFAULT 2;
ALTER TABLE tables ADD COLUMN h INTEGER NOT NULL DEFAULT 2;
