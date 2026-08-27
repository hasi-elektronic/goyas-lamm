/**
 * Wareneingang — Einheiten, Warengruppen, Temperaturgrenzen, Rechnen.
 *
 * Hier steht nur reine Logik ohne Datenbank, damit sie sich einzeln prüfen lässt.
 *
 * Zwei Zahlenformate ziehen sich durch alles:
 *   Geld    → ganzzahlige **Cent**            (12,50 € = 1250)
 *   Mengen  → ganzzahlige **Tausendstel**     (1,250 kg = 1250)
 *   Grad    → ganzzahlige **Zehntel**         (−18,0 °C = -180)
 * Nie Fließkomma. Sonst wird aus 0,1 + 0,2 irgendwann 0,30000000000000004 und
 * eine Inventur, die zweimal anders ausgeht.
 */

/* ------------------------------------------------------------------ */
/* Einheiten                                                           */
/* ------------------------------------------------------------------ */

export const EINHEITEN = {
  kg:      { label: 'kg',       nk: 3 },   // Nachkommastellen in der Anzeige
  l:       { label: 'l',        nk: 3 },
  stk:     { label: 'Stück',    nk: 0 },
  kiste:   { label: 'Kiste',    nk: 0 },
  karton:  { label: 'Karton',   nk: 0 },
  packung: { label: 'Packung',  nk: 0 },
  flasche: { label: 'Flasche',  nk: 0 },
};
export const istEinheit = e => Object.prototype.hasOwnProperty.call(EINHEITEN, e);
export const einheitLabel = e => EINHEITEN[e]?.label || e || '';

/* ------------------------------------------------------------------ */
/* Warengruppen und Lagerorte                                          */
/* ------------------------------------------------------------------ */

export const GRUPPEN = {
  fleisch:   'Fleisch',
  gefluegel: 'Geflügel',
  fisch:     'Fisch',
  molkerei:  'Molkerei & Eier',
  obst:      'Obst & Gemüse',
  tk:        'Tiefkühl',
  trocken:   'Trockenware',
  getraenke: 'Getränke',
  nonfood:   'Non-Food',
};

/**
 * Lagerorte — die Reihenfolge ist die, in der man beim Zählen tatsächlich
 * durchs Haus läuft. Deshalb ein Array, keine alphabetische Liste.
 */
export const ORTE = ['Küche', 'Kühlhaus', 'Tiefkühl', 'Trockenlager', 'Getränkelager', 'Bar'];

/* ------------------------------------------------------------------ */
/* Temperaturgrenzen                                                   */
/* ------------------------------------------------------------------ */

/**
 * Voreinstellung der Grenzwerte in Zehntelgrad.
 *
 * Grundlage sind die Anforderungen aus VO (EG) 853/2004 bzw. der Tiefkühl-
 * verordnung. ⚠️ Die Quellen weichen im Detail voneinander ab — manche nennen
 * für Geflügel und frisches Fleisch strengere Werte. Deshalb sind diese Zahlen
 * **änderbar** (settings-Schlüssel `ware_temp`) und keine feste Zusage. Vor dem
 * Ernstfall einmal mit der Lebensmittelüberwachung abgleichen.
 *
 * `max` = wärmste noch zulässige Temperatur. Bei Tiefkühlware ist die Logik
 * dieselbe: −18,0 °C ist die Grenze, wärmer ist zu warm.
 */
export const TEMP_KLASSEN = {
  hack:      { label: 'Hackfleisch',            max: 20,   quelle: 'VO (EG) 853/2004' },
  zub:       { label: 'Fleischzubereitungen',   max: 40,   quelle: 'VO (EG) 853/2004' },
  gefluegel: { label: 'Geflügelfleisch',        max: 40,   quelle: 'VO (EG) 853/2004' },
  fleisch:   { label: 'Frisches Fleisch',       max: 70,   quelle: 'VO (EG) 853/2004' },
  innerei:   { label: 'Innereien',              max: 30,   quelle: 'VO (EG) 853/2004' },
  fisch:     { label: 'Frischfisch',            max: 20,   quelle: 'auf schmelzendem Eis, 0–2 °C' },
  molkerei:  { label: 'Milch & Milchprodukte',  max: 60,   quelle: 'VO (EG) 853/2004' },
  ei:        { label: 'Eier',                   max: 40,   quelle: 'gleichbleibend gekühlt' },
  tk:        { label: 'Tiefkühlware',           max: -180, quelle: 'Tiefkühl-VO' },
};

/**
 * Grenzwerte inklusive der im Panel geänderten Werte.
 * @param {string|null} rohJson Inhalt von settings.ware_temp
 */
export function tempKlassen(rohJson) {
  const aus = {};
  for (const [k, v] of Object.entries(TEMP_KLASSEN)) aus[k] = { ...v };
  if (!rohJson) return aus;
  try {
    const eigen = JSON.parse(rohJson);
    for (const [k, v] of Object.entries(eigen || {})) {
      if (aus[k] && Number.isInteger(v)) aus[k].max = v;
    }
  } catch { /* kaputter Eintrag: Voreinstellung gilt weiter */ }
  return aus;
}

/**
 * Liegt die gemessene Temperatur im Rahmen?
 * @returns {boolean|null} null = nicht beurteilbar (keine Klasse oder kein Messwert)
 */
export function tempOk(zehntel, klasse, klassen = TEMP_KLASSEN) {
  if (zehntel === null || zehntel === undefined || !klasse) return null;
  const g = klassen[klasse];
  if (!g) return null;
  return zehntel <= g.max;
}

/* ------------------------------------------------------------------ */
/* Zahlen lesen und schreiben                                          */
/* ------------------------------------------------------------------ */

const zahlAus = (text, faktor) => {
  const s = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s || !/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-' || s === '-.') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * faktor);
};

/** „1,25" → 125 Cent. null bei Unsinn. */
export const centAus = t => zahlAus(t, 100);
/** „1,250" → 1250 Tausendstel. */
export const mengeAus = t => zahlAus(t, 1000);
/** „−1,5" → −15 Zehntelgrad. */
export const tempAus = t => zahlAus(t, 10);

export const euro = cent =>
  (Math.round(cent || 0) / 100).toFixed(2).replace('.', ',');

/** Menge in der Schreibweise ihrer Einheit: 1250 + 'kg' → „1,250". */
export function menge(milli, einheit = 'kg') {
  const nk = EINHEITEN[einheit]?.nk ?? 3;
  const v = (Math.round(milli || 0) / 1000).toFixed(nk);
  return nk ? v.replace('.', ',') : v;
}

export const grad = zehntel =>
  zehntel === null || zehntel === undefined
    ? '—' : (Math.round(zehntel) / 10).toFixed(1).replace('.', ',') + ' °C';

/* ------------------------------------------------------------------ */
/* Rechnen                                                             */
/* ------------------------------------------------------------------ */

/**
 * Positionswert = Menge × Einzelpreis.
 * Erst multiplizieren, dann teilen und einmal runden — sonst summieren sich
 * die Rundungsfehler über hundert Positionen zu einem sichtbaren Betrag.
 */
export const positionCent = (mengeMilli, epCent) =>
  (!epCent || !mengeMilli) ? 0 : Math.round(mengeMilli * epCent / 1000);

export const summeCent = posten =>
  posten.reduce((s, p) => s + positionCent(p.menge_milli, p.ep_cent), 0);

/**
 * Preisänderung in Prozent, auf eine Nachkommastelle.
 * @returns {number|null} null, wenn kein Vergleich möglich ist
 */
export function preisDelta(altCent, neuCent) {
  if (!altCent || !neuCent || altCent <= 0) return null;
  return Math.round((neuCent - altCent) / altCent * 1000) / 10;
}

/**
 * Wareneinsatz einer Periode.
 *
 * Anfangsbestand + Einkauf − Endbestand. Ohne Kassenanbindung ist das der
 * einzig ehrliche Weg: Was nicht mehr im Regal steht, ist verbraucht — ob
 * gekocht, verdorben oder verschwunden, unterscheidet die Rechnung nicht.
 * Genau das ist auch der Grund, warum die Zahl etwas wert ist.
 */
export const wareneinsatz = (anfangCent, einkaufCent, endeCent) =>
  (anfangCent || 0) + (einkaufCent || 0) - (endeCent || 0);

/** Quote in Prozent, eine Nachkommastelle. null ohne Umsatz. */
export function quote(einsatzCent, umsatzCent) {
  if (!umsatzCent || umsatzCent <= 0) return null;
  return Math.round(einsatzCent / umsatzCent * 1000) / 10;
}

/* ------------------------------------------------------------------ */
/* Kleinkram                                                           */
/* ------------------------------------------------------------------ */

export const MASSNAHMEN = {
  angenommen: 'angenommen',
  teilweise:  'teilweise angenommen',
  zurueck:    'zurückgewiesen',
};

/** Kennung aus Zeit + Zufall — sortiert sich von allein chronologisch. */
export function kennung(praefix = 'w') {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return praefix + Date.now().toString(36)
    + [...a].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

export const istTag = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const istMonat = s => /^\d{4}-\d{2}$/.test(String(s || ''));

/** Schwelle für den Preisalarm in Zehntelprozent; Voreinstellung 10 %. */
export function schwelle(roh) {
  const n = parseInt(roh, 10);
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : 10;
}
