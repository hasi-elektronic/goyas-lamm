/** Sitzungsprüfung für alles unter /admin (außer der Anmeldeseite). */
import { verifySession, loginPath } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname === loginPath) return next();

  if (!env.ADMIN_USER || !env.ADMIN_PASS) {
    return new Response('Der Admin-Bereich ist nicht eingerichtet (ADMIN_USER / ADMIN_PASS fehlen).',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (await verifySession(request, env)) return next();

  const to = url.pathname + url.search;
  return new Response(null, {
    status: 303,
    headers: { location: `${loginPath}?next=${encodeURIComponent(to)}`, 'cache-control': 'no-store' },
  });
}
