/**
 * Das Schaufenster in die Startseite einsetzen.
 *
 * Die Startseite bleibt eine statische Datei. Steht in der Datenbank eine
 * gepflegte Karte, wird der Inhalt von #karte-schaufenster im Vorbeifliegen
 * ersetzt (HTMLRewriter, kein zweiter Request, kein JavaScript beim Gast).
 *
 * Bis August 2026 stand hier die **vollständige** Karte — alle 132 Gerichte,
 * ein Viertel des gesamten HTML der Seite. Seit es die digitale Karte unter
 * `/karte` gibt, hat die Karte ein eigenes Zuhause; auf der Startseite steht
 * nur noch eine Auswahl. Welche, entscheidet die Spalte `highlight`.
 *
 * Failsafe: geht dabei irgendetwas schief oder ist nichts markiert, bleibt
 * die statische Auswahl im HTML stehen. Die Seite kann durch diesen Schritt
 * nie leer werden — das ist der Grund, warum überhaupt etwas im HTML steht.
 */
import { loadKarte, schaufensterHtml } from './_lib/karte.js';

const KARTE_TTL = 60; // Sekunden, die eine gerenderte Karte im Speicher bleibt

let cache = { at: 0, schau: null, stand: null };

async function karteHtml(env) {
  const jetzt = Date.now();
  if (cache.schau && jetzt - cache.at < KARTE_TTL * 1000) return cache;
  const karte = await loadKarte(env.DB);
  if (!karte || !karte.length) return { schau: null, stand: null };
  let stand = null;
  try {
    const r = await env.DB.prepare(`SELECT v FROM settings WHERE k='karte_stand'`).first();
    stand = r?.v || null;
  } catch { /* egal */ }
  cache = { at: jetzt, schau: schaufensterHtml(karte), stand };
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
  if (!teile.schau) return res;

  try {
    return new HTMLRewriter()
      .on('#karte-schaufenster', { element: e => e.setInnerContent(teile.schau, { html: true }) })
      .on('#karte-stand',        { element: e => { if (teile.stand) e.setInnerContent(teile.stand); } })
      .transform(res);
  } catch {
    return res;
  }
}
