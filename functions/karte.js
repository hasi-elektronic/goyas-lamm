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
import { jsonBlock } from './_lib/warenui.js';
import {
  ALLERGENE, ZUSATZSTOFFE, MARKEN,
  allergenListe, zusatzListe, markenListe, allergenKurz, zusatzKurz, istFreigegeben,
} from './_lib/kennzeichnung.js';

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
    mehr: 'Details ansehen',
    schliessen: 'Schließen',
    allergene: 'Allergene',
    zusatz: 'Zusatzstoffe',
    herkunft: 'Herkunft',
    reifung: 'Reifung',
    garstufe: 'Empfehlung',
    wein: 'Dazu passt',
    geschichte: 'Aus unserer Küche',
    keineKennz: 'Für dieses Gericht ist die Kennzeichnung noch nicht hinterlegt. '
              + 'Fragen Sie uns bitte — wir sagen Ihnen genau, was drin ist.',
    ohneAllergen: 'Enthält keines der 14 kennzeichnungspflichtigen Allergene.',
    ohneZusatz: 'Ohne kennzeichnungspflichtige Zusatzstoffe.',
    legende: 'Was die Buchstaben und Zahlen bedeuten',
    legendeHinweis: 'Buchstaben stehen für die 14 kennzeichnungspflichtigen Allergene, '
                  + 'Zahlen für Zusatzstoffe. Steht bei einem Gericht nichts, ist die '
                  + 'Kennzeichnung noch nicht hinterlegt — fragen Sie uns bitte.',
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
    mehr: 'View details',
    schliessen: 'Close',
    allergene: 'Allergens',
    zusatz: 'Additives',
    herkunft: 'Origin',
    reifung: 'Ageing',
    garstufe: 'We recommend',
    wein: 'Goes well with',
    geschichte: 'From our kitchen',
    keineKennz: 'Labelling for this dish is not on file yet. Please ask us — '
              + 'we will tell you exactly what is in it.',
    ohneAllergen: 'Contains none of the 14 allergens subject to declaration.',
    ohneZusatz: 'No additives subject to declaration.',
    legende: 'What the letters and numbers mean',
    legendeHinweis: 'Letters stand for the 14 allergens subject to declaration, '
                  + 'numbers for additives. Where a dish shows nothing, the labelling '
                  + 'is not on file yet — please ask us.',
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
/* Nicht auf .gericht einschränken: dieselbe Marke sitzt auch auf dem Bild in
   der Detailtafel, und dort hing sie sonst unformatiert am linken Rand. */
.echt{position:absolute;top:.5rem;left:.5rem;z-index:2;
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

/* ---------- Kennzeichen am Gericht ---------- */
/* Buchstaben und Zahlen stehen fest im HTML, nicht erst in der Tafel. Zwei
   Gründe: Zusatzstoffe müssen schriftlich kenntlich sein, und ohne
   JavaScript wäre die Angabe sonst weg. Die Tafel erklärt sie nur schöner. */
.kennz{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.1rem}
.kennz .code{font-size:.72rem;letter-spacing:.08em;color:var(--gedaempft);
  font-variant-numeric:tabular-nums}
.kennz .marke{font-size:.86rem;line-height:1}
.gericht .mehr{margin-top:.35rem;background:none;border:0;padding:0;font:inherit;
  font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;
  color:var(--gold);cursor:pointer;text-align:left;display:inline-flex;
  align-items:center;gap:.35rem;min-height:32px}
.gericht .mehr::after{content:"›";font-size:1.1em;line-height:1}
.gericht .mehr:hover{color:var(--creme)}

/* ---------- Detailtafel ---------- */
/* Kein Blatt mehr, das von unten einfährt und die halbe Karte stehen lässt.
   Die Tafel übernimmt den Bildschirm ganz: Der Grund blendet dunkel auf, die
   Tafel kommt aus einer Spur zu groß zur Ruhe, und das Bild fährt dabei
   langsam aus der Vergrößerung zurück — die Bewegung, mit der im Kino eine
   Einstellung steht. Der Text setzt sich Block für Block darunter.
   Insgesamt eine knappe halbe Sekunde; wer prefers-reduced-motion gesetzt
   hat, bekommt die Tafel ohne jede Bewegung. */
dialog.tafel{border:0;padding:0;background:transparent;max-width:100%;max-height:100%;
  width:100%;height:100%;margin:0;overflow:visible;color:var(--creme)}
dialog.tafel::backdrop{background:rgba(6,5,4,.88);backdrop-filter:blur(6px)}
.js dialog.tafel[open]::backdrop{animation:tafelGrund .3s ease both}
@keyframes tafelGrund{from{opacity:0}to{opacity:1}}
.tafel-innen{position:fixed;inset:0;overflow-y:auto;overscroll-behavior:contain;
  background:var(--nacht-2);
  padding-bottom:calc(2.4rem + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling:touch;
  /* Die Rollleiste am rechten Rand der Tafel wird ausgeblendet: Sie schnitt eine
     helle Kante in das Bild, das bis an den Rand laeuft. Gerollt wird weiter,
     mit Finger, Rad und Tastatur. */
  scrollbar-width:none;-ms-overflow-style:none}
.tafel-innen::-webkit-scrollbar{width:0;height:0;display:none}
.js dialog.tafel[open] .tafel-innen{animation:tafelAuf .42s cubic-bezier(.16,.84,.28,1) both}
@keyframes tafelAuf{from{opacity:0;transform:scale(1.025)}to{opacity:1;transform:none}}
.js dialog.tafel.zu[open] .tafel-innen{animation:tafelWeg .2s ease both}
@keyframes tafelWeg{to{opacity:0;transform:scale(.99)}}
.tafel-zu{position:fixed;top:calc(.9rem + env(safe-area-inset-top));right:.9rem;z-index:4;
  width:40px;height:40px;
  border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(11,10,8,.55);
  backdrop-filter:blur(8px);
  color:var(--creme);font:inherit;font-size:1.05rem;line-height:1;cursor:pointer;
  display:grid;place-items:center}
.tafel-zu:hover{border-color:var(--gold);color:var(--gold)}
/* Das Bild läuft bis unter den Text aus, statt als Kachel mit Abstand darüber
   zu stehen. Der Verlauf am Fuß ist das, was den Übergang weich macht. */
.tafel-bild{aspect-ratio:3/2;overflow:hidden;background:#0F0D0C;margin:0;
  position:relative}
.tafel-bild::after{content:"";position:absolute;inset:auto 0 -1px 0;height:42%;
  background:linear-gradient(180deg,rgba(17,15,13,0),var(--nacht-2))}
.tafel-bild img{width:100%;height:100%;object-fit:cover}
.js dialog.tafel[open] .tafel-bild img{animation:tafelBild 1.2s cubic-bezier(.2,.7,.2,1) both}
@keyframes tafelBild{from{transform:scale(1.1)}to{transform:none}}
.tafel-bild + .tafel-koerper{margin-top:-2.6rem;position:relative;z-index:1}
.js dialog.tafel[open] .tafel-koerper > *{animation:tafelZeile .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes tafelZeile{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(1){animation-delay:.08s}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(2){animation-delay:.13s}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(3){animation-delay:.18s}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(4){animation-delay:.23s}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(5){animation-delay:.28s}
.js dialog.tafel[open] .tafel-koerper > *:nth-child(n+6){animation-delay:.32s}
/* Auf dem großen Bild darf die Marke etwas mehr Luft und Größe haben als auf
   einer 112px-Vorschau. */
.tafel-bild .echt{top:.8rem;left:.8rem;font-size:.62rem;padding:.22rem .6rem}
/* Ohne Bild beginnt die Tafel oben — dann braucht der Kopf Platz, sonst steht
   er unter dem Schließen-Knopf. */
.tafel-koerper{width:min(100% - 2.4rem,700px);margin-inline:auto;padding-top:4.2rem}
.tafel-bild + .tafel-koerper{padding-top:0}
.tafel-kopf{display:flex;align-items:baseline;gap:1rem;margin-bottom:.5rem}
.tafel-kopf h2{font-family:var(--serif);font-weight:400;font-size:1.7rem;line-height:1.15;
  margin:0;flex:1;min-width:0}
.tafel-kopf .preis{font-size:1.05rem;font-weight:700;color:var(--gold);white-space:nowrap;
  font-variant-numeric:tabular-nums}
.tafel-kopf .preis span{display:block;font-size:.8rem;font-weight:400;color:var(--gedaempft);
  text-align:right;line-height:1.45}
.tafel-lead{color:#B4AAA0;margin:0 0 1.4rem;line-height:1.55}
.tafel-marken{display:flex;gap:.45rem;flex-wrap:wrap;margin:0 0 1.4rem}
.tafel-marken span{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;
  font-weight:700;color:var(--creme);border:1px solid var(--rand);border-radius:100px;
  padding:.32rem .7rem;display:inline-flex;align-items:center;gap:.35rem}
.block{border-top:1px solid var(--rand);padding:1.1rem 0}
.block:first-of-type{border-top:0}
.block h3{font-size:.66rem;letter-spacing:.22em;text-transform:uppercase;font-weight:700;
  color:var(--gold);margin:0 0 .5rem}
.block p{margin:0;line-height:1.6}
.block ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.3rem}
.block li{display:flex;gap:.7rem;line-height:1.5}
.block li b{color:var(--gold);font-weight:700;min-width:1.6rem;font-variant-numeric:tabular-nums}
.block .leer{color:var(--gedaempft)}
.tafel-hinweis{color:var(--gedaempft);font-size:.86rem;line-height:1.6;
  border-top:1px solid var(--rand);padding:1.1rem 0 0;margin:0}

/* ---------- Legende ---------- */
.legende{border-top:1px solid var(--rand);padding:2.4rem 0 0;margin-top:2.4rem}
.legende h2{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;font-weight:700;
  color:var(--gold);margin:0 0 .8rem}
.legende > p{color:var(--gedaempft);font-size:.86rem;line-height:1.6;margin:0 0 1.4rem;
  max-width:62ch}
.legende-spalten{display:grid;gap:1.6rem}
.legende ul{margin:0;padding:0;list-style:none;
  columns:2;column-gap:1.6rem;font-size:.84rem;line-height:1.7;color:#B4AAA0}
.legende li{break-inside:avoid}
.legende li b{color:var(--gold);font-weight:700}
.legende h3{font-size:.64rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gedaempft);margin:0 0 .5rem;font-weight:700}

@media(min-width:620px){
  /* Am Rechner ist Vollbild zu viel — dort steht die Tafel als Karte in der
     Mitte und kommt aus derselben leichten Vergrößerung zur Ruhe. */
  .tafel-innen{inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);
    width:min(100% - 3rem,760px);max-height:92svh;border-radius:22px;
    border:1px solid var(--rand);box-shadow:0 40px 100px -30px rgba(0,0,0,.95);
    padding-bottom:2.4rem}
  .tafel-zu{position:absolute;top:.9rem;right:.9rem}
  .js dialog.tafel[open] .tafel-innen{animation:tafelAuf2 .42s cubic-bezier(.16,.84,.28,1) both}
  @keyframes tafelAuf2{from{opacity:0;transform:translate(-50%,-47%) scale(.97)}
                       to{opacity:1;transform:translate(-50%,-50%)}}
  .js dialog.tafel.zu[open] .tafel-innen{animation:tafelWeg2 .2s ease both}
  @keyframes tafelWeg2{to{opacity:0;transform:translate(-50%,-50%) scale(.985)}}
  .legende-spalten{grid-template-columns:1fr 1fr;gap:2.4rem}
  .legende ul{columns:1}
}
@media(prefers-reduced-motion:reduce){
  .js dialog.tafel[open]::backdrop,
  .js dialog.tafel[open] .tafel-innen,
  .js dialog.tafel.zu[open] .tafel-innen,
  .js dialog.tafel[open] .tafel-bild img,
  .js dialog.tafel[open] .tafel-koerper > *{animation:none}
}

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

/** Sprachfassung eines Feldes, mit Rückfall auf Deutsch. */
const feld = (i, name, sprache) =>
  (sprache === 'en' ? (i[name + '_en'] || i[name]) : i[name]) || null;

/**
 * Hat das Gericht überhaupt etwas zu erzählen?
 * Ohne Inhalt keinen Knopf zeigen — ein „Details ansehen", hinter dem nichts
 * steht, ist ärgerlicher als gar keiner.
 */
const hatDetails = i => !!(istFreigegeben(i) || i.herkunft || i.reifung
  || i.garstufe || i.wein || i.geschichte || markenListe(i.marken).length);

function gerichtHtml(i, sprache, gross) {
  const name = (sprache === 'en' && i.name_en) || i.name;
  const beschr = sprache === 'en' ? (i.descr_en || i.descr) : i.descr;
  const bild = i.bild || null;
  const t = T[sprache];

  /* Kennzeichen fest im HTML, nicht erst in der Tafel: Zusatzstoffe müssen
     schriftlich kenntlich sein, und ohne JavaScript wäre die Angabe sonst
     verschwunden. Die Tafel schreibt sie nur aus. */
  const al = istFreigegeben(i) ? allergenListe(i.allergene) : [];
  const zu = istFreigegeben(i) ? zusatzListe(i.zusatz) : [];
  const mk = markenListe(i.marken);
  const codes = [al.length ? allergenKurz(al) : '', zu.length ? zusatzKurz(zu) : '']
    .filter(Boolean).join(' · ');

  return `<article class="gericht auf${bild ? ' mitbild' : ''}${bild && gross ? ' gross' : ''}">
    ${bild ? `<div class="bild">${ECHTE_FOTOS.has(bild)
        ? `<span class="echt">${esc(t.echt)}</span>` : ''}${bildTag(bild, gross)}</div>` : ''}
    <div class="txt">
      <div class="zeile"><h4>${esc(name)}</h4>${preisHtml(i.price)}</div>
      ${beschr ? `<p class="beschreibung">${esc(beschr)}</p>` : ''}
      ${codes || mk.length ? `<div class="kennz">
        ${mk.map(k => `<span class="marke" title="${esc(MARKEN[k][sprache])}"
          >${MARKEN[k].zeichen}</span>`).join('')}
        ${codes ? `<span class="code">${esc(codes)}</span>` : ''}
      </div>` : ''}
      ${hatDetails(i) ? `<button type="button" class="mehr" data-gericht="${esc(i.id)}"
        >${esc(t.mehr)}</button>` : ''}
    </div>
  </article>`;
}

/**
 * Was die Tafel je Gericht braucht — als JSON in der Seite.
 *
 * Bewusst nicht per Nachladen: Es sind ein paar Kilobyte für die ganze Karte,
 * und am Tisch mit schwachem Mobilfunk ist eine Tafel, die sofort aufgeht,
 * mehr wert als ein paar gesparte Bytes.
 */
function tafelDaten(karte, sprache) {
  const aus = {};
  for (const tab of karte) {
    for (const g of tab.groups) {
      for (const i of g.items) {
        if (!i.active || !hatDetails(i)) continue;
        aus[i.id] = {
          n: (sprache === 'en' && i.name_en) || i.name,
          b: feld(i, 'descr', sprache),
          p: String(i.price || '').split('\n').map(x => x.trim()).filter(Boolean),
          bild: i.bild || null,
          echt: i.bild ? ECHTE_FOTOS.has(i.bild) : false,
          ok: istFreigegeben(i) ? 1 : 0,
          al: istFreigegeben(i) ? allergenListe(i.allergene) : [],
          zu: istFreigegeben(i) ? zusatzListe(i.zusatz) : [],
          mk: markenListe(i.marken),
          hk: feld(i, 'herkunft', sprache),
          rf: feld(i, 'reifung', sprache),
          gs: feld(i, 'garstufe', sprache),
          w: i.wein || null,
          gh: feld(i, 'geschichte', sprache),
        };
      }
    }
  }
  return aus;
}

/**
 * Die Legende am Fuß — erklärt jeden Buchstaben und jede Zahl.
 *
 * Erscheint erst, wenn mindestens ein Gericht eine freigegebene Kennzeichnung
 * hat. Eine Tabelle, die Zeichen erklärt, die auf der ganzen Karte nirgends
 * vorkommen, ist keine Hilfe, sondern Beiwerk.
 */
function legendeHtml(sprache, karte) {
  const t = T[sprache];
  const gibtKennzeichnung = karte.some(tab => tab.groups.some(g =>
    g.items.some(i => i.active && istFreigegeben(i))));
  if (!gibtKennzeichnung) return '';
  return `<section class="legende auf">
    <h2>${esc(t.legende)}</h2>
    <p>${esc(t.legendeHinweis)}</p>
    <div class="legende-spalten">
      <div>
        <h3>${esc(t.allergene)}</h3>
        <ul>${Object.entries(ALLERGENE).map(([k, v]) =>
          `<li><b>${k.toUpperCase()}</b> ${esc(v[sprache])}</li>`).join('')}</ul>
      </div>
      <div>
        <h3>${esc(t.zusatz)}</h3>
        <ul>${Object.entries(ZUSATZSTOFFE).map(([k, v]) =>
          `<li><b>${k}</b> ${esc(v[sprache])}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
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
  /* Zuerst zählt der Stern aus /admin/karte: Gökhan entscheidet, welches
     Gericht seiner Gruppe groß erscheint. Vorher steuerte der Stern die
     Auswahl auf der Startseite; seit dort drei Spezialitäten mit eigenen
     Texten stehen, hat er hier seine Aufgabe — an der Stelle, die der Gast
     tatsächlich liest. */
  const grossId = (gerichte.find(i => i.highlight && i.bild)
    || gerichte.find(i => i.bild && ECHTE_FOTOS.has(i.bild))
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

<main>${koerper}
  <div class="wrap">${legendeHtml(sprache, karte)}</div>
</main>

<dialog class="tafel" id="tafel" aria-label="${esc(t.mehr)}">
  <div class="tafel-innen">
    <button type="button" class="tafel-zu" id="tafelZu"
      aria-label="${esc(t.schliessen)}">✕</button>
    <div id="tafelInhalt"></div>
  </div>
</dialog>

<script type="application/json" id="tafeldaten">${jsonBlock({
  g: tafelDaten(karte, sprache),
  a: Object.fromEntries(Object.entries(ALLERGENE).map(([k, v]) => [k, v[sprache]])),
  z: Object.fromEntries(Object.entries(ZUSATZSTOFFE).map(([k, v]) => [k, v[sprache]])),
  m: Object.fromEntries(Object.entries(MARKEN).map(([k, v]) => [k, [v.zeichen, v[sprache]]])),
  t: {
    allergene: t.allergene, zusatz: t.zusatz, herkunft: t.herkunft, reifung: t.reifung,
    garstufe: t.garstufe, wein: t.wein, geschichte: t.geschichte, echt: t.echt,
    keineKennz: t.keineKennz, ohneAllergen: t.ohneAllergen, ohneZusatz: t.ohneZusatz,
  },
})}</script>

<footer class="fuss">
  <div class="wrap">
    <div class="tasten">
      <a class="taste" href="${HOUSE.site}/reservieren">${esc(t.reservieren)}</a>
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

  /* --- Detailtafel ------------------------------------------------- */
  var D = {}; try { D = JSON.parse(document.getElementById('tafeldaten').textContent) || {}; } catch(e) {}
  var tafel = document.getElementById('tafel');
  var inhalt = document.getElementById('tafelInhalt');
  var zurueckZu = null;

  function h(s){ return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  function block(titel, innen){
    return '<div class="block"><h3>' + h(titel) + '</h3>' + innen + '</div>';
  }

  function bau(g){
    var t = D.t || {}, s = '';

    if (g.bild) {
      s += '<div class="tafel-bild">'
        + (g.echt ? '<span class="echt">' + h(t.echt) + '</span>' : '')
        + '<picture>'
        + '<source type="image/webp" srcset="/assets/karte/' + h(g.bild) + '-900.webp 900w, '
        + '/assets/karte/' + h(g.bild) + '-1400.webp 1400w" sizes="(min-width:620px) 720px, 100vw">'
        + '<img src="/assets/karte/' + h(g.bild) + '-900.jpg" alt="" width="900" height="600">'
        + '</picture></div>';
    }

    s += '<div class="tafel-koerper">';
    s += '<div class="tafel-kopf"><h2>' + h(g.n) + '</h2>';
    if (g.p && g.p.length) {
      s += '<div class="preis">' + h(g.p[0])
        + g.p.slice(1).map(function(z){ return '<span>' + h(z) + '</span>' }).join('')
        + '</div>';
    }
    s += '</div>';
    if (g.b) s += '<p class="tafel-lead">' + h(g.b) + '</p>';

    if (g.mk && g.mk.length) {
      s += '<div class="tafel-marken">' + g.mk.map(function(k){
        var m = (D.m || {})[k] || ['', k];
        return '<span>' + m[0] + ' ' + h(m[1]) + '</span>';
      }).join('') + '</div>';
    }

    /* Erzählung zuerst — das ist der Grund, warum jemand tippt. */
    if (g.hk) s += block(t.herkunft, '<p>' + h(g.hk) + '</p>');
    if (g.rf) s += block(t.reifung, '<p>' + h(g.rf) + '</p>');
    if (g.gs) s += block(t.garstufe, '<p>' + h(g.gs) + '</p>');
    if (g.w)  s += block(t.wein, '<p>' + h(g.w) + '</p>');
    if (g.gh) s += block(t.geschichte, '<p>' + h(g.gh) + '</p>');

    /* Kennzeichnung. Nur wenn die Küche freigegeben hat — sonst der Hinweis,
       dass man fragen soll. Eine leere Liste ohne Freigabe würde wie „enthält
       nichts" aussehen, und das wäre die gefährlichste Fehlanzeige von allen. */
    if (g.ok) {
      s += block(t.allergene, g.al.length
        ? '<ul>' + g.al.map(function(k){
            return '<li><b>' + k.toUpperCase() + '</b> ' + h((D.a || {})[k] || k) + '</li>';
          }).join('') + '</ul>'
        : '<p class="leer">' + h(t.ohneAllergen) + '</p>');
      s += block(t.zusatz, g.zu.length
        ? '<ul>' + g.zu.map(function(n){
            return '<li><b>' + n + '</b> ' + h((D.z || {})[n] || n) + '</li>';
          }).join('') + '</ul>'
        : '<p class="leer">' + h(t.ohneZusatz) + '</p>');
    } else {
      s += '<p class="tafel-hinweis">' + h(t.keineKennz) + '</p>';
    }

    s += '</div>';
    return s;
  }

  function oeffne(id){
    var g = (D.g || {})[id];
    if (!g || !tafel) return;
    inhalt.innerHTML = bau(g);
    var innen = tafel.querySelector('.tafel-innen');
    if (innen) innen.scrollTop = 0;
    if (tafel.showModal) tafel.showModal(); else tafel.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
  }

  /* Zugehen darf man sehen. Ohne die kurze Rückblende springt die Tafel weg
     und die Karte darunter erscheint schlagartig — genau der Bruch, den das
     Aufblenden vermeidet. Wer keine Bewegung will, bekommt sie auch hier nicht. */
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var schliesst = false;

  function zuMachen(){
    schliesst = false;
    if (tafel.classList) tafel.classList.remove('zu');
    if (tafel.close) tafel.close(); else tafel.removeAttribute('open');
  }

  function schliesse(){
    if (!tafel || schliesst) return;
    if (ruhig || !tafel.classList) { zuMachen(); return; }
    schliesst = true;
    tafel.classList.add('zu');
    setTimeout(zuMachen, 190);
  }

  document.addEventListener('click', function(e){
    var k = e.target.closest ? e.target.closest('[data-gericht]') : null;
    if (k) { zurueckZu = k; oeffne(k.dataset.gericht); return; }
    /* Klick auf den abgedunkelten Rand schließt — das dialog-Element meldet
       den Klick auf sich selbst, nicht auf den Inhalt darin. */
    if (e.target === tafel) schliesse();
  });

  var zu = document.getElementById('tafelZu');
  if (zu) zu.addEventListener('click', schliesse);

  /* Escape schließt das <dialog> von selbst und sofort. Wir fangen das ab,
     damit auch dieser Weg dieselbe Rückblende bekommt. */
  if (tafel) tafel.addEventListener('cancel', function(e){
    if (ruhig || schliesst) return;
    e.preventDefault();
    schliesse();
  });

  if (tafel) tafel.addEventListener('close', function(){
    document.body.style.overflow = '';
    if (tafel.classList) tafel.classList.remove('zu');
    /* Zurück auf den Knopf, von dem aus geöffnet wurde — sonst steht der
       Fokus am Seitenanfang und man scrollt sich neu zurecht. */
    if (zurueckZu && zurueckZu.focus) { zurueckZu.focus(); zurueckZu = null; }
  });
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
