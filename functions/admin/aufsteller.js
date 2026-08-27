/**
 * Tischaufsteller mit dem QR-Code zur digitalen Karte — zum Ausdrucken.
 *
 * Sechs Stück auf drei A4-Bögen, an der Mittellinie zu schneiden und zu falten,
 * sodass ein Dreieck entsteht, das von allein steht. Beide Seiten sind bedruckt:
 * Wer gegenübersitzt, soll denselben Code sehen und nicht um den Aufsteller
 * herumgreifen müssen.
 *
 * ── Warum der QR-Code eine feste Datei ist ────────────────────────────
 * `/assets/qr-karte.svg` wird einmal erzeugt und liegt dann da. Der Code
 * enthält nur die Adresse der Karte, und die ändert sich nicht. Ihn bei jedem
 * Aufruf neu zu rechnen hieße, eine QR-Bibliothek in die Function zu holen —
 * viel Maschinerie für ein Bild, das immer gleich aussieht.
 * ⚠️ Ändert sich die Domain, muss die Datei neu erzeugt werden. Die Adresse
 * steht deshalb auch im Klartext auf dem Aufsteller: Wer sie liest, merkt den
 * Fehler sofort — und kann sie zur Not abtippen.
 *
 * Gedruckt wird ohne Ränder am Bild, aber mit Schnittmarken. Ein Aufsteller,
 * der schief geschnitten ist, sieht billiger aus als gar keiner.
 */
import { esc, HOUSE } from '../_lib/core.js';

/**
 * ⚠️ Worauf der Code zeigt — und warum nicht auf lammm.de.
 *
 * Unter `lammm.de` liegt zum Zeitpunkt dieser Zeilen noch die **alte** Seite
 * (One.com, Apache); alles außer der Startseite antwortet dort mit 404. Ein
 * QR-Code auf `lammm.de/karte` wäre gedruckt und tot. Deshalb zeigt er auf die
 * Adresse, die heute funktioniert.
 *
 * Sobald die Domain auf dieses Projekt umgezogen ist:
 *   1. `ZIEL` hier auf `${HOUSE.site}/karte` ändern
 *   2. `public/assets/qr-karte.svg` neu erzeugen (segno, Fehlerkorrektur „h")
 *   3. neue Aufsteller drucken — die alten zeigen sonst weiter auf pages.dev
 * Punkt 3 ist der teure: Deshalb steht der Hinweis auch groß auf der Seite,
 * damit niemand vorher fünfzig Stück druckt.
 */
const ZIEL = 'https://goyas-lamm.pages.dev/karte';
const ENDGUELTIG = `${HOUSE.site}/karte`;
const UMGEZOGEN = ZIEL === ENDGUELTIG;
const SICHTBAR = ZIEL.replace(/^https?:\/\//, '');

const CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f2f1ea;color:#14120F;
  font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.bar{width:min(100% - 1.4rem,900px);margin:1rem auto 0;display:flex;gap:.5rem;flex-wrap:wrap;
  align-items:center}
.bar a,.bar button{font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;padding:.6rem 1rem;border:1px solid #d9d3c4;background:#fff;
  color:#14120F;cursor:pointer;border-radius:2px}
.bar button{background:#6D1826;border-color:#6D1826;color:#fff}
.bar .sp{flex:1}
.hilfe{width:min(100% - 1.4rem,900px);margin:1rem auto 0;background:#fff;border:1px solid #d9d3c4;
  padding:1.1rem 1.3rem;font-size:.88rem;line-height:1.65;color:#4a443c}
.hilfe b{color:#14120F}
.hilfe ol{margin:.6rem 0 0;padding-left:1.2rem}
.hilfe li{margin-bottom:.3rem}
.hilfe code{background:#f2f1ea;padding:.1rem .3rem;border-radius:2px;font-size:.92em}
.warnung{width:min(100% - 1.4rem,900px);margin:1rem auto 0;background:#F8EEF0;
  border-left:3px solid #6D1826;padding:1rem 1.3rem;font-size:.9rem;line-height:1.65}
.warnung b{color:#6D1826}

/* Der Bogen: A4 hoch, zwei Aufsteller je Seite */
.bogen{width:min(100% - 1.4rem,900px);margin:1.2rem auto 4rem;background:#fff;
  border:1px solid #d9d3c4;padding:10mm}
.karte{display:grid;grid-template-columns:1fr 1fr;gap:0;
  border:1px dashed #c9c2b2;page-break-inside:avoid;break-inside:avoid}
.karte + .karte{margin-top:5mm}
/* Die linke Hälfte steht auf dem Kopf: nach dem Falten zeigt sie zur anderen
   Tischseite und ist dort richtig herum lesbar. */
/* Zwei Aufsteller je A4-Seite. Mehr hätten gepasst, aber nur mit einem so
   kleinen QR-Code, dass man näher heranmuss als bequem ist — und ein Code, den
   der Gast zweimal ansetzen muss, ist schlechter als einer, von dem drei
   weniger auf den Bogen gehen. Sechs Stück ergeben drei volle Seiten. */
.seite{padding:5.5mm 6mm;text-align:center;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2.6mm;min-height:53mm}
.seite.kopf{transform:rotate(180deg)}
.seite + .seite{border-left:1px dashed #c9c2b2}
.seite img.logo{height:11mm;width:auto;display:block}
/* 33 mm: Die Adresse ist mit dem pages.dev-Namen länger geworden, der Code
   dadurch dichter (Version 4, 33 Module). Bei 33 mm ist ein Modul knapp 1 mm —
   der Wert, ab dem Handykameras aus Armlänge zuverlässig lesen. */
.seite .qr{width:33mm;height:33mm;display:block}
.seite .qr svg{width:100%;height:100%;display:block}
.seite h2{font-size:4mm;letter-spacing:.16em;text-transform:uppercase;margin:0;font-weight:700}
.seite p{margin:0;font-size:3.3mm;line-height:1.5;color:#6E675A;max-width:56mm}
.seite .adr{font-size:3.1mm;letter-spacing:.06em;color:#14120F;font-weight:700;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

@media print{
  @page{size:A4 portrait;margin:8mm}
  body{background:#fff}
  .bar,.hilfe{display:none}
  .bogen{width:auto;margin:0;border:0;padding:0;-webkit-print-color-adjust:exact;
    print-color-adjust:exact}
  .karte{border-color:#bbb}
  .seite + .seite{border-left-color:#bbb}
}`;

export async function onRequestGet({ env }) {
  /* Der Code liegt als Datei im selben Projekt — hier wird er eingebettet,
     damit der Aufsteller ein einziges Dokument ist und beim Drucken nicht
     auf ein noch nicht geladenes Bild wartet. */
  let qr = '';
  try {
    const r = await env.ASSETS?.fetch(new Request('https://gl/assets/qr-karte.svg'));
    if (r && r.ok) qr = (await r.text()).replace(/<\?xml[^>]*\?>\s*/, '');
  } catch { /* Rückfall unten */ }
  if (!qr) qr = `<img src="/assets/qr-karte.svg" alt="QR-Code" width="140" height="140">`;

  const seite = (kopfueber) => `
    <div class="seite${kopfueber ? ' kopf' : ''}">
      <img class="logo" src="/assets/logo-dark.png" alt="${esc(HOUSE.name)}">
      <span class="qr">${qr}</span>
      <h2>Speisekarte</h2>
      <p>Kamera aufs Bild halten — die Karte öffnet sich.<br>
         Menu in English available.</p>
      <span class="adr">${esc(SICHTBAR)}</span>
    </div>`;

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tischaufsteller — ${esc(HOUSE.name)}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<style>${CSS}</style></head><body>

<div class="bar">
  <a href="/admin/karte">&larr; Speisekarte</a>
  <a href="${esc(ZIEL)}" target="_blank" rel="noopener">Karte ansehen</a>
  <span class="sp"></span>
  <button type="button" onclick="window.print()">Drucken</button>
</div>

${UMGEZOGEN ? '' : `<div class="warnung">
  <b>Vorerst nur ein paar Stück drucken.</b> Der Code zeigt auf
  <code>${esc(ZIEL)}</code>, weil unter <code>${esc(ENDGUELTIG.replace(/^https?:\/\//, ''))}</code>
  noch die alte Seite liegt — dort gäbe es die Karte gar nicht. Sobald die Domain
  umgezogen ist, muss der Code neu erzeugt und neu gedruckt werden. Für den Anfang
  reichen zwei, drei Aufsteller zum Ausprobieren.
</div>`}

<div class="hilfe">
  <b>So wird daraus ein Aufsteller.</b>
  <ol>
    <li>Auf <b>festes Papier</b> drucken — 200 g/m² oder mehr, sonst kippt er um.
        Randlos ist nicht nötig, die Schnittlinien sind eingezeichnet.</li>
    <li>An den <b>gestrichelten Außenlinien schneiden</b>, an der <b>Mittellinie falten</b>.
        Die linke Hälfte steht auf dem Kopf — nach dem Falten zeigt sie zur anderen
        Tischseite und ist dort richtig herum lesbar.</li>
    <li>Unten ein Stück zusammenkleben oder in einen Acryl-Aufsteller stellen.</li>
  </ol>
  <p style="margin:.9rem 0 0"><b>Vor dem Drucken einmal selbst scannen.</b> Der Code
    zeigt auf <code>${esc(ZIEL)}</code>. Ändert sich diese Adresse, muss
    <code>/assets/qr-karte.svg</code> neu erzeugt werden — sonst zeigen alle Aufsteller
    ins Leere. Deshalb steht die Adresse auch im Klartext darauf: Wer sie liest,
    merkt den Fehler sofort und kann sie zur Not abtippen.</p>
</div>

<div class="bogen">
  ${Array.from({ length: 6 }, () =>
    `<div class="karte">${seite(true)}${seite(false)}</div>`).join('')}
</div>

</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
