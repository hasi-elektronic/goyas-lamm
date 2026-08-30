/**
 * Rechnungen — rechnen, prüfen, benennen.
 *
 * Kein Datenbankzugriff, keine Ausgabe. Eine Rechnung, die sich um zwei Cent
 * verrechnet, ist ein Ärgernis mit Rechtsfolgen — das hier muss sich ohne
 * Browser nachrechnen lassen.
 *
 * ── Steuersätze in der Gastronomie ────────────────────────────────────
 * Seit dem **1. Januar 2026** gilt für Speisen in der Gastronomie der
 * ermäßigte Satz von **7 %** (Steueränderungsgesetz 2025). **Getränke bleiben
 * bei 19 %** — das ist die Stelle, an der die meisten Fehler passieren, weil
 * eine Feier beides enthält und gern in einer Summe abgerechnet wird.
 *
 * Deshalb hat jede Position ihren eigenen Satz, und die Rechnung weist die
 * Beträge nach Sätzen getrennt aus. § 14 Abs. 4 Nr. 8 UStG verlangt genau das.
 *
 * ── Runden ────────────────────────────────────────────────────────────
 * Gerechnet wird in Cent, gerundet wird **je Steuersatz auf die Summe**, nicht
 * je Position. Sonst summieren sich bis zu einem halben Cent pro Zeile zu einem
 * Betrag, der nicht zur ausgewiesenen Steuer passt.
 */

/** Zulässige Steuersätze, mit dem Grund dahinter. */
export const SAETZE = [
  { wert: 7,  label: '7 % — Speisen',
    hilfe: 'Seit 1.1.2026 gilt für Speisen in der Gastronomie der ermäßigte Satz.' },
  { wert: 19, label: '19 % — Getränke',
    hilfe: 'Getränke sind von der Senkung ausgenommen und bleiben bei 19 %.' },
  { wert: 0,  label: '0 % — ohne Steuer',
    hilfe: 'Nur für durchlaufende Posten oder wenn der Steuerberater es so vorgibt.' },
];

export const istSatz = n => SAETZE.some(s => s.wert === Number(n));

export const STATUS = {
  entwurf:   { label: 'Entwurf',   pill: '' },
  gestellt:  { label: 'Gestellt',  pill: 'tel' },
  bezahlt:   { label: 'Bezahlt',   pill: 'web' },
  storniert: { label: 'Storniert', pill: 'walk' },
};

/* ------------------------------------------------------------------ */
/* Geld                                                                */
/* ------------------------------------------------------------------ */

export const euro = cent =>
  (Math.round(cent || 0) / 100).toFixed(2).replace('.', ',');

/** „12,50" → 1250. Punkt und Komma gelten beide als Dezimaltrenner. */
export function centAus(text) {
  const s = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s || !/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** „2,5" → 2500 Tausendstel. */
export function mengeAus(text) {
  const s = String(text ?? '').trim().replace(',', '.');
  if (!s) return 1000;
  if (!/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

/** 2500 → „2,5"; ganze Zahlen ohne Nachkomma. */
export const menge = milli => {
  const v = (Math.round(milli || 0) / 1000);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace('.', ',');
};

/** Netto einer Position in Cent — ungerundet wäre hier falsch, es ist Geld. */
export const positionCent = (menge_milli, ep_cent) =>
  Math.round((menge_milli || 0) * (ep_cent || 0) / 1000);

/**
 * Rechnung durchrechnen.
 *
 * @param {Array} posten Zeilen aus `invoice_items`
 * @returns {{netto:number, steuer:number, brutto:number,
 *            nachSatz:Array<{satz:number, netto:number, steuer:number}>}}
 */
export function rechne(posten) {
  const proSatz = new Map();
  for (const p of posten || []) {
    const satz = istSatz(p.steuer) ? Number(p.steuer) : 19;
    proSatz.set(satz, (proSatz.get(satz) || 0) + positionCent(p.menge_milli, p.ep_cent));
  }
  const nachSatz = [...proSatz.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([satz, netto]) => ({ satz, netto, steuer: Math.round(netto * satz / 100) }));

  const netto  = nachSatz.reduce((s, z) => s + z.netto, 0);
  const steuer = nachSatz.reduce((s, z) => s + z.steuer, 0);
  return { netto, steuer, brutto: netto + steuer, nachSatz };
}

/* ------------------------------------------------------------------ */
/* Nummern                                                             */
/* ------------------------------------------------------------------ */

/** „2026-0007" — Jahr voran, damit der Zähler jedes Jahr neu beginnen darf. */
export const nummerBauen = (jahr, n) => `${jahr}-${String(n).padStart(4, '0')}`;

/* ------------------------------------------------------------------ */
/* Prüfen                                                              */
/* ------------------------------------------------------------------ */

/**
 * Was § 14 UStG verlangt und hier fehlt.
 * Wird vor dem Ausstellen geprüft — danach ist die Rechnung unveränderlich,
 * ein fehlendes Pflichtfeld also nicht mehr zu heilen.
 *
 * @returns {string[]} leere Liste = alles da
 */
export function fehlendes(rg, posten) {
  const weg = [];
  if (!String(rg.empfaenger || '').trim()) weg.push('Name des Empfängers');
  if (!String(rg.adresse || '').trim()) weg.push('Anschrift des Empfängers');
  if (!rg.leistung_von) weg.push('Zeitpunkt der Leistung');
  if (!(posten || []).length) weg.push('mindestens eine Position');
  for (const p of posten || []) {
    if (!String(p.text || '').trim()) { weg.push('Beschreibung in jeder Position'); break; }
  }
  const { brutto } = rechne(posten);
  if (brutto <= 0) weg.push('ein Betrag über null');
  return weg;
}

/**
 * Zahlungsziel: 14 Tage ist im Gastgewerbe üblich und ohne Vereinbarung
 * unstrittig. Ohne Frist tritt Verzug erst 30 Tage nach Zugang ein (§ 286
 * Abs. 3 BGB) — das ist lange, wenn man auf das Geld wartet.
 */
export const ZAHLUNGSZIEL_TAGE = 14;
