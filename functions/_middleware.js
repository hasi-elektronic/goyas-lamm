/**
 * Speisekarte in die Startseite einsetzen.
 *
 * Die Startseite bleibt eine statische Datei — sie enthält weiterhin die
 * vollständige Karte als HTML. Steht in der Datenbank eine gepflegte Karte,
 * wird der Inhalt von #karte-nav und #karte-panels im Vorbeifliegen ersetzt
 * (HTMLRewriter, kein zweiter Request, kein JavaScript beim Gast).
 *
 * Failsafe: geht dabei irgendetwas schief oder ist die Karte leer, bleibt
 * die statische Fassung stehen. Die Seite kann durch diesen Schritt nie leer
 * werden — das ist der Grund, warum die Karte auch im HTML bleibt.
 */
import { loadKarte, navHtml, panelsHtml } from './_lib/karte.js';

const KARTE_TTL = 60; // Sekunden, die eine gerenderte Karte im Speicher bleibt

let cache = { at: 0, nav: null, panels: null, stand: null };

async function karteHtml(env) {
  const jetzt = Date.now();
  if (cache.nav && jetzt - cache.at < KARTE_TTL * 1000) return cache;
  const karte = await loadKarte(env.DB);
  if (!karte || !karte.length) return { nav: null, panels: null, stand: null };
  let stand = null;
  try {
    const r = await env.DB.prepare(`SELECT v FROM settings WHERE k='karte_stand'`).first();
    stand = r?.v || null;
  } catch { /* egal */ }
  cache = { at: jetzt, nav: navHtml(karte), panels: panelsHtml(karte), stand };
  return cache;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const istStart = url.pathname === '/' || url.pathname === '/index.html';
  if (!istStart || request.method !== 'GET') return next();

  const res = await next();
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;

  let teile;
  try { teile = await karteHtml(env); } catch { return res; }
  if (!teile.nav || !teile.panels) return res;

  try {
    return new HTMLRewriter()
      .on('#karte-nav',    { element: e => e.setInnerContent(teile.nav,    { html: true }) })
      .on('#karte-panels', { element: e => e.setInnerContent(teile.panels, { html: true }) })
      .on('#karte-stand',  { element: e => { if (teile.stand) e.setInnerContent(teile.stand); } })
      .transform(res);
  } catch {
    return res;
  }
}
