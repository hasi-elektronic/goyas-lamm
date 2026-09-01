/**
 * Sicherung und Export der Datenbank.
 *
 * Anlass (Hamdi, 01.09.2026): „admin einstellung tarafina bir tane backup ve
 * bir tane export butonlari ekle gökhan lokal kopie almak isteyebilir. bir de
 * otomatik local backup alma özelligi ekle."
 *
 * Zwei Dateien für zwei verschiedene Zwecke — das ist der ganze Unterschied:
 *
 *   **Sicherung (.json)**  Alles, vollständig, mit dem Schema. Sie ist zum
 *                          Wiederherstellen da, nicht zum Lesen.
 *   **Export (.xlsx)**     Ein Blatt je Tabelle, Kopfzeile fett, Autofilter.
 *                          Sie ist zum Lesen da, nicht zum Wiederherstellen.
 *
 * Wer beides in eine Datei presst, bekommt eine, die keins von beidem gut
 * kann: JSON, das niemand ohne Werkzeug ansieht, oder Excel, aus dem sich
 * keine Datenbank zurückbauen lässt (Datentypen, NULL gegen Leerstring,
 * führende Nullen in Telefonnummern).
 *
 * ⚠️ **In beiden Dateien stehen personenbezogene Daten** — Gästenamen,
 * Telefonnummern, E-Mail-Adressen, Personalstammdaten, Abwesenheiten. Sobald
 * die Datei auf einem Rechner liegt, ist sie Gökhans Verantwortung (Art. 32
 * DSGVO). Deshalb steht der Hinweis auch auf der Seite und nicht nur hier.
 */

/**
 * Tabellen, die nicht mitgesichert werden.
 *
 * `login_attempts` ist ein Sicherheitsprotokoll mit IP-Adressen. Es hat für
 * eine Wiederherstellung keinen Wert — nach einem Datenverlust interessiert
 * niemanden, wer sich vor drei Wochen vertippt hat — und eine Liste von
 * IP-Adressen auf einem Laptop im Büro ist genau die Art Nebenwirkung, die
 * man bei einer Sicherung nicht will.
 */
const NICHT_SICHERN = new Set(['login_attempts']);

/** Sicherheitsnetz, damit eine einzelne Tabelle die Antwort nicht sprengt. */
const MAX_ZEILEN = 100000;

/** Ab so vielen Tagen ohne Sicherung mahnt die Übersicht. */
export const WARNUNG_AB_TAGEN = 7;

/** Alle echten Tabellen der Datenbank, alphabetisch. */
export async function tabellenListe(db) {
  const r = await db.prepare(
    `SELECT name, sql FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_cf_%'
      ORDER BY name`).all();
  return (r.results || []).filter(t => !NICHT_SICHERN.has(t.name));
}

/**
 * Liest alle Tabellen aus.
 *
 * Nacheinander, nicht als Batch: bei knapp dreißig kleinen Tabellen ist der
 * Unterschied nicht messbar, und wenn eine davon klemmt, steht ihr Name im
 * Fehler statt „batch failed".
 */
export async function allesLesen(db) {
  const tabellen = await tabellenListe(db);
  const daten = {};
  const schema = {};
  let zeilen = 0;

  for (const t of tabellen) {
    schema[t.name] = t.sql;
    const r = await db.prepare(`SELECT * FROM "${t.name}" LIMIT ${MAX_ZEILEN}`).all();
    daten[t.name] = r.results || [];
    zeilen += daten[t.name].length;
  }
  return { tabellen: tabellen.map(t => t.name), schema, daten, zeilen };
}

/**
 * Nur die Zeilenzahlen — für die Anzeige auf der Seite.
 *
 * Getrennt von `allesLesen()`, weil die Seite sonst bei jedem Aufruf die
 * komplette Datenbank in den Speicher zieht, nur um „282 Zeilen" zu schreiben.
 * Sichern tut man einmal am Tag, die Seite ansehen öfter.
 */
export async function zaehlen(db) {
  const tabellen = await tabellenListe(db);
  const zahlen = {};
  for (const t of tabellen) {
    try {
      const r = await db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).first();
      zahlen[t.name] = r?.n ?? 0;
    } catch { zahlen[t.name] = 0; }
  }
  return { tabellen: tabellen.map(t => t.name), zahlen };
}

/** Dateiname mit Datum — sortiert sich im Ordner von selbst richtig. */
export const dateiName = (art, tag) => `goyas-lamm-${art}-${tag}.${art === 'sicherung' ? 'json' : 'xlsx'}`;

/* Das Muster, nach dem der Browser im gewählten Ordner aufräumt. Bewusst eng:
   gelöscht wird nur, was diese Seite selbst geschrieben haben kann. */
export const DATEI_MUSTER = '^goyas-lamm-sicherung-\\d{4}-\\d{2}-\\d{2}\\.json$';

/** Wann zuletzt gesichert wurde — `{ zeit, art }` oder null. */
export async function letzterStand(db) {
  if (!db) return null;
  try {
    const r = await db.prepare(`SELECT v FROM settings WHERE k = 'backup_last'`).first();
    if (!r?.v) return null;
    const [zeit, art] = String(r.v).split('|');
    return { zeit, art: art || 'manuell' };
  } catch { return null; }
}

/**
 * Hält fest, dass eine Sicherung erstellt wurde.
 *
 * Ja, das schreibt bei einem GET. Der Sinn dieses Feldes ist „wann hat
 * zuletzt jemand eine Sicherung gezogen" — und genau das passiert in diesem
 * Moment. Es woanders zu notieren hieße, den einen Zeitpunkt zu verpassen,
 * an dem man es sicher weiß.
 */
export async function standNotieren(db, art) {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO settings (k, v) VALUES ('backup_last', ?)
         ON CONFLICT(k) DO UPDATE SET v = excluded.v`
    ).bind(`${new Date().toISOString()}|${art}`).run();
  } catch { /* eine verpasste Notiz ist kein Grund, die Sicherung zu verwerfen */ }
}

/** Volle Tage seit einem ISO-Zeitpunkt. */
export function tageSeit(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** „vor 3 Tagen" / „heute" — für die Anzeige. */
export function standText(stand) {
  if (!stand) return 'noch nie';
  const t = tageSeit(stand.zeit);
  if (t === null) return 'unbekannt';
  if (t <= 0) return 'heute';
  if (t === 1) return 'gestern';
  return `vor ${t} Tagen`;
}
