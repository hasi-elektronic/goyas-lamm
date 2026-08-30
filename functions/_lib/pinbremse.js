/**
 * Bremse gegen das Durchprobieren von PINs.
 *
 * Eine vierstellige PIN ist in Minuten geraten, wenn man beliebig oft darf.
 * Gezählt wird in derselben Tabelle wie beim Panel-Login (`login_attempts`),
 * nur mit einem anderen Schlüssel — deshalb liegt das hier und nicht in
 * `auth.js`.
 *
 * Der Schlüssel bestimmt, *was* gebremst wird:
 *   `pin:<mitarbeiter-id>`  — die Stempeluhr am Tablet: dort ist die Person
 *                             schon gewählt, gebremst wird pro Person.
 *   `zeit:<ip-hash>`        — die offene Seite /zeit: dort ist die PIN die
 *                             Anmeldung, gebremst wird pro Anschluss.
 *
 * Fehlversuche verjähren von selbst: Liegt der letzte länger als die Sperre
 * zurück, beginnt die Zählung wieder bei eins.
 */

export const PIN_MAX = 5;       // Fehlversuche bis zur Sperre
export const PIN_SPERRE = 10;   // Minuten Sperre

/**
 * @returns {Promise<number>} verbleibende Sperrminuten, 0 = frei.
 * Im Zweifel frei: Fällt die Datenbank aus, soll niemand ausgesperrt sein,
 * der eigentlich pünktlich zum Dienst kommt.
 */
export async function bremseFrei(db, key, max = PIN_MAX) {
  if (!db) return 0;
  try {
    const r = await db.prepare(
      `SELECT fails, last_at FROM login_attempts WHERE ip_hash=?`).bind(key).first();
    if (!r || r.fails < max) return 0;
    const min = (Date.now() - Date.parse(r.last_at)) / 60000;
    return min >= PIN_SPERRE ? 0 : Math.ceil(PIN_SPERRE - min);
  } catch { return 0; }
}

export async function bremseFehler(db, key) {
  if (!db) return;
  const jetzt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO login_attempts (ip_hash, fails, last_at) VALUES (?, 1, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         fails = CASE WHEN (julianday(?) - julianday(last_at)) * 1440 >= ${PIN_SPERRE}
                      THEN 1 ELSE fails + 1 END,
         last_at = ?`).bind(key, jetzt, jetzt, jetzt).run();
  } catch { /* nicht kritisch */ }
}

export const bremseOk = (db, key) => db
  ? db.prepare(`DELETE FROM login_attempts WHERE ip_hash=?`).bind(key).run().catch(() => {})
  : Promise.resolve();
