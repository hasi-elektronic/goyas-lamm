/**
 * Wareneingangs-Kontrollblatt — zum Ausdrucken für die Lebensmittelüberwachung.
 *
 * Das ist der Grund, warum sich der ganze Aufwand lohnt: Wenn der Kontrolleur
 * in der Tür steht, will er die Wareneingangskontrolle sehen — und zwar
 * lückenlos, mit Datum, Lieferant, Temperatur, Beanstandung und ergriffener
 * Maßnahme. Eine Bildschirmliste hilft da wenig; ein sauberes A4-Blatt schon.
 *
 * Aufbau übernommen vom Monatsnachweis (`zeitzettel.js`): Briefkopf mit Logo,
 * Spaltenkopf und Fußzeile wiederholen sich auf jeder gedruckten Seite. Die
 * Kommentare dort erklären, warum das nur mit einem echten `<tfoot>` in einer
 * echten `<table>` zuverlässig funktioniert — `position:fixed` wiederholt
 * Chrome nicht mehr, und `table-footer-group` auf einem `div` landet nur auf
 * der letzten Seite.
 */
import { esc, nowBerlin, HOUSE, WEEKDAY_DE, weekday } from '../_lib/core.js';
import { monatLabel, istMonat } from '../_lib/zeit.js';
import { MASSNAHMEN, tempKlassen, grad, euro, positionCent } from '../_lib/ware.js';

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f1ea;color:#14120F;
  font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.bar{width:min(100% - 1.4rem,980px);margin:1rem auto 0;display:flex;gap:.5rem;flex-wrap:wrap}
.bar a,.bar button{font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;padding:.6rem 1rem;border:1px solid #d9d3c4;background:#fff;
  color:#14120F;cursor:pointer;border-radius:2px}
.bar button{background:#6D1826;border-color:#6D1826;color:#fff}
.bar .sp{flex:1}
.sheet{width:min(100% - 1.4rem,980px);margin:1.2rem auto 4rem;background:#fff;
  border:1px solid #d9d3c4;padding:1.6rem 1.5rem 2rem;overflow-x:auto}
.brief{display:flex;justify-content:space-between;align-items:flex-start;gap:1.4rem;
  padding-bottom:1rem;margin-bottom:1.1rem;border-bottom:1px solid #d9d3c4}
.brief img{height:58px;width:auto;display:block}
.brief .adr{text-align:right;font-size:.7rem;line-height:1.65;color:#6E675A}
.brief .adr b{display:block;color:#14120F;font-size:.76rem;letter-spacing:.1em;
  text-transform:uppercase;margin-bottom:.15rem}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;
  border-bottom:2px solid #14120F;padding-bottom:.7rem;margin-bottom:.4rem}
.head h1{font-size:1.35rem;margin:0}
.head .s{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:#6E675A;margin:.25rem 0 0}
.head .r{text-align:right;font-size:.78rem;color:#6E675A}
.head .r b{display:block;font-size:1.7rem;color:#14120F;letter-spacing:-.02em;line-height:1.15}
table.liste{width:100%;border-collapse:collapse;margin-top:1rem}
table.liste th{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:#6E675A;
  text-align:left;font-weight:700;padding:0 .4rem .35rem;border-bottom:1px solid #d9d3c4}
table.liste td{padding:.42rem .4rem;border-bottom:1px solid #eee9dc;vertical-align:top}
td.tag{white-space:nowrap;width:78px;font-variant-numeric:tabular-nums}
td.z,th.z{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.warm{color:#6D1826;font-weight:700}
td.bem{font-size:.86rem}
tr.abw td{background:#faf3f4}
/* Die beiden Häkchenspalten mittig: rechtsbündig stünden ✓ und ✗ in einer
   schmalen Spalte am äußersten Rand und ließen sich schlechter zuordnen. */
th.pruef,td.pruef{text-align:center;font-size:.8rem;letter-spacing:.06em;width:58px}
.zus{margin-top:1rem;display:flex;gap:.4rem 1.6rem;flex-wrap:wrap;font-size:.85rem;color:#6E675A}
.zus b{color:#14120F}
.unterschrift{margin-top:2.4rem;display:flex;gap:2.4rem;flex-wrap:wrap}
.unterschrift div{flex:1 1 240px}
.unterschrift .lin{border-bottom:1px solid #14120F;height:34px}
.unterschrift span{font-size:.72rem;color:#6E675A}
.fuss{margin-top:1.6rem;font-size:.7rem;color:#9b9285;line-height:1.6}
.blatt{width:100%;border-collapse:collapse}
.blatt > tbody > tr > td,.blatt > tfoot > tr > td{padding:0;border:0}
.laufzeile{display:none}
@media print{
  @page{size:A4 landscape;margin:10mm 10mm 22mm}
  body{background:#fff}
  .bar{display:none}
  .sheet{width:auto;margin:0;border:0;padding:0;overflow:visible}
  table.liste td,table.liste th{padding-left:0;padding-right:.55rem}
  table.liste td:last-child,table.liste th:last-child{padding-right:0}
  tr{break-inside:avoid}
  table.liste thead{display:table-header-group}
  .brief{-webkit-print-color-adjust:exact;print-color-adjust:exact;
    padding-bottom:.7rem;margin-bottom:.9rem}
  .brief img{height:46px}
  tr.abw td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .blatt > tfoot{display:table-footer-group}
  .laufzeile{display:flex;gap:1rem;justify-content:space-between;align-items:baseline;
    border-top:1px solid #d9d3c4;margin-top:4mm;padding-top:1.5mm;
    font-size:.6rem;line-height:1.5;color:#9b9285;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .laufzeile b{color:#14120F;font-weight:700}
  .laufzeile .re{text-align:right;white-space:nowrap}
  .unterschrift,.fuss{break-inside:avoid}
  .unterschrift{margin-top:1.6rem}
}`;

const haken = v => v ? '✓' : '✗';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const monat = istMonat(url.searchParams.get('m'))
    ? url.searchParams.get('m') : nowBerlin().date.slice(0, 7);

  let lieferungen = [], posten = [], lieferanten = [], grenzen = null;
  try {
    lieferungen = (await db.prepare(
      `SELECT * FROM deliveries WHERE day LIKE ? ORDER BY day, created_at`)
      .bind(monat + '%').all()).results || [];
    posten = (await db.prepare(
      `SELECT i.delivery_id, i.menge_milli, i.ep_cent FROM delivery_items i
         JOIN deliveries d ON d.id = i.delivery_id WHERE d.day LIKE ?`)
      .bind(monat + '%').all()).results || [];
    lieferanten = (await db.prepare(`SELECT id, name FROM suppliers`).all()).results || [];
    const s = await db.prepare(`SELECT v FROM settings WHERE k='ware_temp'`).first();
    grenzen = tempKlassen(s?.v);
  } catch { grenzen = tempKlassen(null); }

  const liefName = Object.fromEntries(lieferanten.map(l => [l.id, l.name]));
  const wert = {};
  for (const p of posten) {
    wert[p.delivery_id] = (wert[p.delivery_id] || 0) + positionCent(p.menge_milli, p.ep_cent);
  }

  const abweichung = l => l.temp_ok === 0 || !l.mhd_ok || !l.ware_ok
    || (l.massnahme && l.massnahme !== 'angenommen');

  const zeilen = lieferungen.map(l => {
    const g = l.temp_klasse ? grenzen[l.temp_klasse] : null;
    return `<tr class="${abweichung(l) ? 'abw' : ''}">
      <td class="tag">${WEEKDAY_DE[weekday(l.day)].slice(0, 2)},
        ${l.day.slice(8)}.${l.day.slice(5, 7)}.</td>
      <td>${esc(liefName[l.supplier_id] || '—')}
        ${l.liefernr ? `<div style="font-size:.76rem;color:#6E675A">Nr. ${esc(l.liefernr)}</div>` : ''}</td>
      <td>${g ? esc(g.label) : '<span style="color:#9b9285">ungekühlt</span>'}</td>
      <td class="z">${g ? esc(grad(g.max)) : '—'}</td>
      <td class="z ${l.temp_ok === 0 ? 'warm' : ''}">${
        l.temp_zehntel === null || l.temp_zehntel === undefined ? '—' : esc(grad(l.temp_zehntel))}</td>
      <td class="pruef">${haken(l.mhd_ok)}</td>
      <td class="pruef">${haken(l.ware_ok)}</td>
      <td>${esc(MASSNAHMEN[l.massnahme] || 'angenommen')}</td>
      <td class="bem">${esc(l.note || '')}${l.corrected
        ? '<div style="font-size:.72rem;color:#9b9285">nachträglich korrigiert</div>' : ''}</td>
      <td class="z">${wert[l.id] ? esc(euro(wert[l.id])) + ' €' : '—'}</td>
      <td>${esc(l.erfasst_von || '')}</td>
    </tr>`;
  }).join('');

  const auffaellig = lieferungen.filter(abweichung);
  const gesamt = Object.values(wert).reduce((a, b) => a + b, 0);
  const erstellt = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wareneingangskontrolle — ${esc(monatLabel(monat))}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>${CSS}</style></head><body>
<div class="bar">
  <a href="/admin/ware?m=${esc(monat)}">&larr; Wareneingang</a>
  <span class="sp"></span>
  <button type="button" onclick="window.print()">Drucken</button>
</div>
<div class="sheet">
 <table class="blatt"><tfoot><tr><td>
   <div class="laufzeile" aria-hidden="true">
     <span><b>Wareneingangskontrolle</b> · ${esc(monatLabel(monat))} ·
       Eigenkontrolle nach VO (EG) 852/2004</span>
     <span class="re"><b>${esc(HOUSE.name)}</b> · erstellt am ${esc(erstellt)}</span>
   </div>
 </td></tr></tfoot><tbody><tr><td>
  <div class="brief">
    <img src="/assets/logo-dark.png" alt="${esc(HOUSE.name)}">
    <div class="adr">
      <b>${esc(HOUSE.name)}</b>
      ${esc(HOUSE.addr)}<br>
      ${esc(HOUSE.phone)} · ${esc(HOUSE.mail)}
    </div>
  </div>
  <div class="head">
    <div>
      <h1>Wareneingangskontrolle</h1>
      <p class="s">${esc(monatLabel(monat))} · Betriebliche Eigenkontrolle nach HACCP-Grundsätzen</p>
    </div>
    <div class="r"><b>${lieferungen.length}</b>Lieferungen</div>
  </div>

  ${lieferungen.length ? `<table class="liste">
    <thead><tr>
      <th>Tag</th><th>Lieferant</th><th>Warengruppe</th><th class="z">Grenzwert</th>
      <th class="z">gemessen</th><th class="pruef">MHD</th><th class="pruef">Zustand</th>
      <th>Maßnahme</th><th>Bemerkung</th><th class="z">Wert</th><th>Angenommen von</th>
    </tr></thead>
    <tbody>${zeilen}</tbody>
  </table>
  <div class="zus">
    <span>Lieferungen <b>${lieferungen.length}</b></span>
    <span>mit Beanstandung <b>${auffaellig.length}</b></span>
    <span>Temperatur gemessen <b>${lieferungen.filter(l => l.temp_zehntel !== null && l.temp_zehntel !== undefined).length}×</b></span>
    <span>Beleg hinterlegt <b>${lieferungen.filter(l => l.beleg_key).length}×</b></span>
    ${gesamt ? `<span>erfasster Warenwert <b>${esc(euro(gesamt))} €</b></span>` : ''}
  </div>`
  : '<p style="padding:2.5rem 0;text-align:center;color:#6E675A">In diesem Monat wurde keine Lieferung erfasst.</p>'}

  <div class="unterschrift">
    <div><div class="lin"></div><span>Datum, Unterschrift verantwortliche Person</span></div>
    <div><div class="lin"></div><span>Bemerkungen der Kontrolle</span></div>
  </div>

  <div class="fuss">
    <b>MHD</b> = Mindesthaltbarkeits- bzw. Verbrauchsdatum geprüft ·
    <b>Zustand</b> = Verpackung, Aussehen und Geruch ohne Beanstandung ·
    ✓ geprüft und in Ordnung, ✗ beanstandet.
    Grenzwerte nach VO (EG) 853/2004 bzw. Tiefkühlverordnung; im System hinterlegt und
    betrieblich festgelegt.<br>
    Gemessen wird die Kerntemperatur der Ware, nicht die Lufttemperatur des Fahrzeugs —
    Einstichthermometer bei Frischware, Infrarot bei Tiefkühlware.
    Beanstandete Lieferungen sind hinterlegt hervorgehoben; die ergriffene Maßnahme steht
    in der Zeile.<br>
    Rückverfolgbarkeit nach Art. 18 VO (EG) 178/2002: Lieferant, Tag und Artikel sind je
    Lieferung im System hinterlegt, Chargen- und Mindesthaltbarkeitsangaben bei den
    Positionen.<br>
    Diese Aufstellung ist eine Hygienedokumentation und keine Buchführung. Die
    Originalbelege liegen im Betrieb bzw. beim Steuerberater.
  </div>
 </td></tr></tbody></table>
</div>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
