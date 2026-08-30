/**
 * Privatkasse — Kategorien, Monatsrechnung, Formatierung.
 *
 * Kein Datenbankzugriff, keine Ausgabe. Was hier steht, lässt sich ohne
 * Browser nachrechnen.
 *
 * ── Die Trennlinie ────────────────────────────────────────────────────
 * Diese Datei gehört zu Gökhans **privatem** Haushaltsbuch. Sie darf nirgends
 * aus einer Betriebsseite heraus importiert werden, und keine Zahl von hier
 * darf in eine Betriebsauswertung wandern. Wer beides mischt, macht aus einer
 * Übersicht ein Problem: privat und betrieblich auseinanderzuhalten ist keine
 * Ordnungsfrage, sondern der Punkt, an dem sonst der Steuerberater arbeitet.
 */

/* ------------------------------------------------------------------ */
/* Kategorien                                                          */
/* ------------------------------------------------------------------ */

/**
 * Eine feste Liste, absichtlich kurz. Freie Kategorien führen nach einem Jahr
 * zu „Auto", „auto" und „Auto " als drei Zeilen in der Auswertung — und damit
 * zu einer Auswertung, die nichts mehr auswertet.
 */
export const AUS_KATEGORIEN = {
  wohnen:      'Wohnen — Miete, Nebenkosten, Strom',
  versicherung:'Versicherungen',
  auto:        'Auto — Sprit, Werkstatt, Steuer',
  einkauf:     'Einkauf & Haushalt',
  gesundheit:  'Gesundheit & Apotheke',
  familie:     'Familie & Kinder',
  freizeit:    'Freizeit, Essen gehen, Urlaub',
  abo:         'Abos — Handy, Internet, Streaming',
  kredit:      'Kredit & Rate',
  steuer:      'Private Steuern & Beiträge',
  sonstiges:   'Sonstiges',
};

export const EIN_KATEGORIEN = {
  entnahme:    'Entnahme aus dem Betrieb',
  gehalt:      'Gehalt / Lohn',
  miete_ein:   'Miete, Zinsen, Kapital',
  rueck:       'Erstattung, Rückzahlung',
  geschenk:    'Geschenk, Privatdarlehen',
  sonstiges_e: 'Sonstiges',
};

export const RICHTUNGEN = { aus: 'Ausgabe', ein: 'Einnahme' };

export const ZAHLARTEN = { konto: 'Konto', bar: 'Bar', karte: 'Karte' };

export const istRichtung = r => r === 'aus' || r === 'ein';

export const katListe = richtung => richtung === 'ein' ? EIN_KATEGORIEN : AUS_KATEGORIEN;

/** Label einer Kategorie, in beiden Richtungen gesucht. */
export const katLabel = (k, richtung) =>
  katListe(richtung)[k] || AUS_KATEGORIEN[k] || EIN_KATEGORIEN[k] || k || 'Ohne Kategorie';

export const istKategorie = (k, richtung) => Object.hasOwn(katListe(richtung), k);

/* ------------------------------------------------------------------ */
/* Geld                                                                */
/* ------------------------------------------------------------------ */

/**
 * 350000 → „3.500,00". Mit Tausenderpunkt, anders als beim Rechnungsmodul:
 * Dort stehen Positionsbeträge in einer schmalen Spalte, hier stehen Monats-
 * und Jahressummen groß auf der Kachel, und „3500,00" liest sich dort für
 * einen Moment wie 350,00.
 */
export const euro = cent => {
  const [ganz, rest] = (Math.round(cent || 0) / 100).toFixed(2).split('.');
  return `${ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${rest}`;
};

/**
 * „12,50" oder „12.50" → 1250. Ein führendes Minus wird verworfen: die
 * Richtung steht in einem eigenen Feld, ein negativer Betrag wäre ein zweiter,
 * widersprechender Weg, dasselbe zu sagen.
 *
 * @returns {number|null} null bei Unsinn — der Aufrufer meldet den Fehler.
 */
export function centAus(text) {
  const s = String(text ?? '').trim().replace(/[\s€]/g, '').replace(',', '.').replace(/^[+-]/, '');
  if (!s || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const c = Math.round(n * 100);
  /* Eine Million Euro in einem privaten Haushaltsbuch ist ein Vertipper. */
  return c > 100_000_000 ? null : c;
}

/* ------------------------------------------------------------------ */
/* Monate                                                              */
/* ------------------------------------------------------------------ */

export const istMonat = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));

/** „2026-08" → „2026-07"; n auch negativ für vorwärts. */
export function monatMinus(monat, n = 1) {
  const [j, m] = monat.split('-').map(Number);
  const idx = j * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const monatLabel = monat => {
  const [j, m] = String(monat).split('-');
  return `${MONATSNAMEN[Number(m) - 1] || m} ${j}`;
};

export const monatKurz = monat => MONATSNAMEN[Number(String(monat).slice(5, 7)) - 1]?.slice(0, 3) || '—';

/* ------------------------------------------------------------------ */
/* Rechnen                                                             */
/* ------------------------------------------------------------------ */

/**
 * Summen eines Zeitraums.
 *
 * @param {Array} zeilen Datensätze aus `private_entries`
 * @returns {{ein:number, aus:number, saldo:number, anzahl:number}}
 */
export function summen(zeilen) {
  let ein = 0, aus = 0;
  for (const z of zeilen || []) {
    if (z.richtung === 'ein') ein += z.cent || 0;
    else aus += z.cent || 0;
  }
  return { ein, aus, saldo: ein - aus, anzahl: (zeilen || []).length };
}

/**
 * Ausgaben nach Kategorie, absteigend, mit Anteil am Gesamtbetrag.
 * Nur Ausgaben — „wohin geht mein Geld" ist die Frage, für die Gökhan das
 * hier haben wollte.
 */
export function nachKategorie(zeilen) {
  const proKat = new Map();
  let gesamt = 0;
  for (const z of zeilen || []) {
    if (z.richtung === 'ein') continue;
    proKat.set(z.kategorie, (proKat.get(z.kategorie) || 0) + (z.cent || 0));
    gesamt += z.cent || 0;
  }
  return [...proKat.entries()]
    .map(([kat, cent]) => ({
      kat,
      label: katLabel(kat, 'aus'),
      cent,
      anteil: gesamt ? Math.round(cent * 100 / gesamt) : 0,
    }))
    .sort((a, b) => b.cent - a.cent);
}

/**
 * Welche Vorlagen in diesem Monat noch nicht gebucht sind.
 * Die Datenbank verhindert das Doppelte über einen eindeutigen Index; hier
 * geht es nur darum, dem Knopf eine ehrliche Zahl zu geben.
 */
export const offeneVorlagen = (vorlagen, monatsZeilen) => {
  const gebucht = new Set((monatsZeilen || []).map(z => z.fix_id).filter(Boolean));
  return (vorlagen || []).filter(v => v.aktiv && !gebucht.has(v.id));
};
