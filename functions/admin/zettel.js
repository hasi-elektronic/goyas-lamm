/**
 * Küchenzettel — eine Seite je Tag, zum Ausdrucken oder Aufhängen.
 * Bewusst eigenes, sehr schlichtes Layout statt des Admin-Rahmens:
 * schwarz auf weiß, große Zeiten, Häkchenkästchen, keine Navigation im Druck.
 */
import {
  nowBerlin, addDays, formatDateDE, isValidDate, esc, slotsForDate,
  capacityFor, WEEKDAY_DE, weekday,
} from '../_lib/core.js';
import { notesFor } from '../_lib/gaeste.js';

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f1ea;color:#14120F;
  font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.sheet{width:min(100% - 1.4rem,900px);margin:1.2rem auto 4rem;background:#fff;
  border:1px solid #d9d3c4;padding:1.6rem 1.5rem 2rem}
.bar{width:min(100% - 1.4rem,900px);margin:1rem auto 0;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.bar a,.bar button{font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;padding:.6rem 1rem;border:1px solid #d9d3c4;background:#fff;
  color:#14120F;cursor:pointer;border-radius:2px}
.bar button{background:#6D1826;border-color:#6D1826;color:#fff}
.bar .sp{flex:1}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;
  border-bottom:2px solid #14120F;padding-bottom:.7rem;margin-bottom:1.2rem}
.head h1{font-size:1.5rem;margin:0;letter-spacing:-.01em}
.head .sub{font-size:.8rem;letter-spacing:.16em;text-transform:uppercase;color:#6E675A;margin:.25rem 0 0}
.head .tot{text-align:right;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:#6E675A}
.head .tot b{display:block;font-size:1.9rem;letter-spacing:-.02em;color:#14120F;line-height:1.1}
table{width:100%;border-collapse:collapse}
th{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:#6E675A;text-align:left;
  font-weight:700;padding:0 .5rem .4rem;border-bottom:1px solid #d9d3c4}
td{padding:.62rem .5rem;border-bottom:1px solid #e8e3d6;vertical-align:top}
td.box{width:30px}
td.box i{display:block;width:17px;height:17px;border:1.5px solid #14120F;border-radius:2px}
td.t{font-weight:700;font-size:1.05rem;font-variant-numeric:tabular-nums;white-space:nowrap;width:70px}
td.g{font-weight:700;font-size:1.05rem;text-align:center;width:44px;white-space:nowrap}
td.nm b{font-size:1.02rem}
td.nm .tel{color:#6E675A;font-size:.86rem;white-space:nowrap}
td.nm .note{font-size:.88rem;margin-top:.15rem}
td.nm .gast{font-size:.86rem;margin-top:.15rem;color:#7a5a12}
td.nm .gast::before{content:"★ "}
tr.ns td{color:#9b9285}
tr.ns td.nm b{text-decoration:line-through}
.tag{display:inline-block;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;
  font-weight:700;border:1px solid #d9d3c4;padding:.1rem .35rem;color:#6E675A;margin-left:.35rem;
  vertical-align:1px}
.sum{margin-top:1.3rem;padding-top:.8rem;border-top:2px solid #14120F;display:flex;
  flex-wrap:wrap;gap:.5rem 1.4rem;font-size:.86rem}
.sum span{color:#6E675A}
.sum b{font-variant-numeric:tabular-nums}
.leer{padding:3rem 0;text-align:center;color:#6E675A}
.fuss{margin-top:1.6rem;font-size:.72rem;color:#9b9285}

@media print{
  @page{size:A4 portrait;margin:12mm}
  body{background:#fff}
  .bar{display:none}
  .sheet{width:auto;margin:0;border:0;padding:0}
  td,th{padding-left:0;padding-right:0}
  tr{break-inside:avoid}
}`;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const now = nowBerlin();
  const p = url.searchParams.get('d') || '';
  const day = isValidDate(p) ? p : now.date;
  const db = env.DB;

  const rows = db ? (await db.prepare(
    `SELECT id,res_date,res_time,guests,name,phone,note,status,source,no_show
       FROM reservations WHERE res_date=? ORDER BY res_time, created_at`
  ).bind(day).all()).results || [] : [];

  const aktiv = rows.filter(r => r.status !== 'cancelled');
  const gaeste = aktiv.reduce((s, r) => s + r.guests, 0);
  const notes = await notesFor(db, aktiv.map(r => r.phone));
  const nkey = v => String(v ?? '').replace(/\D/g, '');

  const closed = db ? await db.prepare('SELECT reason FROM closures WHERE day=?').bind(day).first() : null;
  const ruhetag = !slotsForDate(day).length;
  const kap = await capacityFor(db, env, day);

  /* Verteilung über den Abend — hilft der Küche beim Vorbereiten */
  const proZeit = {};
  for (const r of aktiv) proZeit[r.res_time] = (proZeit[r.res_time] || 0) + r.guests;
  const verteilung = Object.entries(proZeit)
    .map(([t, g]) => `<span>${esc(t)}</span> <b>${g}</b>`).join(' &nbsp;·&nbsp; ');

  const quelle = s => s === 'telefon' ? '<span class="tag">Telefon</span>'
    : s === 'walk' ? '<span class="tag">Vor Ort</span>' : '';

  const liste = aktiv.length ? `<table><thead><tr>
      <th></th><th>Zeit</th><th>P.</th><th>Name &amp; Kontakt</th>
    </tr></thead><tbody>
    ${aktiv.map(r => `<tr class="${r.no_show ? 'ns' : ''}">
      <td class="box"><i></i></td>
      <td class="t">${esc(r.res_time)}</td>
      <td class="g">${esc(String(r.guests))}</td>
      <td class="nm">
        <b>${esc(r.name)}</b>${quelle(r.source)}
        ${r.no_show ? '<span class="tag">nicht erschienen</span>' : ''}
        <div class="tel">${esc(r.phone)}</div>
        ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
        ${notes[nkey(r.phone)] ? `<div class="gast">${esc(notes[nkey(r.phone)])}</div>` : ''}
      </td></tr>`).join('')}
    </tbody></table>
    <div class="sum">
      ${verteilung || '<span>—</span>'}
    </div>`
    : `<div class="leer">${closed ? 'Schließtag: ' + esc(closed.reason || 'geschlossen')
        : ruhetag ? WEEKDAY_DE[weekday(day)] + ' ist Ruhetag.'
        : 'Für diesen Tag liegt keine Reservierung vor.'}</div>`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Küchenzettel ${esc(formatDateDE(day))}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>${CSS}</style></head><body>
<div class="bar">
  <a href="/admin/tag?d=${esc(day)}">&larr; Tagesansicht</a>
  <a href="/admin/zettel?d=${esc(addDays(day, -1))}">Vortag</a>
  <a href="/admin/zettel?d=${esc(now.date)}">Heute</a>
  <a href="/admin/zettel?d=${esc(addDays(day, 1))}">Folgetag</a>
  <span class="sp"></span>
  <button type="button" onclick="window.print()">Drucken</button>
</div>
<div class="sheet">
  <div class="head">
    <div>
      <h1>${esc(formatDateDE(day))}${day === now.date ? ' · heute' : ''}</h1>
      <p class="sub">Goya´s Lamm — Küchenzettel</p>
    </div>
    <div class="tot"><b>${gaeste}</b>
      ${gaeste === 1 ? 'Gast' : 'Gäste'} · ${aktiv.length}
      ${aktiv.length === 1 ? 'Tisch' : 'Tische'}</div>
  </div>
  ${closed && aktiv.length ? `<p class="sub" style="margin:0 0 1rem">Achtung: für diesen Tag ist
     ein Schließtag eingetragen (${esc(closed.reason || 'geschlossen')}).</p>` : ''}
  ${liste}
  <p class="fuss">Kapazität ${kap.seats} Plätze je Zeitfenster · Stand
     ${esc(new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))} ·
     Nur für den internen Gebrauch, enthält personenbezogene Daten.</p>
</div>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
