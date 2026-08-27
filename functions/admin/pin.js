/**
 * Die Chef-PIN eingeben.
 *
 * Eigene, schlichte Seite ohne Navigation — wer hier steht, soll die PIN eingeben
 * und nicht nebenbei weiterklicken. Nach fünf Fehlversuchen zehn Minuten Ruhe:
 * eine vierstellige PIN ist sonst in ein paar Minuten durchprobiert.
 *
 * Der Zähler liegt in `login_attempts` unter dem Schlüssel `chefpin` — dieselbe
 * Tabelle, die schon den Anmeldeversuch und die Stempeluhr zählt.
 */
import { esc } from '../_lib/core.js';
import {
  gespeicherterPin, pinHashChef, freigabeCookie, brauchtPin, DAUER_MIN,
} from '../_lib/chefpin.js';

const MAX = 5;          // Fehlversuche
const SPERRE = 10;      // Minuten
const KEY = 'chefpin';

async function gesperrtFuer(db) {
  if (!db) return 0;
  try {
    const r = await db.prepare(
      `SELECT fails, last_at FROM login_attempts WHERE ip_hash = ?`).bind(KEY).first();
    if (!r || r.fails < MAX) return 0;
    const min = (Date.now() - Date.parse(r.last_at)) / 60000;
    return min >= SPERRE ? 0 : Math.ceil(SPERRE - min);
  } catch { return 0; }
}

async function fehlversuch(db) {
  if (!db) return;
  const jetzt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO login_attempts (ip_hash, fails, last_at) VALUES (?, 1, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         fails = CASE WHEN (julianday(?) - julianday(last_at)) * 1440 >= ${SPERRE}
                      THEN 1 ELSE fails + 1 END,
         last_at = ?`).bind(KEY, jetzt, jetzt, jetzt).run();
  } catch { /* nicht kritisch */ }
}

const zaehlerWeg = db => db
  ? db.prepare(`DELETE FROM login_attempts WHERE ip_hash = ?`).bind(KEY).run().catch(() => {})
  : Promise.resolve();

/** Ziel muss innerhalb des Panels liegen — kein offener Weiterleiter. */
const sicheresZiel = v =>
  (typeof v === 'string' && v.startsWith('/admin') && !v.startsWith('//')) ? v : '/admin/personal';

const seite = (ziel, fehler, minuten, extraHeaders = {}) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Chef-PIN — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><meta name="theme-color" content="#14120F">
<style>
:root{--wine:#6D1826;--ink:#14120F;--cream:#F4F7EA;--paper:#FBFAF3;--sand:#E4DED0;
  --gold:#C0A062;--muted:#6E675A;--warn:#9A6212}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:var(--cream);
  color:var(--ink);padding:1.4rem;
  font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.k{width:min(100%,420px);background:var(--paper);border:1px solid var(--sand);
  border-radius:3px;padding:2rem 1.7rem 1.7rem;text-align:center}
.schloss{width:34px;height:34px;margin:0 auto .9rem;stroke:var(--gold);fill:none;
  stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
h1{font-size:1.16rem;margin:0 0 .4rem}
p.sub{color:var(--muted);font-size:.92rem;margin:0 0 1.5rem}
input{width:100%;font:700 1.9rem/1 inherit;letter-spacing:.5em;text-align:center;
  padding:.85rem .5rem;border:1px solid var(--sand);border-radius:2px;background:#fff;
  color:var(--ink);text-indent:.5em}
input:focus{outline:2px solid var(--gold);outline-offset:1px}
button{width:100%;margin-top:.9rem;background:var(--wine);color:#fff;border:0;border-radius:2px;
  padding:.95rem;font:inherit;font-weight:700;font-size:.78rem;letter-spacing:.15em;
  text-transform:uppercase;cursor:pointer}
button:hover{background:#4E101C}
.msg{background:#F6E9E9;border-left:3px solid var(--wine);color:var(--wine);text-align:left;
  padding:.75rem .9rem;border-radius:0 2px 2px 0;font-size:.9rem;margin:0 0 1.1rem}
.msg.warn{background:#FBF3E3;border-left-color:var(--warn);color:var(--warn)}
.zu{display:block;margin-top:1.2rem;color:var(--muted);font-size:.8rem}
.hint{color:var(--muted);font-size:.78rem;margin:1.1rem 0 0;line-height:1.5}
</style></head><body>
<div class="k">
  <svg class="schloss" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="10.5" width="16" height="10.5" rx="1.5"/>
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
  <h1>Chef-PIN</h1>
  <p class="sub">Auf dieser Seite stehen Löhne und Personaldaten.</p>
  ${minuten ? `<p class="msg warn">Zu viele Fehlversuche. Bitte in
      ${minuten} ${minuten === 1 ? 'Minute' : 'Minuten'} noch einmal.</p>` : ''}
  ${fehler && !minuten ? `<p class="msg">${esc(fehler)}</p>` : ''}
  <form method="post" action="/admin/pin" autocomplete="off">
    <input type="hidden" name="next" value="${esc(ziel)}">
    <input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" required
           autocomplete="off" autofocus aria-label="Chef-PIN"
           ${minuten ? 'disabled' : ''}>
    <button type="submit" ${minuten ? 'disabled' : ''}>Freischalten</button>
  </form>
  <p class="hint">Bleibt ${DAUER_MIN} Minuten offen, danach fragt das Panel wieder.</p>
  <a class="zu" href="/admin">Zurück zur Übersicht</a>
</div></body></html>`,
  { status: minuten ? 429 : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
               ...extraHeaders } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!await gespeicherterPin(env.DB)) {
    // Keine PIN hinterlegt — dann gibt es hier nichts zu entsperren.
    return new Response(null, { status: 303, headers: { location: '/admin/personal' } });
  }
  return seite(sicheresZiel(url.searchParams.get('next')), '', await gesperrtFuer(env.DB));
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const ziel = sicheresZiel(d.next);

  const rest = await gesperrtFuer(db);
  if (rest) return seite(ziel, '', rest);

  const soll = await gespeicherterPin(db);
  if (!soll) return new Response(null, { status: 303, headers: { location: ziel } });

  const pin = String(d.pin || '').replace(/\D/g, '').slice(0, 8);
  const ist = await pinHashChef(pin, env);

  if (ist !== soll) {
    await fehlversuch(db);
    await new Promise(r => setTimeout(r, 700));   // Bremse gegen Durchprobieren
    const nochmal = await gesperrtFuer(db);
    return seite(ziel, 'PIN stimmt nicht.', nochmal);
  }

  await zaehlerWeg(db);
  return new Response(null, {
    status: 303,
    headers: {
      location: brauchtPin(ziel) ? ziel : '/admin/personal',
      'set-cookie': await freigabeCookie(env),
      'cache-control': 'no-store',
    },
  });
}
