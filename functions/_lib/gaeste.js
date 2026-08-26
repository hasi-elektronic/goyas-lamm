/**
 * Gästekartei: Historie zu einer Telefonnummer und eine dauerhafte Notiz je Gast.
 * Bewusst über die Telefonnummer und nicht über die E-Mail — am Telefon
 * angelegte Reservierungen haben oft keine Mailadresse.
 */
import { phoneKey } from './core.js';

/**
 * @returns {Promise<{key:string, total:number, kommt:number, noShow:number,
 *                    storno:number, letzte:Array, note:string|null}|null>}
 */
export async function history(db, phone, exceptId = null) {
  const key = phoneKey(phone);
  if (!db || key.length < 5) return null;
  try {
    const rows = (await db.prepare(
      `SELECT id, res_date, res_time, guests, status, no_show, note
         FROM reservations
        WHERE phone_key = ? ${exceptId ? 'AND id <> ?' : ''}
        ORDER BY res_date DESC, res_time DESC
        LIMIT 40`
    ).bind(...(exceptId ? [key, exceptId] : [key])).all()).results || [];

    const g = await db.prepare(`SELECT note FROM guests WHERE phone_key = ?`).bind(key).first();

    return {
      key,
      total:  rows.length,
      noShow: rows.filter(r => r.no_show).length,
      storno: rows.filter(r => r.status === 'cancelled').length,
      kommt:  rows.filter(r => r.status === 'confirmed' && !r.no_show).length,
      letzte: rows.slice(0, 6),
      note:   g?.note || null,
    };
  } catch {
    return null;   // Migration 0004 noch nicht eingespielt
  }
}

/** Nur die Notiz — für Listen, in denen die volle Historie zu teuer wäre. */
export async function notesFor(db, phones) {
  const keys = [...new Set(phones.map(phoneKey).filter(k => k.length >= 5))];
  if (!db || !keys.length) return {};
  try {
    const q = keys.map(() => '?').join(',');
    const rows = (await db.prepare(
      `SELECT phone_key, note FROM guests WHERE phone_key IN (${q}) AND note IS NOT NULL AND note <> ''`
    ).bind(...keys).all()).results || [];
    return Object.fromEntries(rows.map(r => [r.phone_key, r.note]));
  } catch {
    return {};
  }
}

export async function saveNote(db, phone, name, note) {
  const key = phoneKey(phone);
  if (!db || key.length < 5) return false;
  const now = new Date().toISOString();
  if (!note) {
    await db.prepare(`DELETE FROM guests WHERE phone_key = ?`).bind(key).run();
    return true;
  }
  await db.prepare(
    `INSERT INTO guests (phone_key, name, note, updated_at) VALUES (?,?,?,?)
     ON CONFLICT(phone_key) DO UPDATE SET name = excluded.name, note = excluded.note,
                                          updated_at = excluded.updated_at`
  ).bind(key, name || null, note, now).run();
  return true;
}
