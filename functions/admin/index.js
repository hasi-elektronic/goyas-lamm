import { nowBerlin, addDays, formatDateDE, slotsForDate, esc, seatsPerSlot } from '../_lib/core.js';
import { layout, flash, table, dayHeading } from '../_lib/ui.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  if (!db) return layout({ title: 'Übersicht', active: '/admin', body: '<div class="msg err">Datenbank nicht verbunden.</div>' });

  const now = nowBerlin();
  const until = addDays(now.date, 13);

  const rows = (await db.prepare(
    `SELECT id,res_date,res_time,guests,name,email,phone,note,status,source
       FROM reservations
      WHERE res_date >= ? AND res_date <= ? AND status='confirmed'
      ORDER BY res_date, res_time, created_at`
  ).bind(now.date, until).all()).results || [];

  const openTotal = (await db.prepare(
    `SELECT COUNT(*) n, COALESCE(SUM(guests),0) g FROM reservations
      WHERE res_date >= ? AND status='confirmed'`
  ).bind(now.date).first()) || { n: 0, g: 0 };

  const tomorrow = addDays(now.date, 1);
  const today   = rows.filter(r => r.res_date === now.date);
  const tomo    = rows.filter(r => r.res_date === tomorrow);
  const week    = rows.filter(r => r.res_date > now.date && r.res_date <= addDays(now.date, 7));
  const sum = a => a.reduce((s, r) => s + r.guests, 0);

  const byDay = {};
  for (const r of rows) if (r.res_date > now.date) (byDay[r.res_date] ||= []).push(r);

  const ruhetag = !slotsForDate(now.date).length;
  const cap = seatsPerSlot(env);

  const mailWarn = env.RESEND_API_KEY ? '' : `<div class="msg warn">
    <b>E-Mail-Versand ist noch nicht aktiv.</b> Gäste bekommen keine Bestätigung und die Küche
    keine Benachrichtigung — alle Reservierungen stehen aber hier im Panel.
    Zum Aktivieren fehlt nur der Schlüssel <code>RESEND_API_KEY</code>.</div>`;

  const upcoming = Object.keys(byDay).length
    ? Object.entries(byDay).slice(0, 8).map(([day, rs]) =>
        `<div class="card">${dayHeading(day, sum(rs), rs.length)}${table(rs)}</div>`).join('')
    : '<div class="card"><div class="empty">Für die nächsten Tage liegen noch keine Reservierungen vor.</div></div>';

  const body = `
    <h1>Übersicht</h1>
    <p class="sub">${esc(formatDateDE(now.date))} · ${esc(now.time)} Uhr${ruhetag ? ' · heute Ruhetag' : ''}
       · ${cap} Plätze je Zeitfenster</p>
    ${flash(url)}
    ${mailWarn}

    <div class="stats">
      <div class="stat hot"><b>${today.length}</b><span>Heute · Tische</span></div>
      <div class="stat hot"><b>${sum(today)}</b><span>Heute · Gäste</span></div>
      <div class="stat"><b>${sum(tomo)}</b><span>Morgen · Gäste</span></div>
      <div class="stat"><b>${sum(week)}</b><span>Nächste 7 Tage</span></div>
      <div class="stat"><b>${openTotal.n}</b><span>Offen gesamt</span></div>
    </div>

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/neu">+ Neue Reservierung</a>
      <a class="btn ghost" href="/admin/tag?d=${now.date}">Tagesansicht heute</a>
      <a class="btn ghost" href="/admin/kalender">Kalender</a>
    </div>

    <div class="card">
      ${dayHeading(now.date, sum(today), today.length)}
      ${ruhetag && !today.length
        ? '<div class="empty">Heute ist Ruhetag.</div>'
        : table(today)}
    </div>

    <h2 style="margin:2rem 0 .9rem">Nächste Tage</h2>
    ${upcoming}
  `;

  return layout({ title: 'Übersicht', active: '/admin', body });
}
