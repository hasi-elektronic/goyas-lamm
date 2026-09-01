/**
 * Tischverwaltung.
 * Die Summe der Plätze aller aktiven Tische ist die Kapazität je Zeitfenster.
 * Eine Ausnahme für einen einzelnen Tag (unter „Schließtage") sticht diese Summe.
 */
import { clean, esc, jsq, seatsPerSlot, capacityFor, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { TISCHPLAN_CSS, tischplanCard } from '../_lib/tischplan.js';
import { darfSchreiben } from '../_lib/auth.js';

const AREAS = ['Gastraum', 'Nebenzimmer', 'Terrasse', 'Bar'];

const num = (v, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/* Liefert { rows, plan }. plan=false, wenn die Spalten aus 0028_tischplan.sql noch
   fehlen — dann läuft die Liste wie bisher und der Plan zeigt einen Hinweis. */
async function loadTables(db) {
  if (!db) return { rows: [], plan: false };
  try {
    const r = await db.prepare(
      `SELECT id, name, seats, area, active, sort, pos_x, pos_y, w, h FROM tables
        ORDER BY active DESC, sort, name`).all();
    return { rows: r.results || [], plan: true };
  } catch (e) {
    if (!/no such column/i.test(String(e?.message || ''))) throw e;
    const r = await db.prepare(
      `SELECT id, name, seats, area, active, sort FROM tables
        ORDER BY active DESC, sort, name`).all();
    return { rows: r.results || [], plan: false };
  }
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;

  let rows = [];
  let plan = false;
  let fehler = '';
  try { ({ rows, plan } = await loadTables(db)); }
  catch { fehler = 'Die Tabelle „tables" fehlt noch. Bitte die Migration 0003_tables.sql einspielen.'; }

  const aktiv   = rows.filter(t => t.active);
  const plaetze = aktiv.reduce((s, t) => s + t.seats, 0);
  const groesst = aktiv.reduce((m, t) => Math.max(m, t.seats), 0);
  const cap     = await capacityFor(db, env, nowBerlin().date);

  const areaOptions = (sel) => ['', ...AREAS]
    .map(a => `<option value="${esc(a)}"${(sel || '') === a ? ' selected' : ''}>${a || '—'}</option>`)
    .join('');

  const zeile = t => `<tr class="${t.active ? '' : 'cancelled'}">
    <td colspan="4" style="padding:0">
      <form method="post" action="/admin/tische" class="trow">
        <input type="hidden" name="do" value="save">
        <input type="hidden" name="id" value="${esc(t.id)}">
        <div class="f"><label for="n-${esc(t.id)}">Name</label>
          <input id="n-${esc(t.id)}" name="name" value="${esc(t.name)}" maxlength="40" required></div>
        <div class="f"><label for="s-${esc(t.id)}">Plätze</label>
          <input id="s-${esc(t.id)}" name="seats" type="number" min="1" max="60"
                 value="${esc(String(t.seats))}" required></div>
        <div class="f"><label for="a-${esc(t.id)}">Bereich</label>
          <select id="a-${esc(t.id)}" name="area">${areaOptions(t.area)}</select></div>
        <div class="f"><label for="o-${esc(t.id)}">Reihenfolge</label>
          <input id="o-${esc(t.id)}" name="sort" type="number" min="0" max="999"
                 value="${esc(String(t.sort))}"></div>
        <div class="trow-act">
          <button class="btn sm" type="submit">Speichern</button>
        </div>
      </form>
      <div class="trow-sub">
        ${t.active
          ? `<span class="pill web">zählt mit</span>`
          : `<span class="pill">stillgelegt</span>`}
        <form method="post" action="/admin/tische" style="display:inline">
          <input type="hidden" name="do" value="${t.active ? 'off' : 'on'}">
          <input type="hidden" name="id" value="${esc(t.id)}">
          <button class="btn sm danger" type="submit">${t.active ? 'Stilllegen' : 'Wieder aktivieren'}</button>
        </form>
        <form method="post" action="/admin/tische" style="display:inline"
              onsubmit="return confirm('Tisch ' + ${jsq(t.name)} + ' wirklich löschen?')">
          <input type="hidden" name="do" value="del">
          <input type="hidden" name="id" value="${esc(t.id)}">
          <button class="btn sm danger" type="submit">Löschen</button>
        </form>
      </div>
    </td></tr>`;

  const body = `
    <h1>Tische</h1>
    <p class="sub">Wie viele Tische gibt es, und wie viele Personen passen an jeden?
       Aus der Summe aller aktiven Tische ergibt sich, wie viele Gäste pro Zeitfenster
       online reservieren können.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="stats">
      <div class="stat"><b>${aktiv.length}</b><span>Tische aktiv</span></div>
      <div class="stat hot"><b>${plaetze}</b><span>Plätze gesamt</span></div>
      <div class="stat"><b>${groesst || '—'}</b><span>größter Tisch</span></div>
      <div class="stat"><b>${cap.seats}</b><span>Plätze je Zeitfenster</span></div>
    </div>

    ${plan
      ? tischplanCard(rows, AREAS, { schreiben: darfSchreiben(data?.user?.role) })
      : (rows.length ? `<div class="msg warn">Der Tischplan braucht noch die Migration
           <code>0028_tischplan.sql</code>. Bis dahin funktioniert die Liste wie bisher.</div>` : '')}

    <div class="card">
      <h2>Tisch anlegen</h2>
      <div class="body">
        <form method="post" action="/admin/tische">
          <input type="hidden" name="do" value="add">
          <div class="grid">
            <div class="f"><label for="nn">Name</label>
              <input id="nn" name="name" maxlength="40" placeholder="Tisch 1" required></div>
            <div class="f"><label for="ns">Plätze</label>
              <input id="ns" name="seats" type="number" min="1" max="60" value="4" required></div>
            <div class="f"><label for="na">Bereich</label>
              <select id="na" name="area">${areaOptions('Gastraum')}</select></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn" type="submit">Anlegen</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Tischliste <em>${rows.length} ${rows.length === 1 ? 'Tisch' : 'Tische'}</em></h2>
      ${rows.length
        ? `<table><tbody>${rows.map(zeile).join('')}</tbody></table>`
        : `<div class="empty">Noch keine Tische angelegt.<br>
             <span class="meta">Solange keine Tische gepflegt sind, rechnet das System mit
             ${seatsPerSlot(env)} Plätzen je Zeitfenster.</span></div>`}
    </div>

    <div class="card">
      <h2>Mehrere Tische auf einmal</h2>
      <div class="body">
        <form method="post" action="/admin/tische">
          <input type="hidden" name="do" value="bulk">
          <div class="grid">
            <div class="f"><label for="ba">Anzahl</label>
              <input id="ba" name="count" type="number" min="1" max="40" value="6" required></div>
            <div class="f"><label for="bs">Plätze je Tisch</label>
              <input id="bs" name="seats" type="number" min="1" max="60" value="4" required></div>
            <div class="f"><label for="bp">Namensschema</label>
              <input id="bp" name="prefix" maxlength="24" value="Tisch" required>
              <p class="hint">Ergibt „Tisch 1", „Tisch 2" … Vorhandene Namen werden übersprungen.</p></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn ghost" type="submit">Anlegen</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Wie die Platzzahl berechnet wird</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem">In dieser Reihenfolge:</p>
        <ol style="margin:0 0 .8rem;padding-left:1.2rem">
          <li>Ist unter <a href="/admin/zeiten">Schließtage</a> für einen einzelnen Tag eine
              abweichende Platzzahl hinterlegt, gilt diese.</li>
          <li>Sonst die Summe der Plätze aller aktiven Tische
              ${plaetze ? `— aktuell <strong>${plaetze}</strong>` : ''}.</li>
          <li>Sind gar keine Tische angelegt, ${seatsPerSlot(env)} Plätze als Rückfallwert.</li>
        </ol>
        <p style="margin:0">Ein stillgelegter Tisch bleibt in der Liste, zählt aber nicht mit —
           praktisch, wenn ein Tisch vorübergehend rausfällt. Gelöscht wird nur, was
           dauerhaft weg ist. Auf vergangene Reservierungen wirkt sich beides nicht aus.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Tische', active: '/admin/tische',
                  body: `<style>${TISCHPLAN_CSS}</style>${body}` });
}

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const fehler = m => redirect('/admin/tische?err=' + encodeURIComponent(m));

  if (!db) return fehler('Keine Datenbankverbindung.');

  const id   = clean(d.id, 40);
  const name = clean(d.name, 40);
  const area = AREAS.includes(clean(d.area, 24)) ? clean(d.area, 24) : null;

  try {
    if (d.do === 'add') {
      const seats = num(d.seats, 1, 60);
      if (name.length < 1) return fehler('Bitte einen Namen für den Tisch angeben.');
      if (seats === null) return fehler('Plätze bitte zwischen 1 und 60 angeben.');
      const dupe = await db.prepare(`SELECT id FROM tables WHERE name = ?`).bind(name).first();
      if (dupe) return fehler(`„${name}" gibt es schon.`);
      const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) AS m FROM tables`).first();
      await db.prepare(
        `INSERT INTO tables (id,name,seats,area,active,sort,created_at) VALUES (?,?,?,?,1,?,?)`
      ).bind(crypto.randomUUID(), name, seats, area, (Number(max?.m) || 0) + 10,
             new Date().toISOString()).run();
      return redirect('/admin/tische', `„${name}" mit ${seats} Plätzen angelegt.`);
    }

    if (d.do === 'bulk') {
      const count  = num(d.count, 1, 40);
      const seats  = num(d.seats, 1, 60);
      const prefix = clean(d.prefix, 24) || 'Tisch';
      if (count === null || seats === null) return fehler('Anzahl und Plätze bitte gültig angeben.');
      const vorhanden = new Set(((await db.prepare(`SELECT name FROM tables`).all()).results || [])
        .map(r => String(r.name)));
      const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) AS m FROM tables`).first();
      let sort = (Number(max?.m) || 0) + 10;
      const jetzt = new Date().toISOString();
      const stmts = [];
      let neu = 0;
      for (let i = 1; i <= count; i++) {
        const n = `${prefix} ${i}`;
        if (vorhanden.has(n)) continue;
        stmts.push(db.prepare(
          `INSERT INTO tables (id,name,seats,area,active,sort,created_at) VALUES (?,?,?,?,1,?,?)`
        ).bind(crypto.randomUUID(), n, seats, 'Gastraum', sort, jetzt));
        sort += 10; neu++;
      }
      if (!stmts.length) return fehler('Diese Tische gibt es alle schon.');
      await db.batch(stmts);
      return redirect('/admin/tische',
        `${neu} ${neu === 1 ? 'Tisch' : 'Tische'} à ${seats} Plätze angelegt.`);
    }

    if (!id) return fehler('Tisch nicht gefunden.');

    if (d.do === 'save') {
      const seats = num(d.seats, 1, 60);
      const sort  = num(d.sort, 0, 999);
      if (name.length < 1) return fehler('Bitte einen Namen für den Tisch angeben.');
      if (seats === null) return fehler('Plätze bitte zwischen 1 und 60 angeben.');
      const dupe = await db.prepare(`SELECT id FROM tables WHERE name = ? AND id <> ?`)
        .bind(name, id).first();
      if (dupe) return fehler(`„${name}" gibt es schon.`);
      await db.prepare(`UPDATE tables SET name=?, seats=?, area=?, sort=? WHERE id=?`)
        .bind(name, seats, area, sort ?? 0, id).run();
      return redirect('/admin/tische', `„${name}" gespeichert: ${seats} Plätze.`);
    }

    if (d.do === 'on' || d.do === 'off') {
      const an = d.do === 'on' ? 1 : 0;
      const t = await db.prepare(`SELECT name FROM tables WHERE id=?`).bind(id).first();
      await db.prepare(`UPDATE tables SET active=? WHERE id=?`).bind(an, id).run();
      return redirect('/admin/tische', an
        ? `„${t?.name || 'Tisch'}" zählt wieder mit.`
        : `„${t?.name || 'Tisch'}" ist stillgelegt und zählt nicht mehr mit.`);
    }

    if (d.do === 'del') {
      const t = await db.prepare(`SELECT name FROM tables WHERE id=?`).bind(id).first();
      await db.prepare(`DELETE FROM tables WHERE id=?`).bind(id).run();
      return redirect('/admin/tische', `„${t?.name || 'Tisch'}" gelöscht.`);
    }
  } catch (e) {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect('/admin/tische');
}
