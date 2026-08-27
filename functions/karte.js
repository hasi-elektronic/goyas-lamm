/**
 * Die digitale Karte — was der Gast sieht, wenn er den QR-Code am Tisch scannt.
 *
 * ── Für welche Situation das gebaut ist ───────────────────────────────
 * Jemand sitzt abends im Gastraum, das Licht ist gedämpft, er hält ein
 * Telefon in einer Hand und hat vielleicht schon ein Glas Wein getrunken.
 * Daraus folgt fast alles:
 *
 *   * **Dunkel.** Ein weißes Vollbild im Halbdunkel blendet und macht den
 *     Tisch unhöflich hell. Deshalb schwarzer Grund, warmes Gold, Weinrot.
 *   * **Ein Daumen genügt.** Reiterleiste unten in Daumenreichweite, keine
 *     Fläche unter 44 px, kein Zoom nötig.
 *   * **Kein Ladebalken.** Bilder kommen lazy und in drei Größen; die Karte
 *     ist lesbar, bevor das erste Bild da ist.
 *   * **Nichts blinkt.** Animationen laufen einmal beim Erscheinen und dann
 *     nie wieder. Wer `prefers-reduced-motion` gesetzt hat, bekommt gar keine.
 *
 * ── Woher die Daten kommen ────────────────────────────────────────────
 * Aus derselben Tabelle wie die Karte auf der Startseite. Es gibt keine
 * zweite Pflegestelle — ändert Gökhan unter /admin/karte einen Preis, steht
 * er hier binnen einer Minute. Das ist der eigentliche Vorteil gegenüber
 * einem abfotografierten PDF, das nach drei Wochen falsch ist.
 *
 * Sprache: Deutsch, mit Umschalter auf Englisch (`?l=en`). Fehlt eine
 * Übersetzung, steht der deutsche Text. Eine halb übersetzte Karte darf
 * keine leeren Zeilen zeigen.
 */
import { esc, HOUSE, nowBerlin, weekday, HOURS } from './_lib/core.js';
import { loadKarte } from './_lib/karte.js';

const TTL = 60;                    // Sekunden, die eine gerenderte Karte hält
let cache = { at: 0, html: {} };   // je Sprache eine Fassung

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

const T = {
  de: {
    titel: 'Speisekarte',
    lead: 'Alles frisch, vieles hausgemacht. Preise in Euro, inklusive Mehrwertsteuer.',
    heute: 'Heute geöffnet', ruhetag: 'Heute Ruhetag',
    reservieren: 'Tisch reservieren', anrufen: 'Anrufen', web: 'Zur Website',
    hinweis: 'Allergien oder Unverträglichkeiten? Sprechen Sie uns an — wir sagen Ihnen genau, was drin ist.',
    bilder: 'Ein Teil der Speisenbilder ist digital erstellt und zeigt eine beispielhafte Anrichtung. '
          + 'Die als „echte Aufnahme" gekennzeichneten Bilder stammen aus unserer Küche.',
    echt: 'Echte Aufnahme',
    sprache: 'English', spracheKurz: 'EN',
    stand: 'Stand',
  },
  en: {
    titel: 'Menu',
    lead: 'Everything fresh, much of it house-made. Prices in euro, VAT included.',
    heute: 'Open today', ruhetag: 'Closed today',
    reservieren: 'Book a table', anrufen: 'Call us', web: 'Our website',
    hinweis: 'Allergies or intolerances? Just ask — we will tell you exactly what is in it.',
    bilder: 'Some of the food images are digitally created and show an example plating. '
          + 'Images marked “real photograph” were taken in our own kitchen.',
    echt: 'Real photograph',
    sprache: 'Deutsch', spracheKurz: 'DE',
    stand: 'Updated',
  },
};

/** Die vier Bilder, die echte Fotos sind — der Rest ist digital erstellt. */
const ECHTE_FOTOS = new Set(['buratta', 'salat-omega', 'pasta-omega', 'creme-brulee']);

/* ------------------------------------------------------------------ */
/* Stil                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
/* Eigene Schriften, keine von Google: Die Content-Security-Policy dieser Seite
   lässt nur 'self' zu, und die Dateien liegen ohnehin schon im Haus. Spart
   nebenbei zwei fremde Verbindungen — am Tisch mit schwachem Mobilfunk zählt
   das mehr als anderswo. */
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:400;font-display:swap;
  src:url(/assets/fonts/playfair-display-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:400;font-display:swap;
  src:url(/assets/fonts/inter-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:600;font-display:swap;
  src:url(/assets/fonts/inter-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:700;font-display:swap;
  src:url(/assets/fonts/inter-latin-600-normal.woff2) format('woff2')}

:root{
  --nacht:#0B0A08;--nacht-2:#131110;--karte:#191614;--rand:#2A2521;
  --creme:#F4EFE4;--gold:#C9A45C;--wein:#8E2233;--gedaempft:#9A9086;
  --serif:'Playfair Display',Georgia,'Times New Roman',serif;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--nacht);color:var(--creme);font:16px/1.6 var(--sans);
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
  padding-bottom:calc(74px + env(safe-area-inset-bottom))}
img{display:block;max-width:100%}
a{color:var(--gold)}
.wrap{width:min(100% - 2rem,860px);margin-inline:auto}

/* ---------- Kopf ---------- */
.hero{position:relative;min-height:74svh;display:flex;flex-direction:column;
  justify-content:flex-end;overflow:hidden;isolation:isolate}
/* Nur das Hintergrundbild absolut setzen. Ein Selektor ".hero img" erwischt auch
   das Logo im Inhalt, und das klebt dann als 70px hohe Marke in der linken
   oberen Ecke statt über der Überschrift zu stehen. */
.hero > picture,.hero > picture img{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;z-index:-2}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;
  background:linear-gradient(180deg,rgba(11,10,8,.72) 0%,rgba(11,10,8,.35) 38%,rgba(11,10,8,.95) 100%)}
.hero .inhalt{padding:0 0 2.6rem}
.hero .marke{display:block;height:70px;width:auto;margin:0 0 1.5rem;
  filter:drop-shadow(0 2px 14px rgba(0,0,0,.7))}
.hero h1{font-family:var(--serif);font-weight:400;font-size:clamp(2.6rem,11vw,4.4rem);
  line-height:.98;margin:0 0 .7rem;letter-spacing:-.02em}
.hero .lead{color:#CFC5B6;margin:0 0 1.4rem;max-width:34ch;font-size:.98rem}
.offen{display:inline-flex;align-items:center;gap:.55rem;font-size:.7rem;letter-spacing:.18em;
  text-transform:uppercase;font-weight:700;color:var(--creme);
  border:1px solid rgba(244,239,228,.22);border-radius:100px;padding:.42rem .9rem;
  background:rgba(11,10,8,.5);backdrop-filter:blur(6px)}
.offen i{width:7px;height:7px;border-radius:50%;background:#4FBF7B;flex:0 0 auto;
  box-shadow:0 0 0 0 rgba(79,191,123,.65);animation:puls 2.6s ease-out infinite}
.offen.zu i{background:var(--wein);animation:none}
@keyframes puls{
  0%{box-shadow:0 0 0 0 rgba(79,191,123,.55)}
  70%{box-shadow:0 0 0 9px rgba(79,191,123,0)}
  100%{box-shadow:0 0 0 0 rgba(79,191,123,0)}}

/* Sprache oben rechts */
.sprache{position:absolute;top:calc(.9rem + env(safe-area-inset-top));right:1rem;z-index:5;
  display:inline-flex;align-items:center;gap:.4rem;text-decoration:none;color:var(--creme);
  font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  border:1px solid rgba(244,239,228,.26);border-radius:100px;padding:.5rem .85rem;
  background:rgba(11,10,8,.55);backdrop-filter:blur(8px)}
.sprache:hover{border-color:var(--gold);color:var(--gold)}

/* ---------- Abschnitte ---------- */
.reiter{scroll-margin-top:1rem;padding:3.2rem 0 .4rem}
.reiter > .wrap > .kopf{display:flex;align-items:baseline;gap:1rem;margin-bottom:1.8rem}
.reiter h2{font-family:var(--serif);font-weight:400;font-size:clamp(1.9rem,7vw,2.8rem);
  margin:0;letter-spacing:-.01em}
.reiter .zahl{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gedaempft);white-space:nowrap}
.reiter .linie{flex:1;height:1px;background:linear-gradient(90deg,var(--rand),transparent)}

.gruppe{margin-bottom:2.6rem}
.gruppe > h3{font-size:.7rem;letter-spacing:.24em;text-transform:uppercase;font-weight:700;
  color:var(--gold);margin:0 0 .25rem}
.gruppe > .note{color:var(--gedaempft);font-size:.88rem;margin:0 0 1rem}
.gruppe > h3 + .liste,.gruppe > .note + .liste{margin-top:1rem}

/* ---------- Gericht ---------- */
.liste{display:grid;gap:.7rem}
.gericht{background:var(--karte);border:1px solid var(--rand);border-radius:14px;
  overflow:hidden;position:relative}
.gericht.mitbild{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:stretch}
.gericht .bild{position:relative;background:#0F0D0C;overflow:hidden}
.gericht .bild img{width:100%;height:100%;object-fit:cover;
  transition:transform .7s cubic-bezier(.2,.6,.2,1)}
.gericht.mitbild:hover .bild img{transform:scale(1.06)}
.gericht .txt{padding:.9rem 1rem;display:flex;flex-direction:column;gap:.28rem;min-width:0}
.gericht .zeile{display:flex;align-items:baseline;gap:.8rem}
.gericht h4{font-family:var(--serif);font-weight:400;font-size:1.12rem;line-height:1.25;
  margin:0;flex:1;min-width:0}
.gericht .preis{font-size:.94rem;font-weight:700;color:var(--gold);white-space:nowrap;
  font-variant-numeric:tabular-nums}
.gericht .preis span{display:block;font-size:.78rem;font-weight:400;color:var(--gedaempft);
  text-align:right;line-height:1.45}
.gericht .beschreibung{color:#B4AAA0;font-size:.88rem;line-height:1.5;margin:0}
.gericht .echt{position:absolute;top:.5rem;left:.5rem;z-index:2;
  font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;
  color:var(--creme);background:rgba(11,10,8,.72);backdrop-filter:blur(4px);
  border:1px solid rgba(244,239,228,.2);border-radius:100px;padding:.16rem .45rem}

/* Erstes Gericht einer Gruppe mit Bild wird groß gezeigt — ein Blickfang je
   Abschnitt reicht; wären alle groß, wäre keins mehr besonders. */
.gericht.gross{grid-template-columns:1fr}
.gericht.gross .bild{aspect-ratio:3/2}
.gericht.gross .txt{padding:1rem 1.1rem 1.2rem}
.gericht.gross h4{font-size:1.42rem}
.gericht.gross .preis{font-size:1.06rem}

/* ---------- Fuß ---------- */
.fuss{padding:3rem 0 2.4rem;border-top:1px solid var(--rand);margin-top:2.4rem}
.fuss .tasten{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:2rem}
.taste{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
  text-decoration:none;border-radius:100px;padding:.95rem 1.3rem;
  font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  background:var(--wein);color:#fff;border:1px solid var(--wein);min-height:48px}
.taste.stil{background:transparent;color:var(--creme);border-color:var(--rand)}
.taste:hover{background:#A32A3D;border-color:#A32A3D;color:#fff}
.taste.stil:hover{background:rgba(244,239,228,.08);border-color:var(--gold);color:var(--gold)}
.fuss p{color:var(--gedaempft);font-size:.82rem;line-height:1.65;margin:0 0 .9rem}
.fuss .haus{color:var(--creme);font-size:.92rem;margin-bottom:.4rem}
.fuss a{color:var(--gedaempft)}

/* ---------- Reiterleiste unten ---------- */
.leiste{position:fixed;left:0;right:0;bottom:0;z-index:40;
  background:rgba(11,10,8,.86);backdrop-filter:blur(14px);
  border-top:1px solid var(--rand);padding-bottom:env(safe-area-inset-bottom)}
.leiste .roll{display:flex;gap:.2rem;overflow-x:auto;scrollbar-width:none;
  padding:.55rem .7rem;scroll-snap-type:x proximity}
.leiste .roll::-webkit-scrollbar{display:none}
.leiste a{flex:0 0 auto;scroll-snap-align:center;text-decoration:none;color:var(--gedaempft);
  font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;
  padding:.7rem .9rem;border-radius:100px;white-space:nowrap;min-height:44px;
  display:inline-flex;align-items:center;transition:.2s}
.leiste a.an{color:var(--nacht);background:var(--gold)}

/* ---------- Bewegung ----------
   Alles Einblenden hängt an der Klasse .js, die ein winziges Skript im Kopf
   setzt. Ohne JavaScript ist die Karte damit von der ersten Sekunde an
   vollständig lesbar — bei einer Speisekarte am Tisch ist das keine
   Feinheit, sondern der Unterschied zwischen „Karte" und „schwarze Seite". */
.js .auf{opacity:0;transform:translateY(22px)}
.js .auf.sichtbar{opacity:1;transform:none;
  transition:opacity .7s cubic-bezier(.2,.6,.2,1),transform .7s cubic-bezier(.2,.6,.2,1)}
.js .hero .inhalt > *{opacity:0;animation:rein .9s cubic-bezier(.2,.6,.2,1) forwards}
.js .hero .inhalt > *:nth-child(1){animation-delay:.05s}
.js .hero .inhalt > *:nth-child(2){animation-delay:.18s}
.js .hero .inhalt > *:nth-child(3){animation-delay:.3s}
.js .hero .inhalt > *:nth-child(4){animation-delay:.42s}
@keyframes rein{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}

@media(min-width:620px){
  .liste{grid-template-columns:repeat(2,minmax(0,1fr))}
  /* Breitere Vorschau: 112 px sind am Telefon richtig, neben einer 660 px
     breiten Karte am Rechner wirken sie wie ein vergessenes Briefmarkenbild. */
  .gericht.mitbild{grid-template-columns:150px minmax(0,1fr)}
  .gericht.gross{grid-column:1 / -1;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    align-items:stretch}
  .gericht.gross .bild{aspect-ratio:auto}
  .gericht.gross .txt{justify-content:center}
  .hero .marke{height:86px}
}
@media(min-width:900px){
  body{padding-bottom:0}
  .leiste{position:sticky;top:0;bottom:auto;border-top:0;border-bottom:1px solid var(--rand)}
  .leiste .roll{justify-content:center}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .js .auf,.js .auf.sichtbar{opacity:1;transform:none;transition:none}
  .js .hero .inhalt > *{opacity:1;animation:none}
  .offen i{animation:none}
  .gericht .bild img{transition:none}
}
`;

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

const bildTag = (slug, gross) => `
  <picture>
    <source type="image/webp" sizes="${gross ? '(min-width:620px) 430px, 100vw' : '(min-width:620px) 150px, 112px'}"
      srcset="/assets/karte/${slug}-600.webp 600w, /assets/karte/${slug}-900.webp 900w, /assets/karte/${slug}-1400.webp 1400w">
    <img src="/assets/karte/${slug}-600.jpg"
      srcset="/assets/karte/${slug}-600.jpg 600w, /assets/karte/${slug}-900.jpg 900w, /assets/karte/${slug}-1400.jpg 1400w"
      sizes="${gross ? '(min-width:620px) 430px, 100vw' : '(min-width:620px) 150px, 112px'}"
      alt="" loading="lazy" decoding="async" width="${gross ? 900 : 336}" height="${gross ? 600 : 224}">
  </picture>`;

/** Preis kann mehrzeilig sein (Gramm-Staffeln beim Steak). */
function preisHtml(p) {
  const zeilen = String(p ?? '').split('\n').map(z => z.trim()).filter(Boolean);
  if (!zeilen.length) return '';
  const [erste, ...rest] = zeilen;
  return `<div class="preis">${esc(erste)}${rest.map(z => `<span>${esc(z)}</span>`).join('')}</div>`;
}

function gerichtHtml(i, sprache, gross) {
  const name = (sprache === 'en' && i.name_en) || i.name;
  const beschr = sprache === 'en' ? (i.descr_en || i.descr) : i.descr;
  const bild = i.bild || null;
  const t = T[sprache];
  return `<article class="gericht auf${bild ? ' mitbild' : ''}${bild && gross ? ' gross' : ''}">
    ${bild ? `<div class="bild">${ECHTE_FOTOS.has(bild)
        ? `<span class="echt">${esc(t.echt)}</span>` : ''}${bildTag(bild, gross)}</div>` : ''}
    <div class="txt">
      <div class="zeile"><h4>${esc(name)}</h4>${preisHtml(i.price)}</div>
      ${beschr ? `<p class="beschreibung">${esc(beschr)}</p>` : ''}
    </div>
  </article>`;
}

function gruppeHtml(g, sprache) {
  const gerichte = g.items.filter(i => i.active);
  if (!gerichte.length) return '';
  const titel = (sprache === 'en' && g.title_en) || g.title;
  const note = sprache === 'en' ? (g.note_en || g.note) : g.note;
  /* Genau ein großes Bild je Gruppe. Hat die Gruppe ein echtes Foto, bekommt
     das den Platz — zum einen, weil eine echte Aufnahme mehr wert ist als eine
     erzeugte, zum anderen aus einem schlichten Grund: Die Marke „Echte
     Aufnahme" verdeckt auf einer 112px breiten Vorschau das halbe Bild.
     Sonst das erste Gericht, das überhaupt eins hat. */
  const grossId = (gerichte.find(i => i.bild && ECHTE_FOTOS.has(i.bild))
    || gerichte.find(i => i.bild))?.id;
  return `<section class="gruppe">
    <h3 class="auf">${esc(titel)}</h3>
    ${note ? `<p class="note auf">${esc(note)}</p>` : ''}
    <div class="liste">
      ${gerichte.map(i => gerichtHtml(i, sprache, i.id === grossId)).join('')}
    </div>
  </section>`;
}

function seite(karte, sprache, stand) {
  const t = T[sprache];
  const heute = nowBerlin().date;
  const zeiten = HOURS[weekday(heute)];
  const andere = sprache === 'de' ? 'en' : 'de';

  const reiter = karte.map(tab => {
    const titel = (sprache === 'en' && tab.title_en) || tab.title;
    const n = tab.groups.reduce((s, g) => s + g.items.filter(i => i.active).length, 0);
    return { id: tab.id, titel, n, tab };
  }).filter(r => r.n);

  const koerper = reiter.map(r => `
    <section class="reiter" id="${esc(r.id)}">
      <div class="wrap">
        <div class="kopf auf">
          <h2>${esc(r.titel)}</h2>
          <span class="linie"></span>
          <span class="zahl">${r.n}</span>
        </div>
        ${r.tab.groups.map(g => gruppeHtml(g, sprache)).join('')}
      </div>
    </section>`).join('');

  return `<!DOCTYPE html><html lang="${sprache}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(t.titel)} — ${esc(HOUSE.name)}</title>
<meta name="description" content="${esc(t.titel)} ${esc(HOUSE.name)}, ${esc(HOUSE.addr)}">
<meta name="theme-color" content="#0B0A08">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="canonical" href="${HOUSE.site}/karte${sprache === 'en' ? '?l=en' : ''}">
<link rel="alternate" hreflang="de" href="${HOUSE.site}/karte">
<link rel="alternate" hreflang="en" href="${HOUSE.site}/karte?l=en">
<link rel="preload" as="font" type="font/woff2" crossorigin
  href="/assets/fonts/playfair-display-latin-400-normal.woff2">
<!-- Setzt die Klasse, an der alle Einblendungen hängen. Steht bewusst VOR dem
     Stil: sonst blitzt der fertige Zustand kurz auf, bevor er verschwindet. -->
<script>document.documentElement.className+=' js';</script>
<style>${CSS}</style></head><body>

<header class="hero">
  <picture>
    <source type="image/webp" srcset="/assets/karte/hero-900.webp 900w, /assets/karte/hero-1400.webp 1400w, /assets/karte/hero-2000.webp 2000w" sizes="100vw">
    <img src="/assets/karte/hero-1400.jpg" alt="" fetchpriority="high" decoding="async" width="1400" height="788">
  </picture>
  <a class="sprache" href="/karte${andere === 'en' ? '?l=en' : ''}" hreflang="${andere}"
     aria-label="${esc(t.sprache)}">${esc(t.spracheKurz)}</a>
  <div class="wrap">
    <div class="inhalt">
      <img class="marke" src="/assets/logo-white.png" alt="${esc(HOUSE.name)}" width="220" height="86">
      <h1>${esc(t.titel)}</h1>
      <p class="lead">${esc(t.lead)}</p>
      <span class="offen${zeiten ? '' : ' zu'}"><i></i>${zeiten
        ? `${esc(t.heute)} · ${esc(zeiten.open)}–${esc(zeiten.close)}`
        : esc(t.ruhetag)}</span>
    </div>
  </div>
</header>

<nav class="leiste" aria-label="${esc(t.titel)}">
  <div class="roll">
    ${reiter.map((r, n) => `<a href="#${esc(r.id)}"${n === 0 ? ' class="an"' : ''}>${esc(r.titel)}</a>`).join('')}
  </div>
</nav>

<main>${koerper}</main>

<footer class="fuss">
  <div class="wrap">
    <div class="tasten">
      <a class="taste" href="${HOUSE.site}/#reservieren">${esc(t.reservieren)}</a>
      <a class="taste stil" href="tel:${esc(HOUSE.tel)}">${esc(t.anrufen)}</a>
      <a class="taste stil" href="${HOUSE.site}/">${esc(t.web)}</a>
    </div>
    <p class="haus"><b>${esc(HOUSE.name)}</b><br>${esc(HOUSE.addr)}</p>
    <p>${esc(t.hinweis)}</p>
    <p>${esc(t.bilder)}</p>
    <p>${stand ? esc(t.stand) + ': ' + esc(stand) + ' · ' : ''}
      <a href="${HOUSE.site}/impressum.html">Impressum</a> ·
      <a href="${HOUSE.site}/datenschutz.html">Datenschutz</a></p>
  </div>
</footer>

<script>${SKRIPT}</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Browser-Teil — klein gehalten, die Seite funktioniert auch ohne      */
/* ------------------------------------------------------------------ */

const SKRIPT = `
(function(){
  var reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Einblenden beim Scrollen. Ohne IntersectionObserver bleibt alles sichtbar —
     deshalb setzt erst dieses Skript die Startopazität, nicht das CSS allein. */
  var auf = [].slice.call(document.querySelectorAll('.auf'));
  if (reduziert || !('IntersectionObserver' in window)) {
    auf.forEach(function(e){ e.classList.add('sichtbar') });
  } else {
    var beo = new IntersectionObserver(function(eintraege){
      eintraege.forEach(function(e){
        if (!e.isIntersecting) return;
        e.target.classList.add('sichtbar');
        beo.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    auf.forEach(function(e){ beo.observe(e) });
  }

  /* Welcher Abschnitt ist gerade dran? Markiert den Reiter und schiebt ihn in
     der Leiste in Sicht — bei sechs Reitern liegt der letzte sonst außerhalb. */
  var tasten = [].slice.call(document.querySelectorAll('.leiste a'));
  var ziele = tasten.map(function(a){ return document.querySelector(a.getAttribute('href')) })
                    .filter(Boolean);
  var roll = document.querySelector('.leiste .roll');
  function markiere(id){
    tasten.forEach(function(a){
      var an = a.getAttribute('href') === '#' + id;
      if (an && !a.classList.contains('an') && roll) {
        var l = a.offsetLeft - (roll.clientWidth - a.offsetWidth) / 2;
        roll.scrollTo({ left: Math.max(0, l), behavior: reduziert ? 'auto' : 'smooth' });
      }
      a.classList.toggle('an', an);
    });
  }
  if (ziele.length && 'IntersectionObserver' in window) {
    var aktiv = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) markiere(e.target.id) });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ziele.forEach(function(z){ aktiv.observe(z) });
  }
})();
`;

/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sprache = url.searchParams.get('l') === 'en' ? 'en' : 'de';

  const jetzt = Date.now();
  if (cache.html[sprache] && jetzt - cache.at < TTL * 1000) {
    return antwort(cache.html[sprache]);
  }

  const karte = await loadKarte(env.DB);
  if (!karte || !karte.length) {
    /* Lieber ehrlich verweisen als eine leere Karte zeigen. */
    return new Response(null, { status: 302, headers: { location: '/#karte', 'cache-control': 'no-store' } });
  }

  let stand = null;
  try {
    const r = await env.DB.prepare(`SELECT v FROM settings WHERE k='karte_stand'`).first();
    stand = r?.v || null;
  } catch { /* egal */ }

  const html = seite(karte, sprache, stand);
  if (jetzt - cache.at >= TTL * 1000) cache = { at: jetzt, html: {} };
  cache.html[sprache] = html;
  return antwort(html);
}

const antwort = html => new Response(html, {
  headers: {
    'content-type': 'text/html; charset=utf-8',
    /* Eine Minute frisch, danach darf der Zwischenspeicher kurz altbacken
       ausliefern, während im Hintergrund neu geholt wird. Am Tisch zählt,
       dass die Seite sofort da ist. */
    'cache-control': 'public, max-age=60, stale-while-revalidate=600',
  },
});
