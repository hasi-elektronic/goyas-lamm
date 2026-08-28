/**
 * Den Stand der Karte in die Startseite einsetzen.
 *
 * Die Startseite bleibt eine statische Datei. Ein einziges Feld wird im
 * Vorbeifliegen ersetzt (HTMLRewriter, kein zweiter Request, kein JavaScript
 * beim Gast): das Datum in `#karte-stand` — „Stand der Karte: August 2026".
 *
 * ── Wie diese Datei geschrumpft ist ───────────────────────────────────
 * Bis August 2026 stand hier die **vollständige** Karte, alle 132 Gerichte,
 * ein Viertel des HTML der Startseite. Dann wurde daraus ein Schaufenster mit
 * zwölf Gerichten. Und seit die Startseite drei Spezialitäten mit Bild und
 * Geschichte zeigt statt eines Kartenauszugs, bleibt nur das Datum übrig: Ein
 * Auszug der Karte las sich neben dem Abschnitt „Vom Teller" wie zwei
 * Speisekarten auf einer Seite. Die Karte selbst steht unter `/karte`.
 *
 * Failsafe unverändert: Geht hier etwas schief oder antwortet die Datenbank
 * nicht, wird die Seite unverändert ausgeliefert. Im HTML steht ein
 * plausibles Datum — die Seite kann durch diesen Schritt nie leer werden.
 */
import { loadKarte } from './_lib/karte.js';

const KARTE_TTL = 60; // Sekunden, die der Stand im Speicher bleibt

let cache = { at: 0, stand: null };

async function standHolen(env) {
  const jetzt = Date.now();
  if (cache.stand && jetzt - cache.at < KARTE_TTL * 1000) return cache.stand;

  /* Der Stand gilt nur, wenn auch wirklich eine Karte in der Datenbank steht.
     Ein Datum über einer leeren Karte wäre eine Auskunft über nichts. */
  const karte = await loadKarte(env.DB);
  if (!karte || !karte.length) return null;

  let stand = null;
  try {
    const r = await env.DB.prepare(`SELECT v FROM settings WHERE k='karte_stand'`).first();
    stand = r?.v || null;
  } catch { /* egal */ }
  if (stand) cache = { at: jetzt, stand };
  return stand;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const istStart = url.pathname === '/' || url.pathname === '/index.html';
  if (!istStart || request.method !== 'GET') return next();

  const res = await next();
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return res;

  let stand;
  try { stand = await standHolen(env); } catch { return res; }
  if (!stand) return res;

  try {
    return new HTMLRewriter()
      .on('#karte-stand', { element: e => e.setInnerContent(stand) })
      .transform(res);
  } catch {
    return res;
  }
}
