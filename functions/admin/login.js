import { esc, hashIp } from '../_lib/core.js';
import { CSS } from '../_lib/ui.js';
import { anmelden, createSession, verifySession } from '../_lib/auth.js';

const MAX_FAILS = 8;          // danach gesperrt
const LOCK_MINUTES = 15;      // Sperrdauer

const page = (next, error, locked = false) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anmelden — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><meta name="theme-color" content="#14120F">
<style>${CSS}
body{background:var(--ink);display:grid;place-items:center;min-height:100svh;padding:1.4rem}
.box{width:min(100%,400px);background:var(--paper);border:1px solid var(--sand);padding:2rem 1.8rem}
.box img{width:190px;margin:0 auto 1.6rem}
.box h1{font-size:1.15rem;text-align:center;margin-bottom:.2rem}
.box p.s{text-align:center;color:var(--muted);font-size:.86rem;margin:0 0 1.5rem}
.box .f{margin-bottom:1rem}
.box .btn{width:100%;padding:.9rem}
.box input{font-size:16px}
.f label.showpw,label.showpw{display:flex;align-items:center;gap:.6rem;margin:.6rem 0 0;
  font-size:.9rem;font-weight:400;letter-spacing:normal;text-transform:none;
  color:var(--muted);cursor:pointer;user-select:none}
.showpw input{width:18px;height:18px;margin:0;accent-color:var(--wine);flex:0 0 auto}
.hint-login{font-size:.8rem;color:var(--muted);margin:.9rem 0 0;line-height:1.5;text-align:center}
</style></head><body>
<form class="box" method="post" action="/admin/login">
  <img src="/assets/logo-dark.png" alt="Goya´s Lamm Horrheim">
  <h1>Reservierungen</h1>
  <p class="s">Bitte anmelden.</p>
  ${error ? `<div class="msg ${locked ? 'warn' : 'err'}">${esc(error)}</div>` : ''}
  <input type="hidden" name="next" value="${esc(next || '/admin')}">
  <div class="f"><label for="u">Benutzer</label>
    <input id="u" name="user" autocomplete="username" autocapitalize="none"
           autocorrect="off" spellcheck="false" required ${locked ? 'disabled' : ''}></div>
  <div class="f"><label for="p">Passwort</label>
    <input id="p" name="pass" type="password" autocomplete="current-password"
           autocapitalize="none" autocorrect="off" spellcheck="false" required ${locked ? 'disabled' : ''}>
    <label class="showpw" for="eye">
      <input type="checkbox" id="eye" ${locked ? 'disabled' : ''}><span>Passwort anzeigen</span></label>
  </div>
  <button class="btn" type="submit" ${locked ? 'disabled' : ''}>Anmelden</button>
  <p class="hint-login">Benutzername und Passwort genau wie auf dem Zettel —
     Groß- und Kleinschreibung zählt beim Passwort.</p>
</form>
<script>
(function(){
  var i=document.getElementById('p'), e=document.getElementById('eye');
  if(!i||!e) return;
  e.addEventListener('change',function(){ i.type = e.checked ? 'text' : 'password'; });
})();
</script>
</body></html>`,
  { status: error ? (locked ? 429 : 401) : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
);

const safeNext = v => (typeof v === 'string' && v.startsWith('/admin') && !v.startsWith('//')) ? v : '/admin';

/** @returns {Promise<number>} verbleibende Sperrminuten, 0 = nicht gesperrt */
async function lockedFor(env, ipHash) {
  if (!env.DB) return 0;
  try {
    const row = await env.DB.prepare(
      `SELECT fails, last_at FROM login_attempts WHERE ip_hash = ?`).bind(ipHash).first();
    if (!row || row.fails < MAX_FAILS) return 0;
    const passed = (Date.now() - Date.parse(row.last_at)) / 60000;
    return passed >= LOCK_MINUTES ? 0 : Math.ceil(LOCK_MINUTES - passed);
  } catch { return 0; }
}

async function noteFail(env, ipHash) {
  if (!env.DB) return;
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip_hash, fails, last_at) VALUES (?, 1, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         fails = CASE WHEN (julianday(?) - julianday(last_at)) * 1440 >= ${LOCK_MINUTES}
                      THEN 1 ELSE fails + 1 END,
         last_at = ?`
    ).bind(ipHash, now, now, now).run();
  } catch { /* nicht kritisch */ }
}

const clearFails = (env, ipHash) => env.DB
  ? env.DB.prepare(`DELETE FROM login_attempts WHERE ip_hash = ?`).bind(ipHash).run().catch(() => {})
  : Promise.resolve();

export async function onRequestGet({ request, env }) {
  if (await verifySession(request, env)) {
    return new Response(null, { status: 303, headers: { location: '/admin' } });
  }
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  return page(next);
}

export async function onRequestPost({ request, env }) {
  let data = {};
  try { data = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const next = safeNext(data.next);

  const ipHash = await hashIp(request.headers.get('cf-connecting-ip') || '', env.IP_SALT);
  const wait = await lockedFor(env, ipHash);
  if (wait) {
    return page(next,
      `Zu viele Fehlversuche. Bitte in ${wait} ${wait === 1 ? 'Minute' : 'Minuten'} noch einmal versuchen.`,
      true);
  }

  const wer = await anmelden(env, data.user, data.pass);
  if (!wer) {
    await noteFail(env, ipHash);
    await new Promise(r => setTimeout(r, 600));
    return page(next, 'Benutzer oder Passwort stimmt nicht.');
  }

  await clearFails(env, ipHash);
  /* Demo-Zugänge landen auf der Übersicht — die meisten Unterseiten sind für sie gesperrt. */
  const ziel = wer.role === 'demo' ? '/admin' : next;
  return new Response(null, {
    status: 303,
    headers: { location: ziel, 'set-cookie': await createSession(env, wer.uid), 'cache-control': 'no-store' },
  });
}
