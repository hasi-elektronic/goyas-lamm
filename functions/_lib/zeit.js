/**
 * Arbeitszeit — Rechnen und Auswerten.
 *
 * Rechtlicher Rahmen (§ 17 MiLoG): Beginn, Ende und Dauer der täglichen Arbeitszeit
 * werden aufgezeichnet, innerhalb von sieben Tagen, zwei Jahre aufzubewahren.
 * Diese Datei rechnet nur — sie erstellt ausdrücklich keine Lohnabrechnung.
 */
import { WEEKDAY_DE, weekday, addDays } from './core.js';

export const toMin = t => {
  const [h, m] = String(t || '0:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const hhmm = min => {
  const v = Math.max(0, Math.round(min));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

/** Stunden als Dezimalzahl mit zwei Stellen — so will es der Steuerberater. */
export const dezimal = min => (Math.max(0, min) / 60).toFixed(2).replace('.', ',');

/** Brutto-Anwesenheit in Minuten; über Mitternacht wird korrekt gerechnet. */
export function brutto(start, end) {
  if (!end) return null;
  let d = toMin(end) - toMin(start);
  if (d < 0) d += 1440;          // Schicht ging über Mitternacht
  return d;
}

/** Netto = Anwesenheit minus Pause. */
export function netto(s) {
  const b = brutto(s.start_at, s.end_at);
  return b === null ? null : Math.max(0, b - (s.break_min || 0));
}

/**
 * Minuten, die auf einen Sonntag bzw. in die Nacht (20–6 Uhr) fallen.
 * Bezieht sich auf die **Anwesenheit ohne Pausenabzug** — die Pause lässt sich
 * nicht sauber einer Tageszeit zuordnen. Wird in der Anzeige so benannt.
 * (Die Zeitfenster entsprechen § 3b EStG, dem üblichen Rahmen für Zuschläge.)
 */
export function zuschlaege(s) {
  const b = brutto(s.start_at, s.end_at);
  if (b === null) return { sonntag: 0, nacht: 0 };
  const beginn = toMin(s.start_at);
  let sonntag = 0, nacht = 0;
  for (let i = 0; i < b; i++) {
    const abs = beginn + i;
    const tagVersatz = Math.floor(abs / 1440);
    const uhr = abs % 1440;
    const tag = weekday(tagVersatz ? addDays(s.work_date, tagVersatz) : s.work_date);
    if (tag === 0) sonntag++;
    if (uhr >= 20 * 60 || uhr < 6 * 60) nacht++;
  }
  return { sonntag, nacht };
}

/** Fasst die Schichten eines Mitarbeiters zusammen. */
export function summe(schichten) {
  let arbeit = 0, pause = 0, sonntag = 0, nacht = 0, offen = 0;
  const tage = new Set();
  for (const s of schichten) {
    const n = netto(s);
    if (n === null) { offen++; continue; }
    arbeit += n;
    pause += s.break_min || 0;
    const z = zuschlaege(s);
    sonntag += z.sonntag;
    nacht += z.nacht;
    tage.add(s.work_date);
  }
  return { arbeit, pause, sonntag, nacht, offen, tage: tage.size, anzahl: schichten.length };
}

export const monatLabel = m => {
  const [y, mo] = m.split('-').map(Number);
  const MON = ['Januar','Februar','März','April','Mai','Juni','Juli','August',
               'September','Oktober','November','Dezember'];
  return `${MON[mo - 1]} ${y}`;
};

export const istMonat = v => /^\d{4}-\d{2}$/.test(v || '') && +v.slice(5) >= 1 && +v.slice(5) <= 12;

export const monatVerschieben = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const tagKurz = d => `${WEEKDAY_DE[weekday(d)].slice(0, 2)}, ${d.slice(8)}.${d.slice(5, 7)}.`;

/** PIN wird nur als Hash gespeichert. */
export async function pinHash(pin, salt) {
  const data = new TextEncoder().encode(`${salt || 'goyas'}|pin|${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
