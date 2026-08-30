/**
 * Fristen und Grenzen rund ums Personal — an einer Stelle gerechnet.
 *
 * ── Warum es diese Datei gibt ─────────────────────────────────────────
 * Die Angaben lagen alle schon irgendwo: das Datum der letzten Belehrung auf
 * der Personalkarte, das Eintrittsdatum daneben, die Stunden im Monat eine
 * Karte tiefer. Nur schaut da niemand hin, solange nichts weh tut — und dann
 * ist die Belehrung seit acht Monaten abgelaufen, die Aushilfe seit drei
 * Monaten über der Minijob-Grenze und die Probezeit letzte Woche zu Ende
 * gegangen.
 *
 * Das ist der Unterschied zwischen „die Daten stehen im System" und „das
 * System sagt Bescheid". Diese Datei macht daraus eine Liste, die auf der
 * Übersicht steht.
 *
 * Sie rechnet nur. Kein Datenbankzugriff, keine Ausgabe — damit sich jede
 * Regel einzeln nachrechnen lässt.
 */
import { addDays, diffDays, weekday } from './core.js';
import { MINIJOB_CENT, euro } from './zeit.js';
import { auFrist, ARTEN, STATUS, zeitraum } from './abwesenheit.js';

/** Belehrung nach § 43 IfSG: alle zwei Jahre zu wiederholen. */
export const BELEHRUNG_MONATE = 24;
/** So viele Tage im Voraus wird gewarnt. */
export const VORLAUF = 60;
/** Probezeit: Regelfall sechs Monate (§ 622 Abs. 3 BGB). */
export const PROBEZEIT_MONATE = 6;

const monateSpaeter = (datum, n) => {
  const [y, m, d] = datum.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, d));
  return dt.toISOString().slice(0, 10);
};

/** Alter in Jahren am Stichtag. */
export function alter(geburtstag, heute) {
  if (!geburtstag) return null;
  const [gy, gm, gd] = geburtstag.split('-').map(Number);
  const [hy, hm, hd] = heute.split('-').map(Number);
  let a = hy - gy;
  if (hm < gm || (hm === gm && hd < gd)) a--;
  return a;
}

/** Nächster Geburtstag ab heute, als YYYY-MM-DD. */
export function naechsterGeburtstag(geburtstag, heute) {
  if (!geburtstag) return null;
  const jahr = Number(heute.slice(0, 4));
  const md = geburtstag.slice(5);
  /* 29. Februar: in Nicht-Schaltjahren auf den 1. März. Selten, aber
     ein `Invalid Date` an dieser Stelle nimmt die halbe Übersicht mit. */
  const bau = j => (md === '02-29' && !((j % 4 === 0 && j % 100 !== 0) || j % 400 === 0))
    ? `${j}-03-01` : `${j}-${md}`;
  const d = bau(jahr);
  return d >= heute ? d : bau(jahr + 1);
}

/**
 * Alle Hinweise zu einer Person.
 *
 * @param {object} p        Zeile aus `staff`
 * @param {string} heute    YYYY-MM-DD
 * @param {object} opt
 * @param {number} [opt.monatCent]  verdiente Cent im laufenden Monat
 * @param {Array}  [opt.abwesenheiten] Abwesenheiten dieser Person
 * @returns {Array<{stufe:'warn'|'info', kurz:string, text:string}>}
 */
export function fristenFuer(p, heute, opt = {}) {
  const raus = [];
  const warn = (kurz, text) => raus.push({ stufe: 'warn', kurz, text });
  const info = (kurz, text) => raus.push({ stufe: 'info', kurz, text });

  /* --- Belehrung § 43 IfSG ---------------------------------------- */
  if (!p.belehrung_am) {
    warn('Belehrung fehlt',
      'Keine Belehrung nach § 43 IfSG eingetragen. Ohne sie darf niemand mit '
      + 'Lebensmitteln arbeiten — und sie ist das Erste, wonach die Kontrolle fragt.');
  } else {
    const faellig = monateSpaeter(p.belehrung_am, BELEHRUNG_MONATE);
    const tage = diffDays(heute, faellig);
    if (tage < 0) warn('Belehrung abgelaufen',
      `Die Belehrung nach § 43 IfSG war am ${faellig.slice(8)}.${faellig.slice(5,7)}.${faellig.slice(0,4)} fällig — seit ${-tage} Tagen überfällig.`);
    else if (tage <= VORLAUF) info('Belehrung läuft ab',
      `Die Belehrung nach § 43 IfSG ist in ${tage} Tagen zu wiederholen.`);
  }

  /* --- Jugendarbeitsschutz ---------------------------------------- */
  const a = alter(p.birthday, heute);
  if (a !== null && a < 18) {
    warn('Unter 18',
      `${a} Jahre alt. Es gilt das Jugendarbeitsschutzgesetz: höchstens 8 Stunden am Tag `
      + 'und 40 in der Woche, nicht nach 22 Uhr (in der Gastronomie ab 16 bis 22 Uhr), '
      + 'und die ärztliche Erstuntersuchung muss vorliegen.');
  }

  /* --- Probezeit --------------------------------------------------- */
  if (p.start_date) {
    const ende = monateSpaeter(p.start_date, PROBEZEIT_MONATE);
    const tage = diffDays(heute, ende);
    if (tage >= 0 && tage <= 30) info('Probezeit endet',
      `Die Probezeit endet am ${ende.slice(8)}.${ende.slice(5,7)}.${ende.slice(0,4)}`
      + (tage === 0 ? ' — heute.' : ` — in ${tage} Tagen.`)
      + ' Danach gilt die reguläre Kündigungsfrist.');
  }

  /* --- Arbeitsvertrag ---------------------------------------------- */
  if (!p.vertrag_am) {
    info('Vertrag nicht vermerkt',
      'Kein Datum für den Arbeitsvertrag hinterlegt. Das Nachweisgesetz verlangt die '
      + 'wesentlichen Bedingungen schriftlich, spätestens am ersten Arbeitstag.');
  }

  /* --- Aufenthaltstitel / Arbeitserlaubnis -------------------------- */
  if (p.titel_bis) {
    const tage = diffDays(heute, p.titel_bis);
    if (tage < 0) warn('Arbeitserlaubnis abgelaufen',
      `Der hinterlegte Titel war bis ${p.titel_bis.slice(8)}.${p.titel_bis.slice(5,7)}.${p.titel_bis.slice(0,4)} gültig. Weiterbeschäftigung ohne gültige Erlaubnis ist eine Straftat, nicht nur eine Ordnungswidrigkeit.`);
    else if (tage <= VORLAUF) warn('Arbeitserlaubnis läuft ab',
      `Der hinterlegte Titel gilt noch ${tage} Tage. Verlängerung rechtzeitig anstoßen.`);
  }

  /* --- Minijob-Grenze ---------------------------------------------- */
  const cent = Number(opt.monatCent) || 0;
  if (cent && (p.art === 'Minijob' || p.art === 'Aushilfe')) {
    if (cent > MINIJOB_CENT) warn('Minijob-Grenze überschritten',
      `${euro(cent)} € in diesem Monat, Grenze sind ${euro(MINIJOB_CENT)} €. `
      + 'Über der Grenze wird die Beschäftigung sozialversicherungspflichtig — '
      + 'rückwirkend, und das wird teuer. Mit dem Steuerberater klären.');
    else if (cent > MINIJOB_CENT * 0.85) info('Nahe an der Minijob-Grenze',
      `${euro(cent)} € in diesem Monat von ${euro(MINIJOB_CENT)} €. Bei der Schichtplanung im Auge behalten.`);
  }

  /* --- Krankmeldung ohne Bescheinigung ------------------------------ */
  for (const abw of opt.abwesenheiten || []) {
    if (abw.art !== 'krank' || abw.au_da) continue;
    const frist = auFrist(abw.von);
    if (frist && frist < heute) warn('AU-Bescheinigung fehlt',
      `Krank seit ${zeitraum(abw.von, abw.bis)}, die Bescheinigung war am `
      + `${frist.slice(8)}.${frist.slice(5,7)}. fällig (§ 5 EntgFG).`);
  }

  /* --- Geburtstag --------------------------------------------------- */
  const gb = naechsterGeburtstag(p.birthday, heute);
  if (gb) {
    const tage = diffDays(heute, gb);
    if (tage === 0) info('Geburtstag', 'Hat heute Geburtstag.');
    else if (tage <= 14) info('Geburtstag',
      `Geburtstag in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} (${gb.slice(8)}.${gb.slice(5,7)}.).`);
  }

  return raus;
}

/**
 * Resturlaub zum Jahresende — der Klassiker, der im Dezember alle überrascht.
 * Ab Oktober und nur, wenn wirklich etwas übrig ist.
 */
export function resturlaubHinweis(konto, heute) {
  const monat = Number(heute.slice(5, 7));
  if (monat < 10 || konto.rest <= 3 || !konto.gesamt) return null;
  return {
    stufe: monat >= 11 ? 'warn' : 'info',
    kurz: 'Resturlaub',
    text: `${konto.rest} von ${konto.gesamt} Urlaubstagen sind dieses Jahr noch offen. `
      + 'Nicht genommener Urlaub verfällt zum 31.12. nur, wenn der Arbeitgeber rechtzeitig '
      + 'darauf hingewiesen hat (BAG, 19.02.2019 – 9 AZR 541/15) — sonst wandert er ins nächste Jahr.',
  };
}
