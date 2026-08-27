-- Personalkarte: die Felder, die eine Mitarbeiterseite erst zu einer Karte machen.
--
-- Bisher stand in `staff` nur Name, Bereich, PIN, aktiv und Stundenlohn. Das ist
-- eine Stempeluhr-Liste, keine Personalkarte. Was hier dazukommt, ist bewusst
-- knapp gehalten: In der Gastronomie haben genau zwei Felder echten Alltagswert,
-- die anderswo fehlen — der **Notfallkontakt** (wer wird angerufen, wenn in der
-- Küche etwas passiert) und das **Datum der Belehrung nach § 43 IfSG**, weil die
-- Wiederholung alle zwei Jahre fällig ist und sonst niemand daran denkt.
--
-- ── Was hier bewusst NICHT steht ──────────────────────────────────────
-- Keine IBAN, keine Steuer-Identifikationsnummer, keine
-- Sozialversicherungsnummer. Die Lohnabrechnung macht der Steuerberater; diese
-- Daten würden hier nur liegen und beschützt werden müssen. Jedes Feld, das man
-- nicht speichert, muss man nicht sichern.
--
-- Erst recht keine Gesundheitsdaten: keine Krankmeldungen, keine AU-Bescheinigungen,
-- keine Diagnosen. Die Aufsichtsbehörden verlangen, dass solche Angaben getrennt
-- von der übrigen Personalakte aufbewahrt werden (Art. 9 DSGVO, § 26 BDSG). Das
-- Panel kann diese Trennung nicht leisten — also gehören sie nicht hinein.
--
-- ── Und weiterhin kein Löschen ────────────────────────────────────────
-- Ein Mitarbeiter wird auf „ausgeschieden" gesetzt, nie gelöscht: Die Schichten
-- müssen nach § 17 MiLoG zwei Jahre aufbewahrt werden, und im Gaststättengewerbe
-- gilt das für alle Beschäftigten, nicht nur für Minijobber.

ALTER TABLE staff ADD COLUMN phone        TEXT;   -- Handynummer
ALTER TABLE staff ADD COLUMN birthday     TEXT;   -- YYYY-MM-DD
ALTER TABLE staff ADD COLUMN start_date   TEXT;   -- Eintritt, YYYY-MM-DD
ALTER TABLE staff ADD COLUMN art          TEXT;   -- Vollzeit | Teilzeit | Minijob | Aushilfe | Azubi
ALTER TABLE staff ADD COLUMN nk_name      TEXT;   -- Notfallkontakt: Name und Verhältnis
ALTER TABLE staff ADD COLUMN nk_phone     TEXT;   -- Notfallkontakt: Nummer
ALTER TABLE staff ADD COLUMN belehrung_am TEXT;   -- letzte Belehrung § 43 IfSG, YYYY-MM-DD
ALTER TABLE staff ADD COLUMN notiz        TEXT;   -- interne Notiz, nur für den Chef
