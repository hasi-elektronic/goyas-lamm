import { esc, formatDateDE, nowBerlin, addDays, WEEKDAY_DE, weekday, seatsPerSlot, HOUSE } from './_lib/core.js';

/** Basic-Auth. Zugangsdaten kommen aus den Umgebungsvariablen ADMIN_USER / ADMIN_PASS. */
function unauthorized() {
  return new Response('Zugang nur für das Restaurant.', {
    status: 401,
    headers: {
      'www-authenticate': 'Basic realm="Goya´s Lamm — Reservierungen", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

function checkAuth(request, env) {
  const user = env.ADMIN_USER, pass = env.ADMIN_PASS;
  if (!user || !pass) return false;
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = atob(h.slice(6)); } catch { return false; }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const u = decoded.slice(0, i), p = decoded.slice(i + 1);
  // konstante Laufzeit ist hier nicht kritisch, aber schadet nicht
  let ok = u.length === user.length && p.length === pass.length;
  for (let k = 0; k < Math.max(u.length, user.length); k++) if (u[k] !== user[k]) ok = false;
  for (let k = 0; k < Math.max(p.length, pass.length); k++) if (p[k] !== pass[k]) ok = false;
  return ok;
}

const CSS = `
:root{--wine:#6D1826;--ink:#14120F;--cream:#F4F7EA;--paper:#FBFAF3;--sand:#E8E2D2;--gold:#C0A062;--muted:#6E675A}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
.bar{background:var(--ink);color:var(--cream);padding:1rem 1.4rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.bar b{font-size:.74rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
.bar a{color:rgba(244,247,234,.75);text-decoration:none;font-size:.78rem}
.wrap{width:min(100% - 2rem,1080px);margin:2rem auto 4rem}
h1{font-size:1.5rem;margin:0 0 .3rem}
.sub{color:var(--muted);font-size:.9rem;margin:0 0 1.6rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem;margin-bottom:2rem}
.stat{background:#fff;border:1px solid var(--sand);padding:1rem 1.2rem}
.stat b{display:block;font-size:1.7rem;line-height:1.1}
.stat span{font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.day{margin:0 0 1.6rem;background:#fff;border:1px solid var(--sand)}
.day h2{margin:0;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;background:var(--cream);
  padding:.75rem 1.1rem;border-bottom:1px solid var(--sand);display:flex;justify-content:space-between;gap:1rem}
.day h2 em{font-style:normal;color:var(--muted);font-weight:400}
table{width:100%;border-collapse:collapse}
td,th{padding:.68rem 1.1rem;text-align:left;border-bottom:1px solid var(--sand);vertical-align:top}
th{font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600}
tr:last-child td{border-bottom:0}
.t{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.g{font-weight:700;color:var(--wine);white-space:nowrap}
.n{color:var(--muted);font-size:.86rem}
a.lnk{color:var(--wine);text-decoration:none}
a.lnk:hover{text-decoration:underline}
.cancel{background:none;border:1px solid var(--sand);color:var(--muted);padding:.35rem .7rem;font-size:.68rem;
  letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:inherit}
.cancel:hover{border-color:var(--wine);color:var(--wine)}
.empty{padding:2.5rem 1.1rem;text-align:center;color:var(--muted)}
.can{opacity:.45}
.can .t,.can .g{text-decoration:line-through}
.nav{display:flex;gap:.5rem;margin-bottom:1.4rem;flex-wrap:wrap}
.nav a{border:1px solid var(--sand);padding:.45rem .9rem;text-decoration:none;color:var(--muted);
  font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}
.nav a.on{background:var(--wine);border-color:var(--wine);color:#fff}
@media(max-width:640px){td,th{padding:.6rem .7rem;font-size:.88rem}.hide{display:none}}
`;

function shell(inner, range) {
  return new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reservierungen — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><style>${CSS}</style></head><body>
<div class="bar"><b>Goya´s Lamm · Reservierungen</b><a href="/">→ Website</a></div>
<div class="wrap">
  <div class="nav">
    <a class="${range === '7' ? 'on' : ''}" href="/admin?tage=7">7 Tage</a>
    <a class="${range === '30' ? 'on' : ''}" href="/admin?tage=30">30 Tage</a>
    <a class="${range === '90' ? 'on' : ''}" href="/admin?tage=90">90 Tage</a>
    <a class="${range === 'alle' ? 'on' : ''}" href="/admin?tage=alle">inkl. stornierte</a>
  </div>
  ${inner}
</div>
<script>
document.addEventListener('click',function(e){
  var b=e.target.closest('.cancel'); if(!b) return;
  if(!confirm('Reservierung wirklich stornieren?')) return;
  b.disabled=true;
  fetch('/admin',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:b.dataset.id})}).then(function(r){
      if(r.ok) location.reload(); else { b.disabled=false; alert('Fehlgeschlagen.'); }
    });
});
</script></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  if (!env.DB) return shell('<p>Datenbank nicht verbunden.</p>', '7');

  const url = new URL(request.url);
  const range = url.searchParams.get('tage') || '7';
  const withCancelled = range === 'alle';
  const days = withCancelled ? 90 : Math.min(365, parseInt(range, 10) || 7);

  const now = nowBerlin();
  const until = addDays(now.date, days);

  const rows = await env.DB.prepare(
    `SELECT id, res_date, res_time, guests, name, email, phone, note, status, created_at, mail_guest
       FROM reservations
      WHERE res_date >= ? AND res_date <= ? ${withCancelled ? '' : "AND status = 'confirmed'"}
      ORDER BY res_date ASC, res_time ASC, created_at ASC`
  ).bind(now.date, until).all();

  const list = rows.results || [];
  const active = list.filter(r => r.status === 'confirmed');
  const todayRows = active.filter(r => r.res_date === now.date);
  const guestsToday = todayRows.reduce((s, r) => s + r.guests, 0);
  const guestsTotal = active.reduce((s, r) => s + r.guests, 0);

  const byDay = {};
  for (const r of list) (byDay[r.res_date] ||= []).push(r);

  const cap = seatsPerSlot(env);

  const stats = `<div class="stats">
    <div class="stat"><b>${todayRows.length}</b><span>Heute · Tische</span></div>
    <div class="stat"><b>${guestsToday}</b><span>Heute · Gäste</span></div>
    <div class="stat"><b>${active.length}</b><span>Zeitraum · Tische</span></div>
    <div class="stat"><b>${guestsTotal}</b><span>Zeitraum · Gäste</span></div>
  </div>`;

  const body = Object.keys(byDay).length === 0
    ? '<div class="day"><div class="empty">Für diesen Zeitraum liegen keine Reservierungen vor.</div></div>'
    : Object.entries(byDay).map(([day, rs]) => {
        const sum = rs.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.guests, 0);
        return `<div class="day">
          <h2><span>${esc(formatDateDE(day))}${day === now.date ? ' · heute' : ''}</span>
              <em>${sum} ${sum === 1 ? 'Gast' : 'Gäste'} · ${rs.filter(r => r.status === 'confirmed').length} Reservierungen</em></h2>
          <table><thead><tr>
            <th>Zeit</th><th>P.</th><th>Name</th><th class="hide">Kontakt</th><th class="hide">Anmerkung</th><th></th>
          </tr></thead><tbody>
          ${rs.map(r => `<tr class="${r.status === 'cancelled' ? 'can' : ''}">
            <td class="t">${esc(r.res_time)}</td>
            <td class="g">${esc(String(r.guests))}</td>
            <td>${esc(r.name)}${r.status === 'cancelled' ? ' <span class="n">(storniert)</span>' : ''}</td>
            <td class="hide"><a class="lnk" href="tel:${esc(r.phone)}">${esc(r.phone)}</a><br>
                <a class="lnk n" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
            <td class="hide n">${esc(r.note || '—')}</td>
            <td>${r.status === 'confirmed'
                  ? `<button class="cancel" data-id="${esc(r.id)}">Stornieren</button>` : ''}</td>
          </tr>`).join('')}
          </tbody></table></div>`;
      }).join('');

  const hint = `<p class="sub">Plätze je Zeitfenster: <b>${cap}</b> · Telefon ${esc(HOUSE.phone)} ·
     Wochentag heute: ${WEEKDAY_DE[weekday(now.date)]}</p>`;

  return shell(`<h1>Reservierungen</h1>${hint}${stats}${body}`, range);
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return unauthorized();
  let id = '';
  try { id = String((await request.json()).id || ''); } catch { /* ignorieren */ }
  if (!id || !env.DB) return new Response('bad request', { status: 400 });
  await env.DB.prepare(`UPDATE reservations SET status='cancelled', cancelled_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run();
  return new Response('ok');
}
