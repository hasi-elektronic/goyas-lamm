/**
 * Monatszettel je Mitarbeiter — zum Ausdrucken und Unterschreiben.
 * Vorgeschrieben ist das nicht; eine gegengezeichnete Aufstellung ist bei einer
 * Prüfung aber das deutlich stärkere Papier als eine reine Bildschirmliste.
 */
import { esc, nowBerlin, WEEKDAY_DE, weekday } from '../_lib/core.js';
import {
  netto, runde, nettoGerundet, summe, hhmm, dezimal, monatLabel, istMonat, zuschlaege,
  euro, lohnCent, verteileTrinkgeld, RUNDUNG_MIN,
} from '../_lib/zeit.js';
import { HOUSE } from '../_lib/core.js';

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f1ea;color:#14120F;
  font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.bar{width:min(100% - 1.4rem,900px);margin:1rem auto 0;display:flex;gap:.5rem;flex-wrap:wrap}
.bar a,.bar button{font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;padding:.6rem 1rem;border:1px solid #d9d3c4;background:#fff;
  color:#14120F;cursor:pointer;border-radius:2px}
.bar button{background:#6D1826;border-color:#6D1826;color:#fff}
.bar .sp{flex:1}
.sheet{width:min(100% - 1.4rem,900px);margin:1.2rem auto 4rem;background:#fff;
  border:1px solid #d9d3c4;padding:1.6rem 1.5rem 2rem;
  /* Am Handy scrollt das Blatt in seinem eigenen Kasten statt die ganze Seite:
     acht Spalten passen auf kein Telefon, und der Zettel ist für A4 gemacht. */
  overflow-x:auto}
/* Briefkopf: Logo links, Anschrift rechts — das Blatt geht unterschrieben aus
   dem Haus, also soll man auf den ersten Blick sehen, von wem es kommt. */
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
table{width:100%;border-collapse:collapse;margin-top:1rem}
th{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:#6E675A;text-align:left;
  font-weight:700;padding:0 .4rem .35rem;border-bottom:1px solid #d9d3c4}
td{padding:.42rem .4rem;border-bottom:1px solid #eee9dc;font-variant-numeric:tabular-nums}
td.tag{white-space:nowrap;width:92px}
td.so{color:#6D1826;font-weight:700}
th.z,td.z{text-align:right}
th.hw,td.hw{padding-left:1rem;white-space:normal}
tr.leer td{color:#b6afa2}
tfoot td{border-top:2px solid #14120F;border-bottom:0;font-weight:700;padding-top:.6rem}
.zus{margin-top:1rem;display:flex;gap:.4rem 1.6rem;flex-wrap:wrap;font-size:.85rem;color:#6E675A}
.zus b{color:#14120F}
.unterschrift{margin-top:2.4rem;display:flex;gap:2.4rem;flex-wrap:wrap}
.unterschrift div{flex:1 1 240px}
.unterschrift .lin{border-bottom:1px solid #14120F;height:34px}
.unterschrift span{font-size:.72rem;color:#6E675A}
.fuss{margin-top:1.6rem;font-size:.7rem;color:#9b9285;line-height:1.6}
/* Laufende Fußzeile — nur im Druck. Am Bildschirm steht alles ohnehin untereinander. */
/* Das Blatt liegt in einer Tabelle, damit die Fußzeile im Druck auf jeder Seite
   wiederholt wird. Am Bildschirm soll man davon nichts merken. */
.blatt{width:100%;border-collapse:collapse}
.blatt > tbody > tr > td,.blatt > tfoot > tr > td{padding:0;border:0}
.laufzeile{display:none}
@media print{
  /* Unten mehr Rand: dort läuft die Fußzeile jeder Seite. */
  @page{size:A4 portrait;margin:12mm 12mm 24mm}
  body{background:#fff}
  .bar{display:none}
  .sheet{width:auto;margin:0;border:0;padding:0;overflow:visible}
  /* Nicht die ganze Polsterung wegnehmen: bei acht Spalten kleben sonst
     „Dezimal" und „Hinweis" aneinander („5,17korrigiert"). Aussen buendig,
     innen ein schmaler Abstand. */
  td,th{padding-left:0;padding-right:.55rem}
  td:last-child,th:last-child{padding-right:0}
  tr{break-inside:avoid}
  /* Kopfzeile der Tabelle auf jeder Seite wiederholen — sonst steht die zweite
     Seite ohne Spaltenbeschriftung da. */
  thead{display:table-header-group}
  tfoot{display:table-row-group}
  /* Ohne das lassen manche Browser Bilder und Flächen beim Drucken weg. */
  .brief{-webkit-print-color-adjust:exact;print-color-adjust:exact;
    padding-bottom:.7rem;margin-bottom:.9rem}
  .brief img{height:48px}

  /* Die laufende Fußzeile — auf jeder Seite.
     Nicht mit position:fixed: das wiederholt Chrome beim Drucken nicht mehr, die
     Zeile landet dann einmalig irgendwo mitten im Text. Auch display:table-footer-group
     auf einem div reicht nicht — Chrome druckt sie dann nur auf der letzten Seite.
     Zuverlässig ist allein echtes <tfoot> in einer echten <table>: genau das
     Verhalten, das hier schon die Spaltenüberschriften auf Seite zwei bringt. */
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

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();
  const monat = istMonat(url.searchParams.get('m')) ? url.searchParams.get('m') : now.date.slice(0, 7);
  const pid = String(url.searchParams.get('p') || '').slice(0, 40);

  let m = null, rows = [];
  try {
    try {
      m = await db.prepare(`SELECT id,name,role,wage_cent FROM staff WHERE id=?`).bind(pid).first();
    } catch {
      m = await db.prepare(`SELECT id,name,role FROM staff WHERE id=?`).bind(pid).first();
    }
    rows = (await db.prepare(
      `SELECT work_date,start_at,end_at,break_min,note,source,corrected FROM shifts
        WHERE staff_id=? AND work_date LIKE ? ORDER BY work_date, start_at`
    ).bind(pid, monat + '%').all()).results || [];
  } catch { /* Migration fehlt */ }

  /* Trinkgeldanteil des Monats — gerechnet wie auf der Trinkgeldseite. */
  let trinkgeldCent = 0;
  try {
    const toepfe = (await db.prepare(
      `SELECT day, amount_cent FROM tips WHERE day LIKE ?`).bind(monat + '%').all()).results || [];
    if (toepfe.length) {
      const alleSchichten = (await db.prepare(
        `SELECT staff_id, work_date, start_at, end_at, break_min FROM shifts WHERE work_date LIKE ?`)
        .bind(monat + '%').all()).results || [];
      const proTag = {};
      for (const x of alleSchichten) {
        const min = nettoGerundet(x);
        if (min === null) continue;
        (proTag[x.work_date] ||= {});
        proTag[x.work_date][x.staff_id] = (proTag[x.work_date][x.staff_id] || 0) + min;
      }
      for (const t of toepfe) {
        if (!t.amount_cent) continue;
        const leute = Object.entries(proTag[t.day] || {}).map(([id, minuten]) => ({ id, minuten }));
        trinkgeldCent += verteileTrinkgeld(t.amount_cent, leute)[pid] || 0;
      }
    }
  } catch { /* keine Trinkgeldtabelle */ }

  if (!m) {
    return new Response('<!DOCTYPE html><meta charset="utf-8"><p style="font-family:sans-serif;padding:2rem">'
      + 'Mitarbeiter nicht gefunden. <a href="/admin/arbeitszeit">Zurück</a></p>',
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const g = summe(rows);
  const zeilen = rows.map(s => {
    const n = netto(s);
    const so = weekday(s.work_date) === 0;
    return `<tr>
      <td class="tag ${so ? 'so' : ''}">${WEEKDAY_DE[weekday(s.work_date)].slice(0, 2)},
        ${s.work_date.slice(8)}.${s.work_date.slice(5, 7)}.</td>
      <td class="z">${esc(s.start_at)}</td>
      <td class="z">${esc(s.end_at || '—')}</td>
      <td class="z">${s.break_min ? esc(String(s.break_min)) + ' min' : '—'}</td>
      <td class="z">${n === null ? '—' : esc(hhmm(n))}</td>
      <td class="z">${n === null ? '—' : esc(hhmm(runde(n)))}</td>
      <td class="z">${n === null ? '—' : esc(dezimal(runde(n)))}</td>
      <td class="hw">${[
        s.source === 'admin' ? 'nachgetragen' : '',
        s.corrected ? 'korrigiert' : '',
        s.note ? esc(s.note) : '',
      ].filter(Boolean).join(' · ')}</td>
    </tr>`;
  }).join('');

  const erstellt = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arbeitszeit ${esc(m.name)} — ${esc(monatLabel(monat))}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>${CSS}</style></head><body>
<div class="bar">
  <a href="/admin/arbeitszeit?m=${esc(monat)}&p=${esc(m.id)}">&larr; Arbeitszeit</a>
  <span class="sp"></span>
  <button type="button" onclick="window.print()">Drucken</button>
</div>
<div class="sheet">
 <table class="blatt"><tfoot><tr><td>
   <!-- Wiederholt sich im Druck am Fuß **jeder** Seite. Echtes tfoot, weil
        Browser genau das zuverlässig wiederholen — siehe Kommentar im CSS. -->
   <div class="laufzeile" aria-hidden="true">
     <span><b>Arbeitszeitnachweis ${esc(m.name)}</b> · ${esc(monatLabel(monat))} ·
       Aufzeichnung nach § 17 MiLoG</span>
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
      <h1>${esc(m.name)}</h1>
      <p class="s">Arbeitszeitnachweis · ${esc(monatLabel(monat))}${m.role ? ' · ' + esc(m.role) : ''}</p>
    </div>
    <div class="r"><b>${dezimal(g.gerundet)}</b>Stunden gesamt</div>
  </div>

  ${rows.length ? `<table>
    <thead><tr>
      <th>Tag</th><th class="z">Beginn</th><th class="z">Ende</th><th class="z">Pause</th>
      <th class="z">Dauer</th><th class="z">gerundet</th><th class="z">Dezimal</th><th class="hw">Hinweis</th>
    </tr></thead>
    <tbody>${zeilen}</tbody>
    <tfoot><tr>
      <td>Summe</td><td class="z"></td><td class="z"></td>
      <td class="z">${esc(hhmm(g.pause))}</td>
      <td class="z">${esc(hhmm(g.arbeit))}</td>
      <td class="z">${esc(hhmm(g.gerundet))}</td>
      <td class="z">${dezimal(g.gerundet)}</td><td></td>
    </tr></tfoot>
  </table>
  <div class="zus">
    <span>Arbeitstage <b>${g.tage}</b></span>
    <span>Schichten <b>${g.anzahl}</b></span>
    <span>davon Sonntag <b>${dezimal(g.sonntag)} Std.</b></span>
    <span>davon 20–6 Uhr <b>${dezimal(g.nacht)} Std.</b></span>
    ${m.wage_cent ? `<span>Stundenlohn <b>${euro(m.wage_cent)} €</b></span>
      <span>Lohn brutto <b>${euro(lohnCent(g.gerundet, m.wage_cent))} €</b></span>` : ''}
    ${trinkgeldCent ? `<span>Trinkgeld <b>${euro(trinkgeldCent)} €</b></span>` : ''}
  </div>`
  : '<p style="padding:2.5rem 0;text-align:center;color:#6E675A">In diesem Monat wurden keine Zeiten erfasst.</p>'}

  <div class="unterschrift">
    <div><div class="lin"></div><span>Datum, Unterschrift Mitarbeiter</span></div>
    <div><div class="lin"></div><span>Datum, Unterschrift Arbeitgeber</span></div>
  </div>

  <p class="fuss">
    Aufzeichnung nach § 17 Mindestlohngesetz · ${esc(HOUSE.name)}, ${esc(HOUSE.addr)}<br>
    „davon Sonntag" und „davon 20–6 Uhr" beziehen sich auf die Anwesenheit ohne Pausenabzug und
    dienen als Anhaltspunkt für die Lohnabrechnung durch den Steuerberater.<br>
    Spalte „Dauer" ist die gestempelte Zeit, Spalte „gerundet" die auf ${RUNDUNG_MIN} Minuten
    kaufmännisch gerundete Abrechnungsgrundlage.${m.wage_cent
      ? ' Der Lohnbetrag ist brutto und ohne Zuschläge, Steuern und Sozialabgaben gerechnet — keine Abrechnung.'
      : ''}${trinkgeldCent
      ? ' Das Trinkgeld stammt aus dem Haus-Topf und ist steuerlich gesondert zu beurteilen.'
      : ''}<br>
    Erstellt am ${esc(erstellt)} ·
    enthält personenbezogene Daten, nur für den internen Gebrauch.
  </p>
 </td></tr></tbody></table>
</div>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
