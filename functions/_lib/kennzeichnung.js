/**
 * Allergene, Zusatzstoffe und Kennzeichen — die Bedeutung der Kürzel.
 *
 * ── Warum hier nichts abgeleitet wird ─────────────────────────────────
 * Diese Datei kennt nur die **Bedeutung** der Buchstaben und Zahlen, nicht
 * ihren Inhalt. Welches Gericht welchen Allergen trägt, entscheidet die Küche
 * und die Produktspezifikation des Lieferanten — nicht ein Rückschluss aus dem
 * Namen. „Käsespätzle enthält bestimmt Milch" mag stimmen; „das Dressing
 * enthält Senf" weiß nur, wer das Dressing macht. Wer Erdnuss nicht verträgt,
 * verlässt sich auf diese Angabe, und eine geratene Angabe ist schlimmer als
 * gar keine, weil sie Sicherheit vortäuscht.
 *
 * ── Rechtlicher Rahmen ────────────────────────────────────────────────
 * **Allergene** (14 Stück, VO (EU) 1169/2011 i. V. m. LMIDV): Bei loser Ware
 * darf die Auskunft auch mündlich erfolgen — dann muss eine schriftliche oder
 * **elektronische** Dokumentation auf Nachfrage leicht zugänglich sein und ein
 * deutlicher Hinweis im Betrieb hängen. Die QR-Karte kann genau diese
 * elektronische Fassung sein.
 *
 * **Zusatzstoffe** (14 Funktionsklassen, ZZulV): müssen **schriftlich**
 * kenntlich gemacht werden — auf der Karte, per Aushang oder auf einem leicht
 * zugänglichen Blatt. Angegeben wird die Funktionsklasse („mit Farbstoff"),
 * die E-Nummer ist freiwillig.
 *
 * ⚠️ Vor dem Scharfschalten mit der Lebensmittelüberwachung des Landkreises
 * abgleichen. Diese Datei ist eine Umsetzungshilfe, keine Rechtsauskunft.
 *
 * Die Buchstaben A–N sind die in der deutschen Gastronomie übliche Reihenfolge
 * der 14 Allergene. Sie ist nicht vorgeschrieben, aber verbreitet genug, dass
 * Gäste sie wiedererkennen.
 */

export const ALLERGENE = {
  a: { de: 'Glutenhaltiges Getreide', en: 'Cereals containing gluten' },
  b: { de: 'Krebstiere',              en: 'Crustaceans' },
  c: { de: 'Eier',                    en: 'Eggs' },
  d: { de: 'Fische',                  en: 'Fish' },
  e: { de: 'Erdnüsse',                en: 'Peanuts' },
  f: { de: 'Sojabohnen',              en: 'Soybeans' },
  g: { de: 'Milch und Laktose',       en: 'Milk and lactose' },
  h: { de: 'Schalenfrüchte (Nüsse)',  en: 'Tree nuts' },
  i: { de: 'Sellerie',                en: 'Celery' },
  j: { de: 'Senf',                    en: 'Mustard' },
  k: { de: 'Sesamsamen',              en: 'Sesame seeds' },
  l: { de: 'Schwefeldioxid und Sulfite', en: 'Sulphur dioxide and sulphites' },
  m: { de: 'Lupinen',                 en: 'Lupin' },
  n: { de: 'Weichtiere',              en: 'Molluscs' },
};

export const ZUSATZSTOFFE = {
  1:  { de: 'mit Farbstoff',                en: 'with colouring' },
  2:  { de: 'mit Konservierungsstoff',      en: 'with preservative' },
  3:  { de: 'mit Antioxidationsmittel',     en: 'with antioxidant' },
  4:  { de: 'mit Geschmacksverstärker',     en: 'with flavour enhancer' },
  5:  { de: 'geschwefelt',                  en: 'sulphited' },
  6:  { de: 'geschwärzt',                   en: 'blackened' },
  7:  { de: 'gewachst',                     en: 'waxed' },
  8:  { de: 'mit Phosphat',                 en: 'with phosphate' },
  9:  { de: 'mit Süßungsmitteln',           en: 'with sweeteners' },
  10: { de: 'enthält eine Phenylalaninquelle', en: 'contains a source of phenylalanine' },
  11: { de: 'kann abführend wirken',        en: 'may have a laxative effect' },
  12: { de: 'koffeinhaltig',                en: 'contains caffeine' },
  13: { de: 'chininhaltig',                 en: 'contains quinine' },
  14: { de: 'mit Taurin',                   en: 'with taurine' },
};

/**
 * Freiwillige Kennzeichen. Bewusst **ohne** „glutenfrei" und „laktosefrei":
 * Das sind rechtlich geschützte Aussagen mit Grenzwerten (VO (EU) 828/2014),
 * die ein Küchenbetrieb ohne getrennte Zubereitung nicht halten kann. Wer sie
 * trotzdem setzt, verspricht mehr, als die Küche einlösen kann.
 */
export const MARKEN = {
  vegetarisch: { de: 'Vegetarisch',  en: 'Vegetarian',   zeichen: '🌿' },
  vegan:       { de: 'Vegan',        en: 'Vegan',        zeichen: '🌱' },
  scharf:      { de: 'Scharf',       en: 'Spicy',        zeichen: '🌶' },
  hausgemacht: { de: 'Hausgemacht',  en: 'House-made',   zeichen: '👐' },
  regional:    { de: 'Aus der Region', en: 'From the region', zeichen: '📍' },
};

/* ------------------------------------------------------------------ */
/* Listen lesen und schreiben                                          */
/* ------------------------------------------------------------------ */

/** „a, c ,g" → ['a','c','g'], nur bekannte Schlüssel, ohne Doppelte, sortiert. */
export function allergenListe(roh) {
  const gueltig = Object.keys(ALLERGENE);
  return [...new Set(String(roh || '').toLowerCase().split(',').map(s => s.trim()))]
    .filter(s => gueltig.includes(s))
    .sort((a, b) => gueltig.indexOf(a) - gueltig.indexOf(b));
}

/** „8,1" → [1,8], nur 1–14, ohne Doppelte, aufsteigend. */
export function zusatzListe(roh) {
  return [...new Set(String(roh || '').split(',').map(s => parseInt(s.trim(), 10)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 14)
    .sort((a, b) => a - b);
}

export function markenListe(roh) {
  const gueltig = Object.keys(MARKEN);
  return [...new Set(String(roh || '').toLowerCase().split(',').map(s => s.trim()))]
    .filter(s => gueltig.includes(s))
    .sort((a, b) => gueltig.indexOf(a) - gueltig.indexOf(b));
}

/** Für die Anzeige am Gericht: „A, C, G". */
export const allergenKurz = liste => liste.map(k => k.toUpperCase()).join(', ');

/** Für die Anzeige am Gericht: „1, 8". */
export const zusatzKurz = liste => liste.join(', ');

/**
 * Hat das Gericht überhaupt eine freigegebene Kennzeichnung?
 *
 * Das `kennz_ok` allein reicht nicht: Jemand kann freigeben und dabei alle
 * Häkchen weglassen, weil das Gericht wirklich keins trägt — das ist eine
 * gültige Aussage („geprüft, enthält nichts davon") und muss vom Fall
 * „noch niemand hat hingeschaut" unterscheidbar bleiben.
 */
export const istFreigegeben = i => !!(i && i.kennz_ok);
