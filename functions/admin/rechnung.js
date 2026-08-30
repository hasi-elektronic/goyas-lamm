/**
 * Rechnungen für Feiern und Firmenessen.
 *
 * ── Was das ist ───────────────────────────────────────────────────────
 * Der Teil des Umsatzes, der **nicht über die Kasse** läuft: Geburtstagsfeier,
 * Firmenessen, Trauerkaffee. Der Kunde zahlt per Überweisung und braucht dafür
 * ein Papier, das den Anforderungen des § 14 UStG genügt.
 *
 * ── Was das ausdrücklich NICHT ist ────────────────────────────────────
 * **Kein Bewirtungsbeleg.** Wer Bewirtungskosten absetzen will, braucht seit
 * 2020 einen Beleg aus einem elektronischen Aufzeichnungssystem mit
 * zertifizierter technischer Sicherheitseinrichtung (§ 4 Abs. 5 Satz 1 Nr. 2
 * EStG, BMF-Schreiben vom 30.06.2021). Das ist die Kasse im Haus, nicht dieses
 * Panel. Der Hinweis steht sichtbar auf der Seite — wer ihn wegnimmt, sorgt
 * dafür, dass ein Gast beim Finanzamt auf die Nase fällt.
 *
 * **Keine Buchhaltung.** Dieselbe Grenze wie beim Wareneingang und bei der
 * Arbeitszeit. Die Rechnungen gehen an den Steuerberater wie bisher; hier
 * entstehen sie nur.
 *
 * ── Drei Regeln, die den Aufbau erklären ──────────────────────────────
 * 1. **Die Nummer wird erst beim Ausstellen vergeben.** Ein verworfener
 *    Entwurf soll keine Lücke in der Nummernfolge reißen (§ 14 Abs. 4 Nr. 4
 *    UStG). Solange „Entwurf" draufsteht, hat die Rechnung keine Nummer.
 * 2. **Gestellt ist unveränderlich.** Danach lässt sich nichts mehr ändern —
 *    korrigiert wird über eine Stornorechnung mit eigener Nummer, die auf das
 *    Original verweist. Alles andere wäre eine Änderung ohne Spur (GoBD).
 * 3. **Jede Position hat ihren eigenen Steuersatz.** Speisen 7 %, Getränke
 *    19 % — seit 1.1.2026. Eine Feier enthält beides, und in einer Summe
 *    abgerechnet wird sie falsch.
 */
import { clean, esc, nowBerlin, formatDateDE, addDays, isValidDate } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { tagKurz } from '../_lib/zeit.js';
import {
  SAETZE, istSatz, STATUS, euro, centAus, mengeAus, menge, positionCent,
  rechne, nummerBauen, fehlendes, ZAHLUNGSZIEL_TAGE,
} from '../_lib/rechnung.js';

const MIGRATION = 'Die Tabellen für Rechnungen fehlen noch — '
  + 'bitte Migration 0026_rechnungen.sql einspielen.';

/** Wie viele leere Positionszeilen das Formular anbietet. */
const ZEILEN = 5;

/**
 * Der Absender. Steht so im Impressum — wer das ändert, muss beides ändern.
 * Die USt-IdNr ist Pflichtangabe nach § 14 Abs. 4 Nr. 2 UStG.
 */
const HAUS = {
  name: 'Goya´s Lamm',
  inhaber: 'Inhaber: Gökhan Yavuz',
  strasse: 'Klosterbergstraße 45',
  ort: '71665 Vaihingen an der Enz — Horrheim',
  telefon: '07042 83 22 82',
  mail: 'hallo@lammm.de',
  ustid: 'DE325957584',
};

async function einstellung(db, k) {
  try {
    const r = await db.prepare(`SELECT v FROM settings WHERE k=?`).bind(k).first();
    return r?.v ?? '';
  } catch { return ''; }
}

/* ================================================================== */
/* Stil                                                               */
/* ================================================================== */

const CSS = `
.rzeile{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,.7fr) minmax(0,.9fr)
  minmax(0,1fr) minmax(0,1.1fr) auto;gap:.5rem;align-items:end;padding:.7rem 0;
  border-bottom:1px solid var(--sand)}
.rzeile:last-of-type{border-bottom:0}
.rzeile .f label{margin-bottom:.2rem;font-size:.6rem}
.rzeile .f input,.rzeile .f select{padding:.55rem .6rem}
.rzeile .weg{background:none;border:1px solid var(--sand);border-radius:var(--r);color:var(--muted);
  font:inherit;font-size:1rem;line-height:1;padding:.55rem .7rem;cursor:pointer;height:38px}
.rzeile .weg:hover{border-color:var(--wine);color:var(--wine)}
.rsum{margin-top:1rem;border-top:2px solid var(--ink);padding-top:.8rem}
.rsum div{display:flex;justify-content:space-between;gap:1rem;padding:.28rem 0}
.rsum .gross{font-size:1.2rem;font-weight:700;border-top:1px solid var(--sand);
  margin-top:.4rem;padding-top:.6rem}
.rsum .meta{color:var(--muted);font-size:.86rem}
@media(max-width:720px){
  .rzeile{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.45rem .5rem;position:relative;
    padding:.8rem 0}
  .rzeile .f.txt{grid-column:1 / -1}
  .rzeile .weg{position:absolute;top:.55rem;right:0;height:auto;padding:.25rem .55rem;font-size:.85rem}
}
`;

/* ================================================================== */
/* Druckansicht                                                       */
/* ================================================================== */

const DRUCK_CSS = `
@page{size:A4;margin:18mm 18mm 16mm}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#fff;color:#14120F;
  font:11pt/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.blatt{width:186mm;margin:0 auto;padding:14mm 0 0}
.kopf{display:flex;justify-content:space-between;align-items:flex-start;gap:2rem;margin-bottom:16mm}
.kopf img{width:52mm;height:auto}
.absender{text-align:right;font-size:8.5pt;line-height:1.6;color:#4a463f}
.fenster{font-size:8pt;color:#6E675A;border-bottom:.3pt solid #bbb;padding-bottom:2px;
  margin-bottom:4mm;width:85mm}
.an{margin-bottom:14mm;line-height:1.55}
.an b{font-weight:600}
h1{font-size:15pt;margin:0 0 1mm;letter-spacing:-.01em}
.meta{display:grid;grid-template-columns:auto auto;gap:1mm 6mm;justify-content:start;
  font-size:9.5pt;margin:0 0 8mm}
.meta span{color:#6E675A}
table{width:100%;border-collapse:collapse;margin-bottom:6mm}
th{font-size:8pt;letter-spacing:.06em;text-transform:uppercase;color:#6E675A;
  text-align:left;border-bottom:.6pt solid #14120F;padding:0 2mm 1.5mm 0}
td{padding:1.8mm 2mm 1.8mm 0;border-bottom:.3pt solid #ddd;vertical-align:top}
th.r,td.r{text-align:right;padding-right:0;white-space:nowrap}
.summe{width:78mm;margin-left:auto}
.summe div{display:flex;justify-content:space-between;padding:1mm 0}
.summe .gr{border-top:.6pt solid #14120F;margin-top:1mm;padding-top:2mm;
  font-size:12pt;font-weight:700}
.text{margin:8mm 0 0;font-size:10pt;line-height:1.6}
.fuss{margin-top:14mm;padding-top:3mm;border-top:.3pt solid #ccc;
  font-size:7.5pt;line-height:1.6;color:#6E675A;
  display:grid;grid-template-columns:1fr 1fr 1fr;gap:6mm}
.storniert{color:#6D1826;font-weight:700;border:1pt solid #6D1826;padding:2mm 3mm;
  display:inline-block;margin-bottom:6mm}
.nodruck{margin:8mm auto 0;width:186mm;text-align:right}
.nodruck a,.nodruck button{font:inherit;font-size:9pt;background:#6D1826;color:#fff;border:0;
  padding:2mm 5mm;text-decoration:none;border-radius:2px;cursor:pointer;margin-left:2mm}
@media print{.nodruck{display:none}body{font-size:10.5pt}}
`;

/** „22.08.2026" — auf einer Rechnung will niemand den Wochentag lesen. */
const kurzDatum = d => (d && /^\d{4}-\d{2}-\d{2}$/.test(d))
  ? `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '';

function druckSeite(rg, posten, bank) {
  const s = rechne(posten);
  const zeit = rg.leistung_bis && rg.leistung_bis !== rg.leistung_von
    ? `${kurzDatum(rg.leistung_von)} bis ${kurzDatum(rg.leistung_bis)}`
    : kurzDatum(rg.leistung_von);

  return new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(rg.nummer ? 'Rechnung ' + rg.nummer : 'Rechnungsentwurf')} — Goya´s Lamm</title>
<meta name="robots" content="noindex,nofollow">
<style>${DRUCK_CSS}</style></head><body>
<div class="blatt">
  <div class="kopf">
    <img src="/assets/logo-dark.png" alt="Goya´s Lamm Horrheim" width="1200" height="443">
    <div class="absender">
      <b>${esc(HAUS.name)}</b><br>${esc(HAUS.inhaber)}<br>
      ${esc(HAUS.strasse)}<br>${esc(HAUS.ort)}<br><br>
      Telefon ${esc(HAUS.telefon)}<br>${esc(HAUS.mail)}
    </div>
  </div>

  <div class="fenster">${esc(HAUS.name)} · ${esc(HAUS.strasse)} · ${esc(HAUS.ort)}</div>
  <div class="an">
    <b>${esc(rg.empfaenger)}</b><br>
    ${esc(rg.adresse || '').split('\n').map(z => esc(z)).join('<br>')}
  </div>

  ${rg.status === 'storniert' ? '<div class="storniert">Diese Rechnung wurde storniert.</div>' : ''}
  ${rg.storno_von ? '<div class="storniert">Stornorechnung</div>' : ''}

  <h1>${rg.nummer ? 'Rechnung' : 'Rechnungsentwurf'}</h1>
  <div class="meta">
    ${rg.nummer ? `<span>Rechnungsnummer</span><b>${esc(rg.nummer)}</b>` : ''}
    ${rg.datum ? `<span>Rechnungsdatum</span><div>${esc(kurzDatum(rg.datum))}</div>` : ''}
    <span>${rg.leistung_bis && rg.leistung_bis !== rg.leistung_von ? 'Leistungszeitraum' : 'Leistungsdatum'}</span><div>${esc(zeit)}</div>
    ${rg.anlass ? `<span>Anlass</span><div>${esc(rg.anlass)}</div>` : ''}
    <span>Umsatzsteuer-ID</span><div>${esc(HAUS.ustid)}</div>
  </div>

  <table>
    <thead><tr>
      <th style="width:52%">Leistung</th><th class="r">Menge</th>
      <th class="r">Einzelpreis</th><th class="r">USt.</th><th class="r">Betrag netto</th>
    </tr></thead>
    <tbody>${posten.map(p => `<tr>
      <td>${esc(p.text)}</td>
      <td class="r">${esc(menge(p.menge_milli))}${p.einheit ? ' ' + esc(p.einheit) : ''}</td>
      <td class="r">${esc(euro(p.ep_cent))} €</td>
      <td class="r">${esc(String(p.steuer))} %</td>
      <td class="r">${esc(euro(positionCent(p.menge_milli, p.ep_cent)))} €</td>
    </tr>`).join('')}</tbody>
  </table>

  <div class="summe">
    <div><span>Summe netto</span><b>${esc(euro(s.netto))} €</b></div>
    ${s.nachSatz.filter(z => z.satz > 0).map(z =>
      `<div><span>zzgl. ${z.satz} % USt. auf ${esc(euro(z.netto))} €</span>
        <b>${esc(euro(z.steuer))} €</b></div>`).join('')}
    <div class="gr"><span>Rechnungsbetrag</span><span>${esc(euro(s.brutto))} €</span></div>
  </div>

  <div class="text">
    ${rg.hinweis ? esc(rg.hinweis).split('\n').join('<br>') + '<br><br>' : ''}
    ${rg.status === 'bezahlt'
      ? `Der Betrag ist am ${esc(kurzDatum(rg.bezahlt_am || rg.datum))} eingegangen. Vielen Dank.`
      : rg.faellig_am
        ? `Bitte überweisen Sie den Rechnungsbetrag bis zum
           <b>${esc(kurzDatum(rg.faellig_am))}</b> auf das unten genannte Konto.`
        : 'Bitte überweisen Sie den Rechnungsbetrag auf das unten genannte Konto.'}
    <br><br>Wir bedanken uns für Ihren Besuch.
  </div>

  <div class="fuss">
    <div><b>${esc(HAUS.name)}</b><br>${esc(HAUS.inhaber)}<br>${esc(HAUS.strasse)}<br>${esc(HAUS.ort)}</div>
    <div>Telefon ${esc(HAUS.telefon)}<br>${esc(HAUS.mail)}<br>USt-IdNr. ${esc(HAUS.ustid)}</div>
    <div>${bank ? esc(bank).split('\n').join('<br>') : '<i>Bankverbindung im Panel hinterlegen</i>'}</div>
  </div>
</div>
<div class="nodruck">
  <a href="/admin/rechnung?id=${esc(rg.id)}">Zurück</a>
  <button type="button" onclick="window.print()">Drucken oder als PDF sichern</button>
</div>
</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/* ================================================================== */
/* Anzeige im Panel                                                   */
/* ================================================================== */

const BEWIRTUNG = `
  <details class="card">
    <summary>Wofür diese Rechnung taugt — und wofür nicht</summary>
    <div class="body meta">
      <p style="margin:0 0 .6rem"><b>Sie ist eine ordentliche Rechnung nach § 14 UStG.</b>
         Absender, Empfänger, USt-IdNr., fortlaufende Nummer, Leistungszeitpunkt und die
         Steuer nach Sätzen getrennt — alles, was drauf sein muss, steht drauf.</p>
      <p style="margin:0 0 .6rem"><b>Sie ist kein Bewirtungsbeleg.</b> Wer Bewirtungskosten
         absetzen will, braucht seit 2020 einen Beleg aus einem elektronischen
         Aufzeichnungssystem mit zertifizierter Sicherheitseinrichtung — also aus der Kasse
         (§ 4 Abs. 5 Nr. 2 EStG, BMF-Schreiben vom 30.06.2021). Fragt ein Firmenkunde nach
         einem Beleg zum Absetzen, gehört der Kassenbon dazu.</p>
      <p style="margin:0 0 .6rem"><b>Speisen 7 %, Getränke 19 %.</b> Seit dem 1.1.2026 gilt
         für Speisen in der Gastronomie der ermäßigte Satz, Getränke sind ausgenommen. Eine
         Feier enthält beides — deshalb hat hier jede Position ihren eigenen Satz.</p>
      <p style="margin:0"><b>Sie ist keine Buchhaltung.</b> Die Rechnungen gehen wie bisher an
         den Steuerberater. Hier entstehen sie nur.</p>
    </div>
  </details>`;

function listeSeite({ url, user, rechnungen, jahr, jahre, bank }) {
  const summe = st => rechnungen.filter(r => r.status === st)
    .reduce((s, r) => s + (r.brutto || 0), 0);
  const offen = rechnungen.filter(r => r.status === 'gestellt');

  const zeile = r => `<tr class="${r.status === 'storniert' ? 'cancelled' : ''}">
    <td class="t">${r.nummer ? esc(r.nummer) : '<span class="meta">Entwurf</span>'}</td>
    <td class="nm"><a href="/admin/rechnung?id=${esc(r.id)}">${esc(r.empfaenger)}</a>
      ${r.anlass ? `<div class="meta">${esc(r.anlass)}</div>` : ''}</td>
    <td class="hide-s meta">${esc(tagKurz(r.leistung_von))}</td>
    <td class="hide-s"><span class="pill ${STATUS[r.status]?.pill || ''}">${
      esc(STATUS[r.status]?.label || r.status)}</span>
      ${r.status === 'gestellt' && r.faellig_am && r.faellig_am < nowBerlin().date
        ? '<div class="meta"><span class="pill ns">überfällig</span></div>' : ''}</td>
    <td class="g">${esc(euro(r.brutto || 0))} €</td>
    <td class="det meta show-s">${esc(tagKurz(r.leistung_von))} · ${
      esc(STATUS[r.status]?.label || r.status)}</td>
    <td class="act"><a class="btn sm ghost" href="/admin/rechnung?id=${esc(r.id)}">Öffnen</a></td>
  </tr>`;

  const body = `<style>${CSS}</style>
    <h1>Rechnungen</h1>
    <p class="sub">Für Feiern und Firmenessen — alles, was nicht über die Kasse läuft.</p>
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/rechnung?neu=1">Rechnung schreiben</a>
      ${jahre.map(j => `<a class="btn ghost${j === jahr ? '' : ''}" href="/admin/rechnung?j=${j}"
        ${j === jahr ? 'style="border-color:var(--wine);color:var(--wine)"' : ''}>${j}</a>`).join('')}
    </div>

    <div class="stats">
      <div class="stat"><b>${rechnungen.length}</b><span>Rechnungen ${jahr}</span></div>
      <div class="stat ${offen.length ? 'hot' : ''}"><b>${euro(summe('gestellt'))} €</b>
        <span>offen</span></div>
      <div class="stat"><b>${euro(summe('bezahlt'))} €</b><span>bezahlt</span></div>
    </div>

    ${!bank ? `<div class="msg warn"><b>Es ist keine Bankverbindung hinterlegt.</b>
      Ohne sie steht auf der Rechnung kein Konto, auf das der Kunde überweisen kann.
      Unten eintragen — sie wird bewusst nirgends automatisch übernommen.</div>` : ''}

    <div class="card">
      <h2>Rechnungen <em>${jahr}</em></h2>
      ${rechnungen.length ? `<table class="stack"><thead><tr>
          <th>Nummer</th><th>Empfänger</th><th class="hide-s">Leistung</th>
          <th class="hide-s">Stand</th><th>Betrag</th><th></th>
        </tr></thead><tbody>${rechnungen.map(zeile).join('')}</tbody></table>`
        : `<div class="empty">Für ${jahr} ist noch nichts geschrieben.</div>`}
    </div>

    <details class="card"${bank ? '' : ' open'}>
      <summary>Bankverbindung für die Rechnungen</summary>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Steht im Fuß jeder Rechnung. Bewusst ein
           freies Feld und nichts, was von irgendwoher übernommen wird — Kontodaten trägt
           man einmal selbst ein und liest sie danach einmal Korrektur.</p>
        <form method="post" action="/admin/rechnung">
          <input type="hidden" name="do" value="bank">
          <div class="f">
            <label for="bank">Kontoinhaber, IBAN, BIC und Bank</label>
            <textarea id="bank" name="bank" rows="4" maxlength="300"
              placeholder="Gökhan Yavuz&#10;IBAN DE00 0000 0000 0000 0000 00&#10;BIC XXXXDEFFXXX&#10;Kreissparkasse Ludwigsburg">${esc(bank)}</textarea>
          </div>
          <div class="row end" style="margin-top:1rem"><button class="btn" type="submit">Speichern</button></div>
        </form>
      </div>
    </details>

    ${BEWIRTUNG}`;

  return layout({ user, title: 'Rechnungen', active: '/admin/rechnung', body });
}

function formularSeite({ url, user, rg, posten, bank }) {
  const neu = !rg.id;
  const offen = neu || rg.status === 'entwurf';
  const s = rechne(posten);
  const heute = nowBerlin().date;

  const satzOptionen = gewaehlt => SAETZE.map(x =>
    `<option value="${x.wert}"${Number(gewaehlt) === x.wert ? ' selected' : ''}>${esc(x.label)}</option>`).join('');

  const zeile = p => `<div class="rzeile" data-zeile>
    <div class="f txt"><label>Leistung</label>
      <input name="ptext" maxlength="120" value="${esc(p?.text || '')}"
             placeholder="z. B. Menü „Heißer Stein", 3 Gänge"></div>
    <div class="f"><label>Menge</label>
      <input name="pmenge" inputmode="decimal" maxlength="8" data-menge
             value="${p ? esc(menge(p.menge_milli)) : ''}" placeholder="1"></div>
    <div class="f"><label>Einheit</label>
      <input name="peinheit" maxlength="16" value="${esc(p?.einheit || '')}" placeholder="Personen"></div>
    <div class="f"><label>Einzelpreis netto</label>
      <input name="pep" inputmode="decimal" maxlength="10" data-ep
             value="${p?.ep_cent ? esc(euro(p.ep_cent)) : ''}" placeholder="0,00"></div>
    <div class="f"><label>Steuer</label>
      <select name="psteuer" data-satz>${satzOptionen(p?.steuer ?? 7)}</select></div>
    <button type="button" class="weg" data-weg aria-label="Zeile entfernen">✕</button>
  </div>`;

  const zeilen = posten.length
    ? posten.map(zeile).join('')
    : Array.from({ length: ZEILEN }, () => zeile(null)).join('');

  const fehlt = fehlendes(rg, posten);

  /* ---- gestellte Rechnung: nur ansehen ---------------------------- */
  if (!offen) {
    const body = `<style>${CSS}</style>
      <h1>Rechnung ${esc(rg.nummer || '')}</h1>
      <p class="sub">${esc(rg.empfaenger)}${rg.anlass ? ' · ' + esc(rg.anlass) : ''}</p>
      ${flash(url)}

      <div class="row" style="margin-bottom:1.4rem">
        <a class="btn" href="/admin/rechnung?id=${esc(rg.id)}&druck=1" target="_blank"
           rel="noopener">Drucken oder als PDF</a>
        ${rg.status === 'gestellt' ? `<form method="post" action="/admin/rechnung" style="display:inline">
          <input type="hidden" name="do" value="bezahlt">
          <input type="hidden" name="id" value="${esc(rg.id)}">
          <button class="btn ghost" type="submit">Als bezahlt vermerken</button>
        </form>` : ''}
        ${rg.status !== 'storniert' ? `<form method="post" action="/admin/rechnung" style="display:inline"
          onsubmit="return confirm('Stornorechnung anlegen? Die Originalrechnung bleibt bestehen.')">
          <input type="hidden" name="do" value="storno">
          <input type="hidden" name="id" value="${esc(rg.id)}">
          <button class="btn danger" type="submit">Stornieren</button>
        </form>` : ''}
        <span class="spacer"></span>
        <a class="btn ghost" href="/admin/rechnung">Alle Rechnungen</a>
      </div>

      <div class="card">
        <h2>Rechnung <em>${esc(STATUS[rg.status]?.label || rg.status)}</em></h2>
        <div class="body">
          <div class="paare" style="margin-bottom:1.2rem">
            <div><span class="k">Nummer</span><span class="v">${esc(rg.nummer || '—')}</span></div>
            <div><span class="k">Rechnungsdatum</span><span class="v">${
              rg.datum ? esc(formatDateDE(rg.datum)) : '—'}</span></div>
            <div><span class="k">Leistung</span><span class="v">${esc(formatDateDE(rg.leistung_von))}${
              rg.leistung_bis && rg.leistung_bis !== rg.leistung_von
                ? ' – ' + esc(formatDateDE(rg.leistung_bis)) : ''}</span></div>
            <div><span class="k">Fällig</span><span class="v">${
              rg.faellig_am ? esc(formatDateDE(rg.faellig_am)) : '—'}</span></div>
            ${rg.bezahlt_am ? `<div><span class="k">Bezahlt am</span>
              <span class="v">${esc(formatDateDE(rg.bezahlt_am))}</span></div>` : ''}
          </div>
          <table><thead><tr><th>Leistung</th><th class="num">Menge</th>
            <th class="num">Einzeln</th><th class="num">USt.</th><th class="num">Netto</th></tr></thead>
          <tbody>${posten.map(p => `<tr>
            <td>${esc(p.text)}</td>
            <td class="num">${esc(menge(p.menge_milli))} ${esc(p.einheit || '')}</td>
            <td class="num">${esc(euro(p.ep_cent))} €</td>
            <td class="num">${esc(String(p.steuer))} %</td>
            <td class="num">${esc(euro(positionCent(p.menge_milli, p.ep_cent)))} €</td>
          </tr>`).join('')}</tbody></table>
          <div class="rsum">
            <div><span class="meta">Netto</span><b>${esc(euro(s.netto))} €</b></div>
            ${s.nachSatz.filter(z => z.satz > 0).map(z =>
              `<div><span class="meta">${z.satz} % auf ${esc(euro(z.netto))} €</span>
                <b>${esc(euro(z.steuer))} €</b></div>`).join('')}
            <div class="gross"><span>Rechnungsbetrag</span><span>${esc(euro(s.brutto))} €</span></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Warum sich hier nichts mehr ändern lässt</h2>
        <div class="body meta">
          <p style="margin:0">Eine ausgestellte Rechnung ist unveränderlich. Stimmt etwas
             nicht, wird sie storniert und neu geschrieben — die Stornorechnung bekommt eine
             eigene Nummer und verweist auf das Original. So bleibt nachvollziehbar, was
             passiert ist; eine stille Korrektur wäre nach GoBD eine Änderung ohne Spur.</p>
        </div>
      </div>`;
    return layout({ user, title: `Rechnung ${rg.nummer || ''}`, active: '/admin/rechnung', body });
  }

  /* ---- Entwurf: bearbeiten ---------------------------------------- */
  const body = `<style>${CSS}</style>
    <h1>${neu ? 'Rechnung schreiben' : 'Entwurf bearbeiten'}</h1>
    <p class="sub">Solange „Entwurf" draufsteht, hat die Rechnung keine Nummer und lässt sich
       beliebig ändern. Die Nummer kommt erst beim Ausstellen — so entsteht keine Lücke in
       der Nummernfolge.</p>
    ${flash(url)}

    <form method="post" action="/admin/rechnung">
      <input type="hidden" name="do" value="save">
      ${rg.id ? `<input type="hidden" name="id" value="${esc(rg.id)}">` : ''}

      <div class="card">
        <h2>An wen</h2>
        <div class="body">
          <div class="grid">
            <div class="f"><label for="e">Name oder Firma</label>
              <input id="e" name="empfaenger" maxlength="120" required
                     value="${esc(rg.empfaenger || '')}" placeholder="Musterbau GmbH"></div>
            <div class="f"><label for="em">E-Mail <span class="meta">optional</span></label>
              <input id="em" name="email" type="email" maxlength="120"
                     value="${esc(rg.email || '')}"></div>
            <div class="f full"><label for="ad">Anschrift</label>
              <textarea id="ad" name="adresse" rows="3" maxlength="300"
                placeholder="Straße und Hausnummer&#10;PLZ Ort">${esc(rg.adresse || '')}</textarea>
              <p class="hint">Pflichtangabe nach § 14 UStG — ohne vollständige Anschrift des
                 Empfängers ist die Rechnung nicht vorsteuerabzugsfähig.</p></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Was und wann</h2>
        <div class="body">
          <div class="grid">
            <div class="f full"><label for="an">Anlass</label>
              <input id="an" name="anlass" maxlength="120" value="${esc(rg.anlass || '')}"
                     placeholder="z. B. Geburtstagsfeier, 24 Personen"></div>
            <div class="f"><label for="lv">Leistung am</label>
              <input id="lv" name="leistung_von" type="date" required
                     value="${esc(rg.leistung_von || heute)}"></div>
            <div class="f"><label for="lb">bis <span class="meta">nur bei mehreren Tagen</span></label>
              <input id="lb" name="leistung_bis" type="date" value="${esc(rg.leistung_bis || '')}"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Positionen <em>Preise netto</em></h2>
        <div class="body">
          <p class="hint" style="margin:0 0 .9rem">Alle Preise <b>netto</b> eintragen — die
            Steuer kommt darunter dazu. <b>Speisen 7 %, Getränke 19 %</b> (seit 1.1.2026).
            Raummiete, Deko und Service gehören zu 19 %, wenn sie gesondert berechnet werden.
            Im Zweifel den Steuerberater fragen; die Seite rät nicht.</p>
          <div id="posten">${zeilen}</div>
          <div class="row" style="margin-top:.8rem">
            <button type="button" class="btn sm ghost" id="mehr">Zeile hinzufügen</button>
          </div>
          <div class="rsum" id="summe">
            <div><span class="meta">Netto</span><b data-netto>${esc(euro(s.netto))} €</b></div>
            <div><span class="meta">Steuer</span><b data-steuer>${esc(euro(s.steuer))} €</b></div>
            <div class="gross"><span>Rechnungsbetrag</span>
              <span data-brutto>${esc(euro(s.brutto))} €</span></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Text unter den Positionen <em>optional</em></h2>
        <div class="body">
          <div class="f">
            <textarea name="hinweis" rows="3" maxlength="600"
              placeholder="z. B. Vielen Dank für die Feier bei uns. Die Anzahlung von 200,00 € ist bereits abgezogen."
              >${esc(rg.hinweis || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="row end" style="margin-bottom:2rem">
        <a class="btn ghost" href="/admin/rechnung">Abbrechen</a>
        <button class="btn ghost" type="submit">Entwurf speichern</button>
      </div>
    </form>

    ${rg.id ? `
    <div class="card">
      <h2>Ausstellen</h2>
      <div class="body">
        ${fehlt.length
          ? `<div class="msg warn"><b>Dafür fehlt noch etwas:</b> ${esc(fehlt.join(', '))}.</div>`
          : `<p class="meta" style="margin:0 0 1rem">Danach bekommt die Rechnung ihre Nummer und
               lässt sich nicht mehr ändern. Zahlungsziel ${ZAHLUNGSZIEL_TAGE} Tage.</p>`}
        <div class="row">
          <form method="post" action="/admin/rechnung" style="display:inline"
                onsubmit="return confirm('Rechnung ausstellen? Danach ist sie unveränderlich.')">
            <input type="hidden" name="do" value="stellen">
            <input type="hidden" name="id" value="${esc(rg.id)}">
            <button class="btn" type="submit"${fehlt.length ? ' disabled' : ''}>Ausstellen</button>
          </form>
          <a class="btn ghost" href="/admin/rechnung?id=${esc(rg.id)}&druck=1" target="_blank"
             rel="noopener">Entwurf ansehen</a>
          <span class="spacer"></span>
          <form method="post" action="/admin/rechnung" style="display:inline"
                onsubmit="return confirm('Entwurf löschen?')">
            <input type="hidden" name="do" value="weg">
            <input type="hidden" name="id" value="${esc(rg.id)}">
            <button class="btn danger" type="submit">Entwurf löschen</button>
          </form>
        </div>
      </div>
    </div>` : ''}

    ${BEWIRTUNG}

    <script>
    (function(){
      var box = document.getElementById('posten');
      if (!box) return;
      var $ = function(s,e){ return (e||document).querySelector(s) };
      var $$ = function(s,e){ return [].slice.call((e||document).querySelectorAll(s)) };

      function zahl(v, faktor){
        v = String(v||'').trim().replace(',','.');
        if (!v || !/^\\d*\\.?\\d*$/.test(v)) return 0;
        var n = Number(v); return isFinite(n) ? Math.round(n*faktor) : 0;
      }
      function geld(c){ return (c/100).toFixed(2).replace('.',',') + ' €' }

      function rechne(){
        var netto = 0, steuer = 0;
        $$('[data-zeile]', box).forEach(function(r){
          var m = zahl($('[data-menge]',r).value || '1', 1000);
          var e = zahl($('[data-ep]',r).value, 100);
          var s = Number($('[data-satz]',r).value) || 0;
          var c = Math.round(m*e/1000);
          netto += c; steuer += Math.round(c*s/100);
        });
        $('[data-netto]').textContent  = geld(netto);
        $('[data-steuer]').textContent = geld(steuer);
        $('[data-brutto]').textContent = geld(netto+steuer);
      }

      function binden(r){
        $$('input,select', r).forEach(function(i){ i.addEventListener('input', rechne) });
        var w = $('[data-weg]', r);
        if (w) w.addEventListener('click', function(){
          if ($$('[data-zeile]', box).length > 1) r.remove();
          else $$('input', r).forEach(function(i){ i.value = '' });
          rechne();
        });
      }
      $$('[data-zeile]', box).forEach(binden);
      rechne();

      var mehr = document.getElementById('mehr');
      if (mehr) mehr.addEventListener('click', function(){
        var v = $$('[data-zeile]', box)[0].cloneNode(true);
        $$('input', v).forEach(function(i){ i.value = '' });
        box.appendChild(v); binden(v); rechne();
      });
    })();
    </script>`;

  return layout({ user, title: neu ? 'Rechnung schreiben' : 'Entwurf', active: '/admin/rechnung', body });
}

/* ================================================================== */
/* GET                                                                */
/* ================================================================== */

async function ladePosten(db, id) {
  try {
    return (await db.prepare(
      `SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY sort, rowid`).bind(id).all()).results || [];
  } catch { return []; }
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const heute = nowBerlin().date;
  const bank = await einstellung(db, 'rechnung_bank');

  const id = clean(url.searchParams.get('id'), 40);

  if (url.searchParams.get('neu') === '1') {
    return formularSeite({ url, user: data?.user, bank,
      rg: { leistung_von: heute }, posten: [] });
  }

  if (id) {
    let rg = null;
    try {
      rg = await db.prepare(`SELECT * FROM invoices WHERE id=?`).bind(id).first();
    } catch {
      return layout({ user: data?.user, title: 'Rechnungen', active: '/admin/rechnung',
        body: `<div class="msg err">${esc(MIGRATION)}</div>` });
    }
    if (!rg) return redirect('/admin/rechnung?err=' + encodeURIComponent('Diese Rechnung gibt es nicht.'));
    const posten = await ladePosten(db, id);
    if (url.searchParams.get('druck') === '1') return druckSeite(rg, posten, bank);
    return formularSeite({ url, user: data?.user, rg, posten, bank });
  }

  /* --- Liste --- */
  const jahrRoh = parseInt(clean(url.searchParams.get('j'), 4), 10);
  const jahr = Number.isFinite(jahrRoh) && jahrRoh > 2020 && jahrRoh < 2100
    ? jahrRoh : Number(heute.slice(0, 4));

  let rechnungen = [], jahre = [jahr];
  try {
    rechnungen = (await db.prepare(
      `SELECT * FROM invoices WHERE leistung_von LIKE ?
        ORDER BY COALESCE(datum, leistung_von) DESC, created_at DESC`)
      .bind(jahr + '%').all()).results || [];
    const j = (await db.prepare(
      `SELECT DISTINCT substr(leistung_von,1,4) AS j FROM invoices ORDER BY j DESC`).all()).results || [];
    jahre = [...new Set([...j.map(x => Number(x.j)), Number(heute.slice(0, 4))])].sort((a, b) => b - a);
  } catch {
    return layout({ user: data?.user, title: 'Rechnungen', active: '/admin/rechnung',
      body: `<div class="msg err">${esc(MIGRATION)}</div>` });
  }

  /* Summen je Rechnung — eine Abfrage für alle Posten des Jahres. */
  try {
    const alle = (await db.prepare(
      `SELECT i.invoice_id, i.menge_milli, i.ep_cent, i.steuer FROM invoice_items i
         JOIN invoices r ON r.id = i.invoice_id WHERE r.leistung_von LIKE ?`)
      .bind(jahr + '%').all()).results || [];
    const proRg = {};
    for (const p of alle) (proRg[p.invoice_id] ||= []).push(p);
    for (const r of rechnungen) r.brutto = rechne(proRg[r.id] || []).brutto;
  } catch { /* dann eben ohne Beträge */ }

  return listeSeite({ url, user: data?.user, rechnungen, jahr, jahre, bank });
}

/* ================================================================== */
/* POST                                                               */
/* ================================================================== */

/** Nächste Nummer für ein Jahr. Zähler steht in `settings`. */
async function naechsteNummer(db, jahr) {
  const k = `rechnung_nr_${jahr}`;
  const r = await db.prepare(
    `INSERT INTO settings (k, v) VALUES (?, '1')
       ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)
     RETURNING v`).bind(k).first();
  return nummerBauen(jahr, parseInt(r?.v || '1', 10));
}

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }
  const d = Object.fromEntries(form);
  const id = clean(d.id, 40);
  const jetzt = new Date().toISOString();

  const zurueck = (ziel, ok) => redirect(ziel + (ok ? (ziel.includes('?') ? '&' : '?')
    + 'ok=' + encodeURIComponent(ok) : ''));
  const fehler = m => redirect((id ? `/admin/rechnung?id=${encodeURIComponent(id)}&err=`
    : '/admin/rechnung?err=') + encodeURIComponent(m));

  if (!db) return fehler('Keine Datenbankverbindung.');

  try {
    /* --- Bankverbindung --- */
    if (d.do === 'bank') {
      const t = String(d.bank ?? '').replace(/\r/g, '').slice(0, 300).trim();
      await db.prepare(
        `INSERT INTO settings (k,v) VALUES ('rechnung_bank', ?)
           ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(t).run();
      return zurueck('/admin/rechnung', 'Bankverbindung gespeichert.');
    }

    /* --- Entwurf speichern --- */
    if (d.do === 'save') {
      const empfaenger = clean(d.empfaenger, 120);
      if (empfaenger.length < 2) return fehler('Bitte den Empfänger angeben.');
      const von = clean(d.leistung_von, 10);
      if (!isValidDate(von)) return fehler('Bitte ein gültiges Leistungsdatum angeben.');
      const bisRoh = clean(d.leistung_bis, 10);
      const bis = isValidDate(bisRoh) ? bisRoh : null;
      if (bis && bis < von) return fehler('Das Ende liegt vor dem Beginn.');

      const adresse = String(d.adresse ?? '').replace(/\r/g, '').slice(0, 300).trim() || null;
      const hinweis = String(d.hinweis ?? '').replace(/\r/g, '').slice(0, 600).trim() || null;

      let rid = id;
      if (rid) {
        const alt = await db.prepare(`SELECT status FROM invoices WHERE id=?`).bind(rid).first();
        if (!alt) return fehler('Diese Rechnung gibt es nicht.');
        if (alt.status !== 'entwurf') return fehler('Eine ausgestellte Rechnung lässt sich nicht ändern.');
        await db.prepare(
          `UPDATE invoices SET empfaenger=?, adresse=?, email=?, anlass=?, leistung_von=?,
                               leistung_bis=?, hinweis=?, updated_at=? WHERE id=?`
        ).bind(empfaenger, adresse, clean(d.email, 120) || null, clean(d.anlass, 120) || null,
               von, bis, hinweis, jetzt, rid).run();
      } else {
        rid = crypto.randomUUID();
        await db.prepare(
          `INSERT INTO invoices (id,status,empfaenger,adresse,email,anlass,leistung_von,
                                 leistung_bis,hinweis,erstellt_von,created_at)
           VALUES (?, 'entwurf', ?,?,?,?,?,?,?,?,?)`
        ).bind(rid, empfaenger, adresse, clean(d.email, 120) || null, clean(d.anlass, 120) || null,
               von, bis, hinweis, data?.user?.name || 'Chef', jetzt).run();
      }

      /* Positionen: alte weg, neue rein. Bei einem Entwurf ist das ehrlicher
         als ein Abgleich Zeile für Zeile — es gibt nichts zu bewahren. */
      await db.prepare(`DELETE FROM invoice_items WHERE invoice_id=?`).bind(rid).run();
      const texte = form.getAll('ptext'), mengen = form.getAll('pmenge');
      const einh = form.getAll('peinheit'), eps = form.getAll('pep'), saetze = form.getAll('psteuer');
      let n = 0;
      for (let i = 0; i < texte.length; i++) {
        const text = clean(texte[i], 120);
        const ep = centAus(eps[i]);
        if (!text || ep === null) continue;
        const m = mengeAus(mengen[i]);
        const satz = istSatz(saetze[i]) ? Number(saetze[i]) : 19;
        if (m === null) continue;
        await db.prepare(
          `INSERT INTO invoice_items (id,invoice_id,text,menge_milli,einheit,ep_cent,steuer,sort)
           VALUES (?,?,?,?,?,?,?,?)`
        ).bind(crypto.randomUUID(), rid, text, m || 1000, clean(einh[i], 16) || null,
               ep, satz, n++).run();
      }
      return zurueck(`/admin/rechnung?id=${encodeURIComponent(rid)}`,
        `Entwurf gespeichert — ${n} ${n === 1 ? 'Position' : 'Positionen'}.`);
    }

    if (!id) return fehler('Da fehlt die Rechnung.');
    const rg = await db.prepare(`SELECT * FROM invoices WHERE id=?`).bind(id).first();
    if (!rg) return fehler('Diese Rechnung gibt es nicht.');

    /* --- Ausstellen --- */
    if (d.do === 'stellen') {
      if (rg.status !== 'entwurf') return fehler('Diese Rechnung ist schon ausgestellt.');
      const posten = await ladePosten(db, id);
      const fehlt = fehlendes(rg, posten);
      if (fehlt.length) return fehler(`Es fehlt noch: ${fehlt.join(', ')}.`);

      const heute = nowBerlin().date;
      const jahr = Number(heute.slice(0, 4));
      const nummer = await naechsteNummer(db, jahr);
      await db.prepare(
        `UPDATE invoices SET nummer=?, jahr=?, status='gestellt', datum=?, faellig_am=?,
                             updated_at=? WHERE id=?`
      ).bind(nummer, jahr, heute, addDays(heute, ZAHLUNGSZIEL_TAGE), jetzt, id).run();
      return zurueck(`/admin/rechnung?id=${encodeURIComponent(id)}`,
        `Rechnung ${nummer} ausgestellt. Fällig am ${addDays(heute, ZAHLUNGSZIEL_TAGE).slice(8)}.`
        + `${addDays(heute, ZAHLUNGSZIEL_TAGE).slice(5, 7)}.`);
    }

    /* --- Bezahlt --- */
    if (d.do === 'bezahlt') {
      if (rg.status !== 'gestellt') return fehler('Das geht nur bei einer gestellten Rechnung.');
      await db.prepare(
        `UPDATE invoices SET status='bezahlt', bezahlt_am=?, updated_at=? WHERE id=?`)
        .bind(nowBerlin().date, jetzt, id).run();
      return zurueck(`/admin/rechnung?id=${encodeURIComponent(id)}`, 'Als bezahlt vermerkt.');
    }

    /* --- Storno: neue Rechnung mit umgekehrten Vorzeichen ------------ */
    if (d.do === 'storno') {
      if (rg.status === 'entwurf') return fehler('Ein Entwurf wird gelöscht, nicht storniert.');
      if (rg.status === 'storniert') return fehler('Diese Rechnung ist schon storniert.');

      const posten = await ladePosten(db, id);
      const heute = nowBerlin().date;
      const jahr = Number(heute.slice(0, 4));
      const nummer = await naechsteNummer(db, jahr);
      const neu = crypto.randomUUID();

      await db.prepare(
        `INSERT INTO invoices (id,nummer,jahr,status,empfaenger,adresse,email,anlass,
                               leistung_von,leistung_bis,datum,hinweis,storno_von,
                               erstellt_von,created_at)
         VALUES (?,?,?, 'gestellt', ?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(neu, nummer, jahr, rg.empfaenger, rg.adresse, rg.email,
             rg.anlass, rg.leistung_von, rg.leistung_bis, heute,
             `Stornierung der Rechnung ${rg.nummer} vom ${kurzDatum(rg.datum || rg.created_at.slice(0, 10))}.`,
             rg.id, data?.user?.name || 'Chef', jetzt).run();

      let n = 0;
      for (const p of posten) {
        await db.prepare(
          `INSERT INTO invoice_items (id,invoice_id,text,menge_milli,einheit,ep_cent,steuer,sort)
           VALUES (?,?,?,?,?,?,?,?)`
        ).bind(crypto.randomUUID(), neu, p.text, p.menge_milli, p.einheit,
               -p.ep_cent, p.steuer, n++).run();
      }
      await db.prepare(`UPDATE invoices SET status='storniert', updated_at=? WHERE id=?`)
        .bind(jetzt, id).run();

      return zurueck(`/admin/rechnung?id=${encodeURIComponent(neu)}`,
        `Stornorechnung ${nummer} angelegt. Die Originalrechnung ${rg.nummer || ''} bleibt bestehen.`);
    }

    /* --- Entwurf löschen --- */
    if (d.do === 'weg') {
      if (rg.status !== 'entwurf') return fehler('Nur Entwürfe lassen sich löschen.');
      await db.prepare(`DELETE FROM invoice_items WHERE invoice_id=?`).bind(id).run();
      await db.prepare(`DELETE FROM invoices WHERE id=?`).bind(id).run();
      return zurueck('/admin/rechnung', 'Entwurf gelöscht.');
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect('/admin/rechnung');
}
