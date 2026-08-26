import { esc } from '../_lib/core.js';
import { CSS } from '../_lib/ui.js';
import { checkCredentials, createSession, verifySession } from '../_lib/auth.js';

const page = (next, error) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anmelden — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><meta name="theme-color" content="#14120F">
<style>${CSS}
body{background:var(--ink);display:grid;place-items:center;min-height:100svh;padding:1.4rem}
.box{width:min(100%,380px);background:var(--paper);border:1px solid var(--sand);padding:2rem 1.8rem}
.box img{width:190px;margin:0 auto 1.6rem}
.box h1{font-size:1.15rem;text-align:center;margin-bottom:.2rem}
.box p.s{text-align:center;color:var(--muted);font-size:.86rem;margin:0 0 1.5rem}
.box .f{margin-bottom:1rem}
.box .btn{width:100%;padding:.9rem}
</style></head><body>
<form class="box" method="post" action="/admin/login">
  <img src="/assets/logo-dark.png" alt="Goya´s Lamm Horrheim">
  <h1>Reservierungen</h1>
  <p class="s">Bitte anmelden.</p>
  ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
  <input type="hidden" name="next" value="${esc(next || '/admin')}">
  <div class="f"><label for="u">Benutzer</label>
    <input id="u" name="user" autocomplete="username" autocapitalize="none" required></div>
  <div class="f"><label for="p">Passwort</label>
    <input id="p" name="pass" type="password" autocomplete="current-password" required></div>
  <button class="btn" type="submit">Anmelden</button>
</form></body></html>`,
  { status: error ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
);

const safeNext = v => (typeof v === 'string' && v.startsWith('/admin') && !v.startsWith('//')) ? v : '/admin';

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

  if (!checkCredentials(env, data.user, data.pass)) {
    await new Promise(r => setTimeout(r, 600)); // Bruteforce etwas bremsen
    return page(next, 'Benutzer oder Passwort stimmt nicht.');
  }
  return new Response(null, {
    status: 303,
    headers: { location: next, 'set-cookie': await createSession(env), 'cache-control': 'no-store' },
  });
}
