import { esc, formatDateDE, nowBerlin, diffDays, HOUSE } from './_lib/core.js';
import { cancelMailHouse, send } from './_lib/mail.js';

const page = (title, inner, status = 200) => new Response(
`<!DOCTYPE html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Goya´s Lamm Horrheim</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<meta name="theme-color" content="#14120F">
<link rel="stylesheet" href="/assets/legal.css">
<style>
main{display:flex;align-items:center;justify-content:center;min-height:62vh}
.card{width:min(100% - 2.6rem,520px);background:#fbfaf3;border:1px solid var(--sand);padding:clamp(1.8rem,5vw,2.8rem);text-align:center}
.card h1{font-size:clamp(1.7rem,4vw,2.3rem);margin:0 0 .6rem}
.dl{margin:1.6rem 0;border-top:1px solid var(--sand);border-bottom:1px solid var(--sand);text-align:left}
.dl div{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-bottom:1px dotted var(--sand);font-size:.95rem}
.dl div:last-child{border-bottom:0}
.dl span:first-child{color:var(--muted);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;padding-top:.2rem}
.dl span:last-child{font-weight:600;text-align:right}
.btn{display:inline-block;background:var(--wine);color:#fff;text-decoration:none;border:1px solid var(--wine);
  padding:.95rem 1.9rem;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;cursor:pointer;
  font-family:inherit;transition:.25s}
.btn:hover{background:#4E101C;border-color:#4E101C}
.btn.ghost{background:none;color:var(--ink);border-color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:var(--cream)}
.row{display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap;margin-top:1.4rem}
.mark{width:56px;margin:0 auto 1.2rem;display:block}
</style></head><body>
<div class="topbar"><div class="wrap">
  <a href="/"><img src="/assets/logo-white.png" alt="Goya´s Lamm Horrheim" width="1600" height="737"></a>
  <a class="back" href="/">&larr; Zur Startseite</a>
</div></div>
<main><div class="card">
  <img class="mark" src="/assets/mark-lamb-dark.png" alt="">
  ${inner}
</div></main>
<footer><div class="wrap fbar">
  <span>© ${new Date().getFullYear()} Goya´s Lamm Horrheim</span>
  <span><a href="/">Startseite</a> · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></span>
</div></footer></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
);

const notFound = () => page('Nicht gefunden', `
  <h1>Reservierung nicht gefunden</h1>
  <p>Dieser Link ist nicht mehr gültig. Möglicherweise wurde die Reservierung bereits storniert.</p>
  <div class="row">
    <a class="btn" href="tel:${HOUSE.tel}">${esc(HOUSE.phone)} anrufen</a>
    <a class="btn ghost" href="/reservieren">Neu reservieren</a>
  </div>`, 404);

const detailRows = r => `<div class="dl">
  <div><span>Datum</span><span>${esc(formatDateDE(r.res_date))}</span></div>
  <div><span>Uhrzeit</span><span>${esc(r.res_time)} Uhr</span></div>
  <div><span>Personen</span><span>${esc(String(r.guests))}</span></div>
  <div><span>Name</span><span>${esc(r.name)}</span></div>
</div>`;

async function load(env, tk) {
  if (!tk || !/^[a-f0-9]{20,64}$/.test(tk) || !env.DB) return null;
  return env.DB.prepare(
    `SELECT id, token, res_date, res_time, guests, name, email, phone, note, status
       FROM reservations WHERE token = ?`
  ).bind(tk).first();
}

export async function onRequestGet({ request, env }) {
  const tk = new URL(request.url).searchParams.get('token');
  const r = await load(env, tk);
  if (!r) return notFound();

  if (r.status === 'cancelled') {
    return page('Bereits storniert', `
      <h1>Bereits storniert</h1>
      <p>Diese Reservierung wurde bereits aufgehoben.</p>
      ${detailRows(r)}
      <div class="row"><a class="btn" href="/reservieren">Neuen Tisch reservieren</a></div>`);
  }

  const past = diffDays(nowBerlin().date, r.res_date) < 0;
  if (past) {
    return page('Termin vorbei', `
      <h1>Dieser Termin liegt zurück</h1>
      ${detailRows(r)}
      <p>Eine Stornierung ist nicht mehr nötig. Wir hoffen, es hat geschmeckt.</p>
      <div class="row"><a class="btn" href="/reservieren">Wieder reservieren</a></div>`);
  }

  return page('Reservierung stornieren', `
    <h1>Reservierung stornieren?</h1>
    <p>Bitte bestätigen Sie, dass wir Ihren Tisch wieder freigeben sollen.</p>
    ${detailRows(r)}
    <form method="post" action="/storno">
      <input type="hidden" name="token" value="${esc(r.token)}">
      <div class="row">
        <button class="btn" type="submit">Ja, stornieren</button>
        <a class="btn ghost" href="/">Tisch behalten</a>
      </div>
    </form>`);
}

export async function onRequestPost({ request, env }) {
  let tk = '';
  try {
    const ct = request.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
    tk = String(data.token || '');
  } catch { /* leer lassen */ }

  const r = await load(env, tk);
  if (!r) return notFound();

  /* Vergangene Termine nicht mehr stornieren — der Besuch hat ja stattgefunden.
     Die GET-Ansicht sagt das schon; der POST muss es genauso halten, sonst verfälscht
     ein alter Link im Postfach nachträglich die Zahlen. */
  if (diffDays(nowBerlin().date, r.res_date) < 0) {
    return page('Termin vorbei', `
      <h1>Dieser Termin liegt zurück</h1>
      ${detailRows(r)}
      <p>Eine Stornierung ist nicht mehr nötig. Wir hoffen, es hat geschmeckt.</p>
      <div class="row"><a class="btn" href="/reservieren">Wieder reservieren</a></div>`);
  }

  if (r.status === 'confirmed') {
    await env.DB.prepare(`UPDATE reservations SET status='cancelled', cancelled_at=? WHERE id=?`)
      .bind(new Date().toISOString(), r.id).run();
    const m = cancelMailHouse(r);
    await send(env, env.RES_HOUSE_EMAIL || HOUSE.mail, m.subject, m.html, r.email, m.text);
  }

  return page('Storniert', `
    <h1>Storniert</h1>
    <p>Ihr Tisch ist wieder frei. Danke, dass Sie uns Bescheid gegeben haben.</p>
    ${detailRows(r)}
    <div class="row">
      <a class="btn" href="/reservieren">Neuen Termin wählen</a>
      <a class="btn ghost" href="/">Zur Startseite</a>
    </div>`);
}
