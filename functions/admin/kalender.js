import { nowBerlin, slotsForDate, esc, weekday } from '../_lib/core.js';
import { layout, flash } from '../_lib/ui.js';

const MONTH_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const now = nowBerlin();
  const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('m') || '')
    ? url.searchParams.get('m') : now.date.slice(0, 7);
  const [y, mo] = m.split('-').map(Number);

  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const first = `${m}-01`;
  const last  = `${m}-${String(daysInMonth).padStart(2, '0')}`;

  const db = env.DB;
  const rows = db ? (await db.prepare(
    `SELECT res_date d, COUNT(*) n, COALESCE(SUM(guests),0) g FROM reservations
      WHERE res_date>=? AND res_date<=? AND status='confirmed' GROUP BY res_date`
  ).bind(first, last).all()).results || [] : [];
  const byDay = Object.fromEntries(rows.map(r => [r.d, r]));

  const closures = db ? (await db.prepare(
    `SELECT day, reason FROM closures WHERE day>=? AND day<=?`
  ).bind(first, last).all()).results || [] : [];
  const closedMap = Object.fromEntries(closures.map(c => [c.day, c.reason || 'geschlossen']));

  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;

  // Montag als erster Wochentag
  const lead = (weekday(first) + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="d off"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${m}-${String(d).padStart(2, '0')}`;
    const info = byDay[day];
    const ruhetag = !slotsForDate(day).length;
    const zu = closedMap[day];
    const cls = ['', ruhetag || zu ? 'off' : '', day === now.date ? 'today' : ''].filter(Boolean).join(' ');
    cells.push(`<a class="${cls}" href="/admin/tag?d=${day}">
      <span class="num">${d}</span>
      ${info ? `<span class="cnt">${info.g} ${info.g === 1 ? 'Gast' : 'Gäste'}</span>
                <span class="zu">${info.n} ${info.n === 1 ? 'Tisch' : 'Tische'}</span>` : ''}
      ${ruhetag ? '<span class="zu">Ruhetag</span>' : ''}
      ${zu ? `<span class="zu">${esc(zu)}</span>` : ''}
    </a>`);
  }

  const total = rows.reduce((s, r) => s + r.g, 0);
  const resCount = rows.reduce((s, r) => s + r.n, 0);

  const body = `
    <h1>${MONTH_DE[mo - 1]} ${y}</h1>
    <p class="sub">${total} ${total === 1 ? 'Gast' : 'Gäste'} in diesem Monat ·
       ${resCount} ${resCount === 1 ? 'Reservierung' : 'Reservierungen'}</p>
    ${flash(url)}
    <div class="row" style="margin-bottom:1.2rem">
      <a class="btn ghost" href="/admin/kalender?m=${prev}">&larr; ${MONTH_DE[(mo + 10) % 12]}</a>
      <a class="btn ghost" href="/admin/kalender">Aktueller Monat</a>
      <a class="btn ghost" href="/admin/kalender?m=${next}">${MONTH_DE[mo % 12]} &rarr;</a>
    </div>
    <div class="card"><div class="body">
      <div class="cal">
        ${['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => `<div class="hd">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
    </div></div>`;

  return layout({ user: data?.user, title: `${MONTH_DE[mo - 1]} ${y}`, active: '/admin/kalender', body });
}
