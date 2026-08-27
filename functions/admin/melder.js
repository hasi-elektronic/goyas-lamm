/**
 * Melder — sagt dem Panel, ob seit dem letzten Blick etwas Neues hereingekommen ist.
 *
 * Das Panel fragt hier alle paar Sekunden nach. Bewusst gepollt und nicht über eine
 * offene Verbindung: Pages Functions haben keinen Zustand, eine dauerhafte Verbindung
 * bräuchte Durable Objects. Zwei winzige Abfragen alle 20 Sekunden sind billiger als
 * diese Komplexität — und sie überleben jeden Verbindungsabbruch im Restaurant-WLAN.
 *
 * Zwei Regeln, damit die Meldung nicht nervt:
 *  1. Ohne `seit` gibt es **nie** Treffer, nur die aktuelle Zeit. Beim Laden der Seite
 *     holt sich das Panel damit seinen Startpunkt — sonst würde beim Öffnen die
 *     Reservierung von gestern Abend noch einmal durchs Bild fliegen.
 *  2. Nur was der Gast selbst online gebucht hat (`source = 'web'`). Was das Personal
 *     im Panel einträgt, meldet sich nicht selbst zurück.
 */
import { darfPersonendaten, kuerzeName } from '../_lib/auth.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** ISO-Zeitstempel? Alles andere wird verworfen, statt es in eine Abfrage zu geben. */
const istISO = v => typeof v === 'string' && v.length >= 20 && v.length <= 30
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/** Wie weit der erste Aufruf beim Öffnen des Panels zurückschaut. */
const NACHZUEGLER_MIN = 20;

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const jetzt = new Date().toISOString();
  let seit = url.searchParams.get('seit');

  /*
   * Beim Öffnen des Panels: die letzten Minuten mitnehmen.
   *
   * Vorher holte der erste Aufruf nur den Startpunkt. Wer aber erst bucht und dann das
   * Panel öffnet — der häufigste Fall überhaupt — bekam nie eine Meldung. Jetzt schaut
   * der erste Aufruf 20 Minuten zurück; welche davon auf diesem Gerät schon gezeigt
   * wurden, entscheidet das Panel selbst anhand der Kennungen.
   */
  if (url.searchParams.get('start') === '1' && !istISO(seit)) {
    seit = new Date(Date.now() - NACHZUEGLER_MIN * 60000).toISOString();
  } else if (!istISO(seit)) {
    return json({ jetzt, neu: [] });
  } else if (Date.parse(jetzt) - Date.parse(seit) > 3600e3) {
    // Mehr als eine Stunde Rückstand? Dann lag das Tablet im Standby — nicht nachträglich
    // ein Feuerwerk für zehn alte Buchungen abbrennen, sondern still weiterzählen.
    return json({ jetzt, neu: [] });
  }

  const db = env.DB;
  const klartext = darfPersonendaten(data?.user?.role);
  const neu = [];

  try {
    const res = await db.prepare(
      `SELECT id, created_at, res_date, res_time, guests, name, note
         FROM reservations
        WHERE created_at > ? AND source = 'web' AND status = 'confirmed'
        ORDER BY created_at LIMIT 5`).bind(seit).all();

    for (const r of res.results || []) {
      neu.push({
        art: 'reservierung',
        id: r.id,
        name: klartext ? r.name : kuerzeName(r.name),
        datum: r.res_date,
        zeit: r.res_time,
        gaeste: r.guests,
        notiz: klartext && r.note ? String(r.note).slice(0, 120) : '',
      });
    }

    const w = await db.prepare(
      `SELECT id, created_at, res_date, res_time, guests, name
         FROM waitlist
        WHERE created_at > ? AND status = 'offen'
        ORDER BY created_at LIMIT 5`).bind(seit).all();

    for (const r of w.results || []) {
      neu.push({
        art: 'warteliste',
        id: r.id,
        name: klartext ? r.name : kuerzeName(r.name),
        datum: r.res_date,
        zeit: r.res_time || '',
        gaeste: r.guests,
        notiz: '',
      });
    }
  } catch {
    // Datenbank kurz nicht erreichbar: keine Meldung, aber auch kein Fehler im Panel.
    // Der Zeitstempel wird trotzdem NICHT weitergesetzt — sonst ginge die Buchung,
    // die in dieser Sekunde ankam, für immer verloren.
    return json({ jetzt: seit, neu: [] });
  }

  neu.sort((a, b) => (a.datum + a.zeit).localeCompare(b.datum + b.zeit));
  return json({ jetzt, neu: neu.slice(0, 5) });
}
