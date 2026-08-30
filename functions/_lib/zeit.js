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

/**
 * Summe der **abgeschlossenen** Pausen einer Schicht, in Minuten.
 *
 * Eine laufende Pause zählt bewusst nicht mit: Solange sie offen ist, weiß
 * niemand, wie lang sie wird. Sie wird beim Beenden geschlossen — spätestens
 * beim Feierabend — und erst dann mitgerechnet.
 */
export const pausenSumme = zeilen =>
  (zeilen || []).reduce((s, p) => p.end_at ? s + (brutto(p.start_at, p.end_at) || 0) : s, 0);

/**
 * Mindestpause nach § 4 ArbZG: über sechs Stunden Arbeitszeit 30 Minuten,
 * über neun Stunden 45. Darunter keine.
 *
 * Wird nur zum **Hinweisen** benutzt, nie zum Abziehen. Eine Pause, die
 * niemand gemacht hat, automatisch abzuziehen wäre eine Kürzung der
 * Arbeitszeit — genau das, was § 17 MiLoG verhindern soll.
 *
 * @param {number} minuten Anwesenheit ohne Pausenabzug
 * @returns {number} 0, 30 oder 45
 */
export const pflichtPause = minuten =>
  minuten > 9 * 60 ? 45 : minuten > 6 * 60 ? 30 : 0;

/** Netto = Anwesenheit minus Pause. Das ist die **echte** Dauer, ungerundet. */
export function netto(s) {
  const b = brutto(s.start_at, s.end_at);
  return b === null ? null : Math.max(0, b - (s.break_min || 0));
}

/* ------------------------------------------------------------------ */
/* Rundung                                                             */
/* ------------------------------------------------------------------ */

/** Stufe, auf die für die Abrechnung gerundet wird. */
export const RUNDUNG_MIN = 5;

/**
 * Kaufmännisch auf die nächste 5-Minuten-Stufe — 5:16 wird 5:15, 5:18 wird 5:20.
 *
 * Bewusst **zur nächsten** Stufe und nicht ab- oder aufgerundet: Wer den Beginn
 * hoch und das Ende herunter rundet, kürzt systematisch die Arbeitszeit. Das ist
 * arbeitsrechtlich unwirksam und beim Zoll ein Fehlbetrag, kein Rundungsfehler.
 * Zur nächsten Stufe gleicht sich über den Monat von selbst aus.
 *
 * Gerundet wird die **Dauer**, nicht Beginn und Ende einzeln — sonst rundet man
 * zweimal und der Fehler verdoppelt sich.
 *
 * Die gestempelten Zeiten selbst bleiben unangetastet in der Datenbank. Sie sind
 * die Aufzeichnung nach § 17 MiLoG; die Rundung ist nur die Rechengrundlage.
 */
export const runde = min => (min === null || min === undefined)
  ? null
  : Math.round(min / RUNDUNG_MIN) * RUNDUNG_MIN;

/** Netto-Dauer, gerundet — die Grundlage für Lohn und Trinkgeldanteil. */
export const nettoGerundet = s => runde(netto(s));

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
  let arbeit = 0, gerundet = 0, pause = 0, sonntag = 0, nacht = 0, offen = 0;
  const tage = new Set();
  for (const s of schichten) {
    const n = netto(s);
    if (n === null) { offen++; continue; }
    arbeit += n;
    gerundet += runde(n);
    pause += s.break_min || 0;
    const z = zuschlaege(s);
    sonntag += z.sonntag;
    nacht += z.nacht;
    tage.add(s.work_date);
  }
  return { arbeit, gerundet, pause, sonntag, nacht, offen,
           tage: tage.size, anzahl: schichten.length };
}

/* ------------------------------------------------------------------ */
/* Geld                                                                */
/* ------------------------------------------------------------------ */

/**
 * Gesetzlicher Mindestlohn, in Cent je Stunde.
 * 2026: 13,90 € — 2027 steigt er auf 14,60 €. Beim Jahreswechsel hier anpassen.
 */
export const MINDESTLOHN_CENT = 1390;

/** Minijob-Grenze 2026: 603 € im Monat. */
export const MINIJOB_CENT = 60300;

/** „12,50" oder „12.50" → 1250 Cent. Leer oder unsinnig → null. */
export function centAus(text) {
  const t = String(text ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
  if (!t) return null;
  const z = Number(t);
  if (!Number.isFinite(z) || z < 0 || z > 100000) return null;
  return Math.round(z * 100);
}

/** 1250 → „12,50". */
export const euro = cent =>
  (Math.round(cent || 0) / 100).toFixed(2).replace('.', ',');

/** Lohn für eine Minutenzahl bei einem Stundenlohn in Cent. */
export const lohnCent = (minuten, stundenCent) =>
  (!stundenCent || !minuten) ? 0 : Math.round(minuten / 60 * stundenCent);

/**
 * Verteilt einen Trinkgeld-Topf nach den gearbeiteten Minuten eines Abends.
 *
 * @param {number} topfCent  Summe des Abends
 * @param {Array<{id:string, minuten:number}>} leute
 * @returns {Object} staff_id → Cent
 *
 * Die Rundungsdifferenz bekommt, wer am längsten da war — sonst bleiben je nach
 * Abend ein paar Cent übrig und die Summe der Anteile passt nicht zum Topf.
 */
export function verteileTrinkgeld(topfCent, leute) {
  const out = {};
  const gesamt = leute.reduce((s, p) => s + (p.minuten || 0), 0);
  if (!topfCent || !gesamt) { for (const p of leute) out[p.id] = 0; return out; }
  let verteilt = 0;
  for (const p of leute) {
    out[p.id] = Math.floor(topfCent * (p.minuten || 0) / gesamt);
    verteilt += out[p.id];
  }
  const rest = topfCent - verteilt;
  if (rest > 0) {
    const laengster = [...leute].sort((a, b) => (b.minuten || 0) - (a.minuten || 0))[0];
    if (laengster) out[laengster.id] += rest;
  }
  return out;
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
