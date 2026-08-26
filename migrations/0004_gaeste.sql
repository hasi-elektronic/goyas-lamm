-- No-Show-Kennzeichnung, Gästekartei und Telefon-Schlüssel für die Historie.

-- 0 = offen/normal, 1 = Gast ist nicht erschienen
ALTER TABLE reservations ADD COLUMN no_show INTEGER NOT NULL DEFAULT 0;

-- Telefonnummer nur als Ziffern — damit „07042 83 22 82" und „07042/832282"
-- derselbe Gast sind.
ALTER TABLE reservations ADD COLUMN phone_key TEXT;

UPDATE reservations SET phone_key =
  replace(replace(replace(replace(replace(replace(replace(
    phone,' ',''),'/',''),'-',''),'(',''),')',''),'+',''),'.','')
WHERE phone_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_res_phone ON reservations(phone_key, res_date);

-- Dauerhafte Notiz je Gast (Stammgast, Allergie, Lieblingstisch …).
-- Bewusst getrennt von der Anmerkung zur einzelnen Reservierung.
CREATE TABLE IF NOT EXISTS guests (
  phone_key  TEXT PRIMARY KEY,
  name       TEXT,
  note       TEXT,
  updated_at TEXT NOT NULL
);
