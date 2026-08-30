/**
 * Abwesenheiten — Urlaub, Krankheit und der Rest.
 *
 * Diese Datei rechnet und benennt. Sie liest nichts aus der Datenbank und
 * schreibt nichts hinein; das machen `admin/personal.js`, `admin/dienstplan.js`
 * und `zeit.js`. So lässt sich alles hier ohne Browser und ohne D1 prüfen.
 *
 * ── Was hier bewusst fehlt ────────────────────────────────────────────
 * Kein Feld, keine Funktion und kein Begriff für einen Krankheitsgrund.
 * Art. 9 DSGVO: Gesundheitsdaten sind besonders geschützt. Der Betrieb darf
 * wissen, **dass** und **wie lange** jemand ausfällt und ob die
 * Arbeitsunfähigkeitsbescheinigung vorliegt (§ 5 EntgFG) — nicht, woran es
 * liegt. Diese Grenze ist nicht verhandelbar; wer ein Diagnosefeld einbaut,
 * macht aus einer Dienstplanung eine Patientenakte.
 */
import { weekday, addDays, diffDays, WEEKDAY_DE } from './core.js';

/* ------------------------------------------------------------------ */
/* Arten                                                               */
/* ------------------------------------------------------------------ */

/**
 * `konto: true` heißt: zählt gegen den Jahresurlaub.
 * Krankheit zählt ausdrücklich **nicht** — wer im Urlaub krank wird, bekommt
 * die Tage zurück (§ 9 BUrlG). Deshalb sind es zwei Arten und nicht eine.
 */
export const ARTEN = {
  urlaub:    { label: 'Urlaub',            kurz: 'Urlaub',   konto: true,  werChef: false },
  krank:     { label: 'Krank',             kurz: 'Krank',    konto: false, werChef: true  },
  unbezahlt: { label: 'Unbezahlt frei',    kurz: 'Unbez.',   konto: false, werChef: true  },
  eltern:    { label: 'Elternzeit',        kurz: 'Eltern',   konto: false, werChef: true  },
  schulung:  { label: 'Schulung',          kurz: 'Schulung', konto: false, werChef: true  },
  sonder:    { label: 'Sonderurlaub',      kurz: 'Sonder',   konto: false, werChef: true  },
};

export const STATUS = {
  beantragt:  'beantragt',
  genehmigt:  'genehmigt',
  abgelehnt:  'abgelehnt',
  storniert:  'storniert',
};

export const istArt = a => Object.prototype.hasOwnProperty.call(ARTEN, a);
export const artLabel = a => ARTEN[a]?.label || a || '—';

/* ------------------------------------------------------------------ */
/* Tage zählen                                                         */
/* ------------------------------------------------------------------ */

/**
 * Werktage zwischen zwei Tagen, beide einschließlich.
 *
 * Werktag im Sinne des § 3 BUrlG ist **Montag bis Samstag** — der Sonntag
 * zählt nicht, Feiertage auch nicht (die sind hier nicht hinterlegt).
 *
 * Das passt nicht perfekt auf ein Restaurant, das sonntags öffnet und
 * mittwochs zu hat: Wer sonntags arbeitet, verliert bei dieser Zählung
 * rechnerisch einen Arbeitstag, gewinnt aber den Mittwoch. Über ein Jahr
 * gleicht sich das ungefähr aus, und es ist die Einheit, in der das Gesetz und
 * jeder Arbeitsvertrag rechnen.
 *
 * Deshalb ist die Zahl ein **Vorschlag**: Beim Anlegen einer Abwesenheit steht
 * sie in einem Feld, das der Chef überschreiben kann. Sollte der Betrieb
 * später in Arbeitstagen rechnen wollen, ist diese eine Funktion die Stelle,
 * die sich ändert.
 */
export function werktage(von, bis) {
  if (!von || !bis || bis < von) return 0;
  let n = 0;
  for (let t = von; t <= bis; t = addDays(t, 1)) {
    if (weekday(t) !== 0) n++;
    if (n > 400) break;                 // Notbremse gegen kaputte Daten
  }
  return n;
}

/** Kalendertage, beide einschließlich. */
export const kalendertage = (von, bis) =>
  (!von || !bis || bis < von) ? 0 : diffDays(von, bis) + 1;

/**
 * Gesetzlicher Mindesturlaub für eine Anzahl Arbeitstage pro Woche.
 * § 3 BUrlG: 24 Werktage bei Sechstagewoche — anteilig umgerechnet.
 * Wird aufgerundet, weil Urlaubsansprüche nicht zu Lasten des Arbeitnehmers
 * gerundet werden dürfen.
 */
export const mindestUrlaub = tageProWoche =>
  Math.ceil(24 * Math.max(0, Math.min(6, tageProWoche || 0)) / 6);

/** Überschneiden sich zwei Zeiträume? */
export const ueberschneidet = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;

/** Fällt ein Tag in die Abwesenheit? */
export const trifft = (abw, tag) => abw.von <= tag && tag <= abw.bis;

/* ------------------------------------------------------------------ */
/* Urlaubskonto                                                        */
/* ------------------------------------------------------------------ */

/**
 * Wie viele Tage einer Abwesenheit fallen in ein bestimmtes Jahr?
 * Urlaub über Silvester ist selten, aber er kommt vor — und dann gehört jeder
 * Tag in das Jahr, in dem er liegt.
 */
export function tageImJahr(abw, jahr) {
  const jv = `${jahr}-01-01`, jb = `${jahr}-12-31`;
  if (!ueberschneidet(abw.von, abw.bis, jv, jb)) return 0;
  const von = abw.von < jv ? jv : abw.von;
  const bis = abw.bis > jb ? jb : abw.bis;
  /* Steht eine eigene Tageszahl drin (vom Chef korrigiert), wird sie
     anteilig aufgeteilt — sonst würde eine Korrektur beim Jahreswechsel
     doppelt zählen. */
  const gesamt = werktage(abw.von, abw.bis);
  const teil = werktage(von, bis);
  if (abw.tage === null || abw.tage === undefined) return teil;
  return gesamt ? Math.round(abw.tage * teil / gesamt) : 0;
}

/**
 * Urlaubskonto einer Person für ein Jahr.
 * @param {object} person  Zeile aus `staff`
 * @param {Array}  zeilen  alle Abwesenheiten dieser Person
 * @param {number} jahr
 */
export function urlaubskonto(person, zeilen, jahr) {
  const anspruch  = Number(person?.urlaub_tage) || 0;
  const uebertrag = Number(person?.urlaub_rest_vj) || 0;
  let genommen = 0, geplant = 0;
  for (const a of zeilen || []) {
    if (!ARTEN[a.art]?.konto) continue;
    const t = tageImJahr(a, jahr);
    if (!t) continue;
    if (a.status === STATUS.genehmigt) genommen += t;
    else if (a.status === STATUS.beantragt) geplant += t;
  }
  return {
    anspruch, uebertrag, genommen, geplant,
    gesamt: anspruch + uebertrag,
    rest: anspruch + uebertrag - genommen - geplant,
  };
}

/* ------------------------------------------------------------------ */
/* Anzeige                                                             */
/* ------------------------------------------------------------------ */

/** „Mo, 12.05." — kurz genug für eine Tabellenzelle. */
export const kurz = d => d ? `${WEEKDAY_DE[weekday(d)].slice(0, 2)}, ${d.slice(8)}.${d.slice(5, 7)}.` : '';

/** „12.05.–18.05.2026" bzw. nur ein Datum, wenn es ein einzelner Tag ist. */
export function zeitraum(von, bis) {
  if (!von) return '';
  const t = d => `${d.slice(8)}.${d.slice(5, 7)}.`;
  if (von === bis) return `${t(von)}${von.slice(0, 4)}`;
  return von.slice(0, 4) === bis.slice(0, 4)
    ? `${t(von)}–${t(bis)}${bis.slice(0, 4)}`
    : `${t(von)}${von.slice(0, 4)}–${t(bis)}${bis.slice(0, 4)}`;
}

/**
 * Wann muss die Arbeitsunfähigkeitsbescheinigung spätestens da sein?
 * § 5 Abs. 1 EntgFG: ab dem vierten Kalendertag — der Arbeitgeber kann sie
 * aber schon ab dem ersten Tag verlangen. Wir zeigen die gesetzliche Frist.
 */
export const auFrist = von => von ? addDays(von, 3) : null;
