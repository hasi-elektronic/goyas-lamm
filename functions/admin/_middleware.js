/**
 * Sitzungsprüfung und Rechte für alles unter /admin (außer der Anmeldeseite).
 *
 * Hier — und nur hier — wird entschieden, wer welche Seite sehen und wer
 * überhaupt etwas speichern darf. So kann eine einzelne Seite das nicht vergessen.
 */
import { currentUser, loginPath, darfSeite, darfSchreiben } from '../_lib/auth.js';

const sperre = (titel, text) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titel} — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#F4F7EA;
color:#14120F;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
padding:1.6rem}
.k{max-width:470px;background:#FBFAF3;border:1px solid #E4DED0;padding:2rem 1.8rem;text-align:center}
h1{font-size:1.2rem;margin:0 0 .6rem}p{color:#6E675A;margin:0 0 1.4rem}
a{display:inline-block;background:#6D1826;color:#fff;text-decoration:none;padding:.8rem 1.6rem;
font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;border-radius:2px}
</style></head><body><div class="k">
<h1>${titel}</h1><p>${text}</p><a href="/admin">Zur Übersicht</a></div></body></html>`,
  { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const url = new URL(request.url);
  if (url.pathname === loginPath) return next();

  if (!env.ADMIN_USER || !env.ADMIN_PASS) {
    return new Response('Der Admin-Bereich ist nicht eingerichtet (ADMIN_USER / ADMIN_PASS fehlen).',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const user = await currentUser(request, env);
  if (!user) {
    const to = url.pathname + url.search;
    return new Response(null, {
      status: 303,
      headers: { location: `${loginPath}?next=${encodeURIComponent(to)}`, 'cache-control': 'no-store' },
    });
  }

  if (!darfSeite(user.role, url.pathname)) {
    return sperre('Dafür fehlt die Berechtigung',
      'Dieser Bereich ist für deinen Zugang gesperrt. Wenn du ihn brauchst, sag kurz Bescheid.');
  }

  if (request.method !== 'GET' && request.method !== 'HEAD' && !darfSchreiben(user.role)) {
    return sperre('Nur zum Anschauen',
      'Dieser Zugang kann nichts ändern — so bleiben die echten Daten des Restaurants unberührt.');
  }

  data.user = user;          // steht den Seiten als context.data.user zur Verfügung
  return next();
}
