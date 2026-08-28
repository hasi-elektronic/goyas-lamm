/**
 * Hygiene-Kontrollblatt — ein Monat auf einem Blatt, für den Ordner.
 *
 * ── Warum eine Matrix und keine Liste ─────────────────────────────────
 * Das Wareneingangs-Kontrollblatt ist eine chronologische Liste, weil dort
 * jede Zeile ein Ereignis ist. Hier ist die entscheidende Frage eine andere:
 * **Wurde jeden Tag gemessen?** Eine Lücke sieht man in einer Liste nicht, in
 * einem Raster aus Geräten und Tagen sofort — und genau danach schaut der
 * Kontrolleur. Deshalb Zeilen für die Prüfpunkte, Spalten für die Tage und
 * leere Felder, wo nichts eingetragen wurde.
 *
 * Quer gedruckt: einunddreißig Spalten passen im Hochformat nicht lesbar auf
 * A4. Die Abweichungen stehen darunter im Klartext, mit der Maßnahme — das
 * ist der Teil, den ein Prüfer wirklich liest.
 */
import { esc, HOUSE, nowBerlin } from '../_lib/core.js';
import { monatLabel, istMonat } from '../_lib/zeit.js';
import { grad } from '../_lib/ware.js';

const ARTLABEL = {
  kuehl: 'Kühlung', tk: 'Tiefkühlung', heiss: 'Heißhaltung',
  fett: 'Frittierfett', reinigung: 'Reinigung',
};

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f1ea;color:#14120F;
  font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.bar{width:min(100% - 1.4rem,1240px);margin:1rem auto 0;display:flex;gap:.5rem;flex-wrap:wrap}
.bar a,.bar button{font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;padding:.6rem 1rem;border:1px solid #d9d3c4;background:#fff;
  color:#14120F;cursor:pointer;border-radius:2px}
.bar button{background:#6D1826;border-color:#6D1826;color:#fff}
.bar .sp{flex:1}
.sheet{width:min(100% - 1.4rem,1240px);margin:1.2rem auto 4rem;background:#fff;
  border:1px solid #d9d3c4;padding:1.5rem 1.4rem 2rem;overflow-x:auto}
.brief{display:flex;justify-content:space-between;align-items:flex-start;gap:1.4rem;
  padding-bottom:.9rem;margin-bottom:1rem;border-bottom:1px solid #d9d3c4}
.brief img{height:52px;width:auto;display:block}
.brief .adr{text-align:right;font-size:.68rem;line-height:1.6;color:#6E675A}
.brief .adr b{display:block;color:#14120F;font-size:.74rem;letter-spacing:.1em;
  text-transform:uppercase;margin-bottom:.15rem}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;
  border-bottom:2px solid #14120F;padding-bottom:.6rem;margin-bottom:.9rem}
.head h1{font-size:1.3rem;margin:0}
.head .s{margin:.2rem 0 0;font-size:.8rem;color:#6E675A}
.head .r{text-align:right;font-size:.7rem;color:#6E675A;letter-spacing:.1em;text-transform:uppercase}
.head .r b{display:block;font-size:1.5rem;color:#14120F;letter-spacing:0;text-transform:none}
table.matrix{width:100%;border-collapse:collapse;font-size:.66rem;table-layout:fixed}
table.matrix th,table.matrix td{border:1px solid #d9d3c4;padding:.22rem .1rem;text-align:center;
  font-variant-numeric:tabular-nums}
table.matrix th.p{width:150px;text-align:left;padding-left:.4rem;font-size:.72rem}
table.matrix td.p{text-align:left;padding-left:.4rem;font-size:.72rem;line-height:1.25}
table.matrix td.p span{display:block;color:#6E675A;font-size:.62rem}
table.matrix thead th{background:#f2f1ea;font-weight:700}
table.matrix thead th.we{color:#6D1826}
table.matrix td.leer{background:repeating-linear-gradient(135deg,transparent 0 4px,rgba(0,0,0,.05) 4px 8px)}
table.matrix td.rot{background:#f7e9ec;color:#6D1826;font-weight:700}
table.matrix tr.trenn td,table.matrix tr.trenn th{border-top:2px solid #14120F}
.abw{margin-top:1.2rem}
.abw h2{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;margin:0 0 .5rem;color:#6D1826}
table.liste{width:100%;border-collapse:collapse;font-size:.78rem}
table.liste th,table.liste td{border-bottom:1px solid #e6e0d2;padding:.4rem .5rem;text-align:left;
  vertical-align:top}
table.liste th{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:#6E675A}
.zus{display:flex;gap:1.6rem;flex-wrap:wrap;margin-top:1rem;font-size:.76rem;color:#6E675A;
  border-top:1px solid #d9d3c4;padding-top:.7rem}
.zus b{color:#14120F;font-size:1rem}
.legende{margin-top:.7rem;font-size:.68rem;color:#6E675A;line-height:1.6}
.unterschrift{display:flex;gap:2.4rem;margin-top:2.4rem}
.unterschrift div{flex:1}
.unterschrift .lin{border-bottom:1px solid #14120F;height:2.2rem}
.unterschrift span{font-size:.66rem;color:#6E675A}
.laufzeile{display:flex;justify-content:space-between;font-size:.62rem;color:#6E675A;
  border-top:1px solid #d9d3c4;padding-top:.35rem;margin-top:.7rem}
@media print{
  @page{size:A4 landscape;margin:11mm}
  body{background:#fff}
  .bar{display:none}
  .sheet{width:auto;margin:0;border:0;padding:0;overflow:visible}
  table.blatt{width:100%}
  table.blatt tfoot{display:table-footer-group}
}
`;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();
  const monat = istMonat(url.searchParams.get('m')) ? url.searchParams.get('m') : now.date.slice(0, 7);
  const [jahr, mon] = monat.split('-').map(Number);
  const tageImMonat = new Date(Date.UTC(jahr, mon, 0)).getUTCDate();
  const tage = Array.from({ length: tageImMonat }, (_, i) =>
    `${monat}-${String(i + 1).padStart(2, '0')}`);
  const wochenende = t => {
    const w = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8))).getUTCDay();
    return w === 0 || w === 6;
  };

  let punkte = [], log = [];
  try {
    punkte = (await db.prepare(
      `SELECT id,art,name,min_zehntel,max_zehntel,takt,active FROM hygiene_punkte
        ORDER BY sort, name`).all()).results || [];
    log = (await db.prepare(
      `SELECT punkt_id,tag,temp_zehntel,ok,massnahme,wer FROM hygiene_log
        WHERE tag BETWEEN ? AND ? ORDER BY tag`).bind(tage[0], tage[tageImMonat - 1]).all()).results || [];
  } catch { /* Migration fehlt — dann bleibt das Blatt leer */ }

  const nachName = Object.fromEntries(punkte.map(p => [p.id, p.name]));
  const zelle = {};
  for (const e of log) zelle[`${e.punkt_id}|${e.tag}`] = e;

  /* Ausgemusterte Prüfpunkte bleiben im Blatt, solange sie in diesem Monat
     noch Werte haben — sonst fehlten rückwirkend Zeilen. */
  const sichtbar = punkte.filter(p => p.active || log.some(e => e.punkt_id === p.id));
  const grenze = p => {
    const hatMax = p.max_zehntel !== null && p.max_zehntel !== undefined;
    const hatMin = p.min_zehntel !== null && p.min_zehntel !== undefined;
    if (hatMax && hatMin) return `${grad(p.min_zehntel)}…${grad(p.max_zehntel)}`;
    if (hatMax) return `≤ ${grad(p.max_zehntel)}`;
    if (hatMin) return `≥ ${grad(p.min_zehntel)}`;
    return 'erledigt / nicht erledigt';
  };

  let letzteArt = null;
  const zeilen = sichtbar.map(p => {
    const trenn = letzteArt !== null && letzteArt !== p.art;
    letzteArt = p.art;
    return `<tr${trenn ? ' class="trenn"' : ''}>
      <td class="p">${esc(p.name)}<span>${esc(ARTLABEL[p.art] || p.art)} · ${esc(grenze(p))}${
        p.takt === 'woechentlich' ? ' · wöchentlich' : ''}${p.active ? '' : ' · ausgemustert'}</span></td>
      ${tage.map(t => {
        const e = zelle[`${p.id}|${t}`];
        if (!e) return `<td class="leer"></td>`;
        const inhalt = (e.temp_zehntel !== null && e.temp_zehntel !== undefined)
          ? esc(String(grad(e.temp_zehntel)).replace(' °C', ''))
          : (e.ok ? '✓' : '✗');
        return `<td class="${e.ok ? '' : 'rot'}">${inhalt}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  const abweichungen = log.filter(e => !e.ok);
  const gemessen = log.length;
  /* Im laufenden Monat zählen nur die Tage, die schon vergangen sind — sonst
     stünde am 3. August „10 % erfasst", obwohl nichts fehlt. */
  const bisTag = monat === now.date.slice(0, 7) ? +now.date.slice(8) : tageImMonat;
  const soll = sichtbar.filter(p => p.active && p.takt === 'taeglich').length * bisTag;
  const erstellt = `${now.date.slice(8)}.${now.date.slice(5, 7)}.${now.date.slice(0, 4)}`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hygiene-Kontrollblatt ${esc(monatLabel(monat))} — ${esc(HOUSE.name)}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>${CSS}</style></head><body>
<div class="bar">
  <a href="/admin/hygiene">&larr; Hygiene-Kontrolle</a>
  <a href="/admin/hygieneblatt?m=${esc(vormonat(monat))}">&larr; Vormonat</a>
  <span class="sp"></span>
  <button type="button" onclick="window.print()">Drucken</button>
</div>
<div class="sheet">
 <table class="blatt"><tfoot><tr><td>
   <div class="laufzeile" aria-hidden="true">
     <span><b>Hygiene-Kontrollblatt</b> · ${esc(monatLabel(monat))} ·
       Eigenkontrolle nach Art. 5 VO (EG) 852/2004</span>
     <span><b>${esc(HOUSE.name)}</b> · erstellt am ${esc(erstellt)}</span>
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
      <h1>Hygiene-Kontrollblatt</h1>
      <p class="s">${esc(monatLabel(monat))} · Temperaturen, Frittierfett und Reinigung ·
         betriebliche Eigenkontrolle nach HACCP-Grundsätzen</p>
    </div>
    <div class="r"><b>${gemessen}</b>Einträge</div>
  </div>

  ${sichtbar.length ? `<table class="matrix">
    <thead><tr>
      <th class="p">Prüfpunkt</th>
      ${tage.map(t => `<th class="${wochenende(t) ? 'we' : ''}">${+t.slice(8)}</th>`).join('')}
    </tr></thead>
    <tbody>${zeilen}</tbody>
  </table>
  <div class="legende">
    Zahlen = gemessene Temperatur in °C · ✓ = erledigt · ✗ = Abweichung ·
    schraffiert = kein Eintrag · rot hinterlegt = außerhalb des Rahmens.
    Wöchentliche Punkte tragen den Wert an dem Tag, an dem sie ausgeführt wurden.
  </div>
  <div class="zus">
    <span>Einträge <b>${gemessen}</b></span>
    <span>Abweichungen <b>${abweichungen.length}</b></span>
    ${soll ? `<span>tägliche Punkte erfasst${monat === now.date.slice(0, 7) ? ' (bis heute)' : ''} <b>${
      Math.round(log.filter(e => {
        const p = punkte.find(x => x.id === e.punkt_id);
        return p && p.takt === 'taeglich';
      }).length / soll * 100)} %</b></span>` : ''}
  </div>`
  : '<p style="padding:2.5rem 0;text-align:center;color:#6E675A">Es sind keine Prüfpunkte angelegt.</p>'}

  ${abweichungen.length ? `<div class="abw">
    <h2>Abweichungen und ergriffene Maßnahmen</h2>
    <table class="liste">
      <thead><tr><th>Tag</th><th>Prüfpunkt</th><th>Wert</th><th>Maßnahme</th><th>Erfasst von</th></tr></thead>
      <tbody>${abweichungen.map(e => `<tr>
        <td>${esc(e.tag.slice(8))}.${esc(e.tag.slice(5, 7))}.</td>
        <td>${esc(nachName[e.punkt_id] || e.punkt_id)}</td>
        <td>${e.temp_zehntel !== null && e.temp_zehntel !== undefined
          ? esc(grad(e.temp_zehntel)) : 'nicht erledigt'}</td>
        <td>${esc(e.massnahme || '—')}</td>
        <td>${esc(e.wer || '—')}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>` : ''}

  <div class="unterschrift">
    <div><div class="lin"></div><span>Datum, Unterschrift verantwortliche Person</span></div>
    <div><div class="lin"></div><span>Bemerkungen der Kontrolle</span></div>
  </div>
 </td></tr></tbody></table>
</div>
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function vormonat(m) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}
