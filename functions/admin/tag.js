import {
  nowBerlin, addDays, formatDateDE, slotsForDate, isValidDate, esc, capacityFor, weekday, WEEKDAY_DE,
} from '../_lib/core.js';
import { layout, flash, table } from '../_lib/ui.js';
import { notesFor } from '../_lib/gaeste.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const now = nowBerlin();
  const day = isValidDate(url.searchParams.get('d') || '') ? url.searchParams.get('d') : now.date;
  const db = env.DB;

  const rows = db ? (await db.prepare(
    `SELECT id,res_date,res_time,guests,name,email,phone,note,status,source,no_show
       FROM reservations WHERE res_date=? ORDER BY res_time, created_at`
  ).bind(day).all()).results || [] : [];

  const active = rows.filter(r => r.status === 'confirmed');
  const sum = active.reduce((s, r) => s + r.guests, 0);

  const closed = db ? await db.prepare('SELECT reason FROM closures WHERE day=?').bind(day).first() : null;
  const kap = await capacityFor(db, env, day);
  const cap = kap.seats;
  const notes = await notesFor(db, rows.map(r => r.phone));

  const load = {};
  for (const r of active) load[r.res_time] = (load[r.res_time] || 0) + r.guests;

  const slots = slotsForDate(day);
  const slotHtml = slots.length
    ? `<div class="slots">${slots.map(t => {
        const used = load[t] || 0;
        const pct = Math.min(100, Math.round(used / cap * 100));
        return `<a class="slot ${used >= cap ? 'full' : ''}" href="/admin/neu?d=${day}&t=${encodeURIComponent(t)}">
          <b>${t}</b><span>${used} / ${cap} Plätze</span>
          <span class="bar"><i style="width:${pct}%"></i></span></a>`;
      }).join('')}</div>`
    : `<div class="empty">${WEEKDAY_DE[weekday(day)]} ist Ruhetag.</div>`;

  const body = `
    <h1>${esc(formatDateDE(day))}${day === now.date ? ' · heute' : ''}</h1>
    <p class="sub">${sum} ${sum === 1 ? 'Gast' : 'Gäste'} · ${active.length}
       ${active.length === 1 ? 'Reservierung' : 'Reservierungen'} · ${cap} Plätze je Zeitfenster
       ${kap.source === 'tag' ? '(für diesen Tag angepasst)'
         : kap.source === 'tische' ? `(aus ${kap.tables.count} Tischen)` : ''}</p>
    ${flash(url)}
    ${closed ? `<div class="msg warn"><b>Schließtag:</b> ${esc(closed.reason || 'geschlossen')} —
        online kann für diesen Tag nicht reserviert werden.</div>` : ''}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="/admin/tag?d=${addDays(day, -1)}">&larr; Vortag</a>
      <a class="btn ghost" href="/admin/tag?d=${now.date}">Heute</a>
      <a class="btn ghost" href="/admin/tag?d=${addDays(day, 1)}">Folgetag &rarr;</a>
      <span class="spacer"></span>
      <a class="btn ghost" href="/admin/zettel?d=${day}">Küchenzettel</a>
      <a class="btn" href="/admin/neu?d=${day}">+ Reservierung</a>
    </div>

    <div class="card">
      <h2>Auslastung <em>Klick auf ein Zeitfenster legt dort eine Reservierung an</em></h2>
      <div class="body">${slotHtml}</div>
    </div>

    <div class="card">
      <h2>Reservierungen</h2>
      ${table(rows, { notes })}
    </div>`;

  return layout({ title: formatDateDE(day), active: '/admin/kalender', body });
}
