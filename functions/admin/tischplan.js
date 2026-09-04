/**
 * Speichert Änderungen aus dem Tischplan (Position, Größe, Name, Plätze, Bereich).
 * Nur JSON per POST; die Anzeige selbst hängt an /admin/tische.
 * Rechte und Sitzung prüft die _middleware — hier nur noch die Werte.
 */
import { clean } from '../_lib/core.js';
import { PLAN_COLS, PLAN_ROWS, PLAN_MAX } from '../_lib/tischplan.js';

const AREAS = ['Gastraum', 'Nebenzimmer', 'Terrasse', 'Bar'];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const int = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export const onRequestGet = () => new Response(null, { status: 303, headers: { location: '/admin/tische' } });

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, error: 'Keine Datenbankverbindung.' }, 503);

  let d = null;
  try { d = await request.json(); } catch { /* unten */ }
  const items = Array.isArray(d?.tables) ? d.tables.slice(0, 200) : null;
  if (!items || !items.length) return json({ ok: false, error: 'Nichts zu speichern.' }, 400);

  let vorhanden;
  try {
    vorhanden = ((await db.prepare(`SELECT id, name FROM tables`).all()).results || []);
  } catch {
    return json({ ok: false, error: 'Die Tabelle „tables" fehlt noch.' }, 500);
  }
  const namen = new Map(vorhanden.map(r => [String(r.id), String(r.name)]));

  const stmts = [];
  for (const it of items) {
    const id = clean(it?.id, 40);
    if (!namen.has(id)) return json({ ok: false, error: 'Tisch nicht gefunden.' }, 404);

    const w = int(it.w, 1, PLAN_MAX), h = int(it.h, 1, PLAN_MAX);
    const x = it.x == null ? null : int(it.x, 0, PLAN_COLS - 1);
    const y = it.y == null ? null : int(it.y, 0, PLAN_ROWS - 1);
    if (w === null || h === null || (it.x != null && x === null) || (it.y != null && y === null)) {
      return json({ ok: false, error: 'Ungültige Position oder Größe.' }, 400);
    }
    if (x !== null && x + w > PLAN_COLS) return json({ ok: false, error: 'Der Tisch ragt über den Plan hinaus.' }, 400);
    if (y !== null && y + h > PLAN_ROWS) return json({ ok: false, error: 'Der Tisch ragt über den Plan hinaus.' }, 400);

    const rund  = it.rund ? 1 : 0;
    const name  = clean(it.name, 40);
    const seats = int(it.seats, 1, 60);
    const area  = AREAS.includes(clean(it.area, 24)) ? clean(it.area, 24) : null;
    if (name.length < 1) return json({ ok: false, error: 'Bitte einen Namen für den Tisch angeben.' }, 400);
    if (seats === null) return json({ ok: false, error: 'Plätze bitte zwischen 1 und 60 angeben.' }, 400);
    for (const [oid, oname] of namen) {
      if (oid !== id && oname === name) return json({ ok: false, error: `„${name}" gibt es schon.` }, 409);
    }
    namen.set(id, name);

    stmts.push(db.prepare(
      `UPDATE tables SET pos_x=?, pos_y=?, w=?, h=?, name=?, seats=?, area=?, rund=? WHERE id=?`
    ).bind(x, y, w, h, name, seats, area, rund, id));
  }

  try {
    await db.batch(stmts);
  } catch (e) {
    const msg = String(e?.message || '');
    if (/no such column/i.test(msg)) {
      return json({ ok: false, error: 'Eine Tischplan-Migration fehlt noch (0028/0029).' }, 500);
    }
    return json({ ok: false, error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.' }, 500);
  }
  return json({ ok: true, n: stmts.length });
}
