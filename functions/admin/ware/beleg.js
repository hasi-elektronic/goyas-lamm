/**
 * Belegfoto ausliefern.
 *
 * Liegt bewusst unter `/admin`, damit die Sitzungsprüfung aus dem Middleware
 * greift. Auf einem Lieferschein stehen Kundennummer, Konditionen und manchmal
 * Personennamen — das gehört nicht in einen öffentlich erratbaren Pfad.
 */
const SCHLUESSEL = /^\d{4}-\d{2}\/[a-z0-9]+\.(jpg|png|webp)$/;

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!SCHLUESSEL.test(key)) return new Response('Nicht gefunden', { status: 404 });
  if (!env.BELEGE) return new Response('Kein Belegspeicher eingerichtet', { status: 503 });

  const o = await env.BELEGE.get(key);
  if (!o) return new Response('Nicht gefunden', { status: 404 });

  return new Response(o.body, {
    headers: {
      'content-type': o.httpMetadata?.contentType || 'image/jpeg',
      /* privat: das Bild darf in keinem gemeinsamen Zwischenspeicher landen */
      'cache-control': 'private, max-age=3600',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
}
