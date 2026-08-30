/** Gemeinsames Layout und Bausteine für den Admin-Bereich. */
import { esc, formatDateDE, nowBerlin, WEEKDAY_DE, weekday } from './core.js';
import { darfSeite, darfPersonendaten, kuerzeName, ROLLEN } from './auth.js';
import { FANFARE_CSS, fanfareMarkup, tonSchalter } from './fanfare.js';
import { ZEITDIALOG_CSS } from './zeitdialog.js';
import { WARE_CSS } from './warenui.js';

export const CSS = `
:root{
  --wine:#6D1826;--wine-d:#4E101C;--ink:#14120F;--ink-2:#241f1b;
  --cream:#F4F7EA;--paper:#FBFAF3;--sand:#E4DED0;--gold:#C0A062;--muted:#6E675A;
  --ok:#2E6B4F;--warn:#9A6212;--r:2px;
}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--cream);color:var(--ink);
  font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:var(--wine)}
img{display:block;max-width:100%}

/* Kopf */
.top{background:var(--ink);color:var(--cream);position:sticky;top:0;z-index:40}
.top .in{width:min(100% - 1.6rem,1180px);margin-inline:auto;display:flex;align-items:center;
  justify-content:space-between;gap:1rem;padding:.7rem 0}
.top .brand{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:inherit}
.top .brand img{height:34px;width:auto}
.top .brand b{font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);
  font-weight:700;border-left:1px solid rgba(244,247,234,.22);padding-left:.75rem}
.top .out{color:rgba(244,247,234,.6);text-decoration:none;font-size:.72rem;letter-spacing:.14em;
  text-transform:uppercase;border:1px solid rgba(244,247,234,.22);padding:.45rem .8rem}
.top .out:hover{background:rgba(244,247,234,.1);color:#fff}
.top .wer{display:flex;align-items:center;gap:.7rem;min-width:0}
.top .wer .nm{font-size:.82rem;color:rgba(244,247,234,.72);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:34vw}
.top .wer .ro{font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  color:var(--ink);background:var(--gold);padding:.16rem .4rem;border-radius:2px;white-space:nowrap}
.demobar{background:var(--gold);color:var(--ink);text-align:center;font-size:.72rem;
  letter-spacing:.12em;text-transform:uppercase;font-weight:700;padding:.45rem .8rem}
/* kein overflow — sonst schneidet die Leiste das Klappmenü ab; bei sehr schmalen
   Fenstern bricht sie stattdessen um (unter 720px ist sie ohnehin ausgeblendet) */
nav.tabs{background:var(--ink-2);position:sticky;top:47px;z-index:39}
nav.tabs::-webkit-scrollbar{display:none}
nav.tabs .in{width:min(100% - 1.6rem,1180px);margin-inline:auto;display:flex;gap:.15rem;flex-wrap:wrap}
nav.tabs a{color:rgba(244,247,234,.62);text-decoration:none;padding:.85rem 1rem;white-space:nowrap;
  font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;border-bottom:2px solid transparent}
nav.tabs a:hover{color:#fff}
nav.tabs a.on{color:#fff;border-bottom-color:var(--gold)}
nav.tabs details.tmehr{position:relative}
nav.tabs details.tmehr summary{list-style:none;cursor:pointer;color:rgba(244,247,234,.62);
  padding:.85rem 1rem;white-space:nowrap;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:600;border-bottom:2px solid transparent}
nav.tabs details.tmehr summary::-webkit-details-marker{display:none}
nav.tabs details.tmehr summary::after{content:" ▾";font-size:.7em}
nav.tabs details.tmehr summary:hover{color:#fff}
nav.tabs details.tmehr summary.on{color:#fff;border-bottom-color:var(--gold)}
nav.tabs details.tmehr .tliste{position:absolute;top:100%;left:0;z-index:60;min-width:210px;
  background:var(--paper);border:1px solid var(--sand);box-shadow:0 14px 30px -16px rgba(0,0,0,.5)}
nav.tabs details.tmehr .tliste a{display:block;color:var(--ink);padding:.7rem 1rem;
  border-bottom:1px solid var(--sand);text-transform:none;letter-spacing:normal;font-size:.9rem}
nav.tabs details.tmehr .tliste a:last-child{border-bottom:0}
nav.tabs details.tmehr .tliste a:hover{background:var(--cream);color:var(--wine)}
nav.tabs details.tmehr .tliste a.on{color:var(--wine)}

main{width:min(100% - 1.6rem,1180px);margin:1.6rem auto 5rem}
h1{font-size:1.45rem;margin:0 0 .2rem;letter-spacing:-.01em}
h2{font-size:1.05rem;margin:0 0 .9rem}
.sub{color:var(--muted);font-size:.88rem;margin:0 0 1.5rem}

/* Kacheln */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:.7rem;margin-bottom:1.6rem}
.stat{background:var(--paper);border:1px solid var(--sand);padding:.95rem 1.1rem}
.stat b{display:block;font-size:1.85rem;line-height:1.05;font-variant-numeric:tabular-nums}
.stat span{font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.stat.hot b{color:var(--wine)}

/* Abschnittsüberschrift auf der Übersicht. Ohne sie stünden Zahlenkacheln,
   Bereichskacheln und Tagesliste als eine einzige graue Fläche untereinander. */
h2.abschnitt{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);
  margin:2rem 0 .8rem}
h2.abschnitt:first-of-type{margin-top:0}

/* Bereichskacheln — eine je Modul, jede beantwortet „muss ich da heute hin?" */
.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(226px,1fr));gap:.7rem;margin-bottom:1.6rem}
.mod{display:flex;flex-direction:column;gap:.28rem;background:var(--paper);border:1px solid var(--sand);
  padding:.95rem 1.1rem;text-decoration:none;color:inherit}
.mod:hover{border-color:var(--wine)}
.mod .mt{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
.mod b{font-size:1.12rem;line-height:1.25}
.mod b .leer{font-weight:400;color:var(--muted);font-size:.95rem}
.mod .ms{font-size:.83rem;color:var(--muted);line-height:1.45}
.mod.warn{border-left:3px solid var(--gold)}
.mod.warn b{color:var(--warn)}
.mod.gut b{color:var(--ok)}

.card{background:var(--paper);border:1px solid var(--sand);margin-bottom:1.3rem}
.card > h2{margin:0;font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;
  padding:.8rem 1.1rem;border-bottom:1px solid var(--sand);background:var(--cream);
  display:flex;justify-content:space-between;align-items:center;gap:1rem}
.card > h2 em{font-style:normal;color:var(--muted);font-weight:400;letter-spacing:.04em;text-transform:none;font-size:.82rem}
.card .body{padding:1.1rem}
details.card > summary{margin:0;font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;
  padding:.8rem 1.1rem;background:var(--cream);cursor:pointer;list-style:none;
  display:flex;justify-content:space-between;align-items:center;gap:1rem;font-weight:700}
details.card > summary::-webkit-details-marker{display:none}
details.card > summary::after{content:"▾";font-size:.8em;color:var(--muted)}
details.card[open] > summary{border-bottom:1px solid var(--sand)}
details.card[open] > summary::after{content:"▴"}
details.card > summary:hover{color:var(--wine)}
.empty{padding:2.2rem 1.1rem;text-align:center;color:var(--muted)}

/* Tabelle */
table{width:100%;border-collapse:collapse}
th,td{padding:.7rem 1.1rem;text-align:left;border-bottom:1px solid var(--sand);vertical-align:top}
th{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:var(--cream)}
td.t{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
td.g{font-weight:700;color:var(--wine);white-space:nowrap}
td.act{text-align:right;white-space:nowrap}
tr.cancelled{opacity:.5}
.gastnote{color:var(--warn);font-size:.82rem}
tr.cancelled td.t,tr.cancelled td.nm{text-decoration:line-through}
.nm a{text-decoration:none;color:inherit;font-weight:600}
.nm a:hover{color:var(--wine)}
.meta{color:var(--muted);font-size:.84rem}
.show-s{display:none}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
  background:var(--wine);color:#fff;border:1px solid var(--wine);border-radius:var(--r);
  padding:.7rem 1.15rem;font:inherit;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;text-decoration:none;cursor:pointer;transition:.18s}
.btn:hover{background:var(--wine-d);border-color:var(--wine-d);color:#fff}
.btn.ghost{background:none;color:var(--ink);border-color:var(--sand)}
.btn.ghost:hover{background:var(--ink);border-color:var(--ink);color:var(--cream)}
.btn.sm{padding:.42rem .75rem;font-size:.65rem}
.btn.danger{background:none;color:var(--muted);border-color:var(--sand)}
.btn.danger:hover{background:var(--wine);border-color:var(--wine);color:#fff}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.row.end{justify-content:flex-end}
.spacer{flex:1}

/* Formular */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem 1.1rem}
.f{min-width:0}
.f.full{grid-column:1 / -1}
.f label{display:block;font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin-bottom:.32rem}
.f input,.f select,.f textarea{width:100%;min-width:0;font:inherit;color:var(--ink);background:#fff;
  border:1px solid var(--sand);border-radius:var(--r);padding:.68rem .8rem}
.f textarea{min-height:74px;resize:vertical}
.f input:focus,.f select:focus,.f textarea:focus{outline:0;border-color:var(--wine);
  box-shadow:0 0 0 3px rgba(109,24,38,.1)}
.f .hint{font-size:.78rem;color:var(--muted);margin:.3rem 0 0}
.f label.check,label.check{display:flex!important;align-items:flex-start;gap:.6rem;margin:.2rem 0 .5rem;
  font-size:.92rem;font-weight:400;letter-spacing:normal;text-transform:none;color:var(--ink)}
.check input{width:18px;height:18px;margin-top:.15rem;accent-color:var(--wine);flex:0 0 auto}
.check span{padding-top:.05rem}

/* Zugangsdaten */
.geheim{border-top:1px solid var(--sand);border-bottom:1px solid var(--sand)}
.geheim div{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
  padding:.75rem 0;border-bottom:1px dotted var(--sand)}
.geheim div:last-child{border-bottom:0}
.geheim span{font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.geheim b{font-size:1.25rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  user-select:all;word-break:break-all;text-align:right}

/* Meldungen */
.msg{padding:.85rem 1.1rem;border-left:3px solid var(--ok);background:#EDF5F0;
  margin-bottom:1.2rem;font-size:.92rem}
.msg.err{border-left-color:var(--wine);background:#F8EEF0}
.msg.warn{border-left-color:var(--gold);background:#FBF5E8}

/* Belegung */
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:.5rem}
.slot{border:1px solid var(--sand);background:#fff;padding:.6rem .7rem;text-decoration:none;color:inherit;display:block}
.slot:hover{border-color:var(--wine)}
.slot b{display:block;font-variant-numeric:tabular-nums;font-size:1rem}
.slot span{font-size:.72rem;color:var(--muted)}
.slot .bar{height:4px;background:var(--sand);margin-top:.45rem;position:relative;overflow:hidden}
.slot .bar i{position:absolute;inset:0 auto 0 0;background:var(--wine)}
.slot.full .bar i{background:var(--warn)}

/* Kalender */
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:.35rem}
.cal .hd{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
  text-align:center;font-weight:700;padding:.3rem 0}
.cal a,.cal div.d{background:#fff;border:1px solid var(--sand);min-height:74px;padding:.45rem .5rem;
  text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:.15rem}
.cal a:hover{border-color:var(--wine)}
.cal .num{font-weight:700;font-variant-numeric:tabular-nums;font-size:.9rem}
.cal .cnt{font-size:.72rem;color:var(--wine);font-weight:700}
.cal .zu{font-size:.68rem;color:var(--muted)}
.cal .off{background:var(--cream);opacity:.55}
.cal .today{border-color:var(--wine);box-shadow:inset 0 0 0 1px var(--wine)}

/* Balken — bewusst eine einzige Farbe je Diagramm: es ist jeweils eine Messreihe,
   da braucht es weder Legende noch Farbcodierung. */
.bars{display:flex;flex-direction:column;gap:.45rem}
.bar{display:grid;grid-template-columns:6.4rem 1fr auto;align-items:center;gap:.7rem}
.bar .bl{font-size:.82rem;color:var(--muted);text-align:right;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.bar .bt{background:var(--sand);border-radius:2px;height:20px;position:relative;overflow:hidden}
.bar .bt i{position:absolute;inset:0 auto 0 0;background:var(--wine);
  border-radius:0 4px 4px 0;transition:width .4s cubic-bezier(.2,.6,.2,1)}
.bar .bv{font-size:.9rem;font-weight:700;font-variant-numeric:tabular-nums;
  min-width:3.2rem;text-align:right;color:var(--ink)}
.bar .bv em{display:block;font-style:normal;font-size:.72rem;font-weight:400;color:var(--muted)}
.bar.aus .bt i{background:var(--sand)}
.bar.aus .bl,.bar.aus .bv{opacity:.5}
@media(max-width:560px){
  .bar{grid-template-columns:5.2rem 1fr auto;gap:.5rem}
  .bar .bl{font-size:.76rem}
  .bar .bv{min-width:2.8rem;font-size:.84rem}
}

/* Speisekarte */
.ktabs{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:1.3rem}
.ktabs .ktab{display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--ink);
  background:var(--paper);border:1px solid var(--sand);padding:.6rem .9rem;border-radius:2px;
  font-size:.8rem;font-weight:600}
.ktabs .ktab span{font-size:.68rem;color:var(--muted);font-variant-numeric:tabular-nums}
.ktabs .ktab:hover{border-color:var(--wine)}
.ktabs .ktab.on{background:var(--wine);border-color:var(--wine);color:#fff}
.ktabs .ktab.on span{color:rgba(255,255,255,.7)}
.irow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.7fr) minmax(0,.8fr) minmax(0,.4fr) auto;
  gap:.6rem;align-items:end;padding:.8rem 1.1rem .4rem}
.irow .f label{margin-bottom:.2rem}
.irow-act{display:flex;align-items:flex-end;padding-bottom:.05rem}
.irow-sub{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;padding:0 1.1rem .8rem}
tr.cancelled .irow input{background:var(--cream)}

/* Tischzeile */
.trow{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.7fr) minmax(0,1fr) minmax(0,.7fr) auto;
  gap:.7rem;align-items:end;padding:.9rem 1.1rem .5rem}
.trow .f label{margin-bottom:.2rem}
.trow-act{display:flex;align-items:flex-end;padding-bottom:.05rem}
.trow-sub{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:0 1.1rem .9rem}
tr.cancelled .trow input,tr.cancelled .trow select{background:var(--cream)}

.pill{display:inline-block;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;
  font-weight:700;padding:.18rem .45rem;border:1px solid var(--sand);color:var(--muted)}
.pill.web{border-color:#cfd8d0;color:#3d6b52}
.pill.tel{border-color:#e0cfa8;color:#8a6b1f}
.pill.walk{border-color:#d9c9cc;color:var(--wine)}
.pill.ns{border-color:var(--wine);color:#fff;background:var(--wine)}
tr.noshow td.nm a{text-decoration:line-through;text-decoration-color:var(--wine)}

/* Untere Leiste (nur Handy) */
.bnav{display:none}
.sheet-bg{display:none}

@media(max-width:720px){
  nav.tabs{display:none}
  body{padding-bottom:calc(66px + env(safe-area-inset-bottom))}
  .bnav{
    display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:50;
    background:var(--ink);border-top:1px solid rgba(244,247,234,.14);
    padding-bottom:env(safe-area-inset-bottom)}
  .bnav a,.bnav summary{
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.22rem;
    padding:.6rem .2rem .55rem;text-decoration:none;color:rgba(244,247,234,.58);
    font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;
    list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:60px}
  .bnav summary::-webkit-details-marker{display:none}
  .bnav a.on{color:#fff;box-shadow:inset 0 2px 0 var(--gold)}
  .bnav a.plus{color:#fff}
  .bnav a.plus svg{background:var(--wine);border-radius:50%;padding:3px}
  .bnav svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.7;
    stroke-linecap:round;stroke-linejoin:round}
  details.more{position:static}
  details.more[open] > summary{color:#fff}
  details.more .sheet{
    position:fixed;left:0;right:0;bottom:calc(66px + env(safe-area-inset-bottom));z-index:51;
    background:var(--paper);border-top:1px solid var(--sand);
    box-shadow:0 -18px 40px -20px rgba(0,0,0,.5);padding:.4rem 0 .6rem;
    max-height:66vh;overflow-y:auto}
  details.more .sheet a{
    display:flex;flex-direction:row;align-items:center;justify-content:flex-start;
    gap:.85rem;padding:.9rem 1.1rem;text-decoration:none;min-height:0;
    text-transform:none;letter-spacing:normal;
    color:var(--ink);font-size:.98rem;font-weight:600;border-bottom:1px solid var(--sand)}
  details.more .sheet a:last-child{border-bottom:0}
  details.more .sheet a.on{color:var(--wine)}
  /* Gruppenüberschrift im Blatt. Ohne sie wären es wieder einundzwanzig Zeilen
     in einer Reihe — der Zustand, aus dem dieses Menü gerade herauskommt. */
  details.more .sheet .grp{
    padding:1rem 1.1rem .3rem;font-size:.72rem;letter-spacing:.16em;
    text-transform:uppercase;font-weight:700;color:var(--muted)}
  details.more .sheet a svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.7;
    stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto;color:var(--muted)}
  details.more .sheet a.on svg{color:var(--wine)}
  details.more .sheet .ab{color:var(--muted);font-weight:400;font-size:.9rem}
  details.more[open] ~ .sheet-bg,
  details.more[open] .sheet-bg{display:block;position:fixed;inset:0;z-index:49;
    background:rgba(20,18,15,.45)}
  .top .out{display:none}
}

@media(max-width:720px){
  main{margin-top:1.1rem;margin-bottom:1.6rem}
  .irow{grid-template-columns:minmax(0,1fr) minmax(0,.6fr);padding:.7rem .7rem .3rem}
  .irow-act{grid-column:1 / -1}
  .irow-act .btn{width:100%}
  .irow-sub{padding:0 .7rem .7rem}
  .trow{grid-template-columns:minmax(0,1fr) minmax(0,.8fr);padding:.8rem .7rem .4rem}
  .trow-act{grid-column:1 / -1}
  .trow-act .btn{width:100%}
  .trow-sub{padding:0 .7rem .8rem}
  th,td{padding:.6rem .7rem}
  .hide-s{display:none}
  .show-s{display:block}
  .top .brand b{display:none}
  .top .wer .nm{display:none}
  nav.tabs{top:45px}
  table.stack thead{display:none}
  table.stack tbody tr{display:grid;grid-template-columns:auto 1fr auto;gap:.15rem .6rem;
    padding:.7rem .7rem;border-bottom:1px solid var(--sand);align-items:center}
  table.stack tbody td{border:0;padding:0}
  table.stack td.t{grid-column:1;grid-row:1}
  table.stack td.g{grid-column:3;grid-row:1;text-align:right}
  table.stack td.nm{grid-column:2;grid-row:1}
  table.stack td.det{grid-column:1 / -1;grid-row:2}
  table.stack td.act{grid-column:1 / -1;grid-row:3;text-align:left;margin-top:.4rem}
}

/* nur für Screenreader */
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}
${FANFARE_CSS}
${ZEITDIALOG_CSS}
${WARE_CSS}
`;

/* Kleine Strichzeichnungen — inline, damit kein zusätzlicher Request nötig ist. */
const IC = {
  heim:   '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
  liste:  '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
  karte:  '<path d="M4 4.5h7a2 2 0 0 1 2 2V21a1.7 1.7 0 0 0-1.7-1.7H4z"/><path d="M20 4.5h-7a2 2 0 0 0-2 2V21a1.7 1.7 0 0 1 1.7-1.7H20z"/>',
  mehr:   '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  kalender:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  tisch:  '<path d="M3 9h18"/><path d="M6 9v11M18 9v11"/><path d="M5 5h14a2 2 0 0 1 2 2v2H3V7a2 2 0 0 1 2-2z"/>',
  uhr:    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  lupe:   '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  druck:  '<path d="M7 9V3.5h10V9"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  aus:    '<path d="M15 4.5h3.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 8.5 6 12l4 3.5M6 12h9"/>',
  kurve:  '<path d="M3.5 19.5h17"/><path d="M6.5 19.5V13M11 19.5V8.5M15.5 19.5v-4M20 19.5V4.5"/>',
  warte:  '<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5"/><path d="M3.5 8 3.5 12 7.5 12"/><path d="M12 8v4.2l3 1.8"/>',
  stempel:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M9 3h6"/>',
  muenze: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.3a3 3 0 0 0-2.5-1.1c-1.5 0-2.4.8-2.4 1.8 0 2.4 5 1.2 5 3.7 0 1.1-1 1.9-2.6 1.9a3.2 3.2 0 0 1-2.6-1.2"/><path d="M12 6.6v10.8"/>',
  sanduhr:'<path d="M7 3h10M7 21h10"/><path d="M17 3v3.5L12 12l5 5.5V21"/><path d="M7 3v3.5L12 12l-5 5.5V21"/>',
  schluessel:'<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 7-7"/><path d="m14.5 8.5 2 2"/><path d="m16.5 6.5 2 2"/>',
  leute:  '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17.5 14.9c1.9.6 3 2.4 3 4.6"/>',
  kiste:  '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  regal:  '<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.5h17M3.5 15h17"/>',
  etikett:'<path d="M4 4.5h7.2L20 13.3a1.7 1.7 0 0 1 0 2.4l-4.3 4.3a1.7 1.7 0 0 1-2.4 0L4.5 11.2z"/><path d="M8 8h.01"/>',
  zaehl:  '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  beutel: '<path d="M4.5 8.5h15l.9 11.4a1.5 1.5 0 0 1-1.5 1.6H5.1a1.5 1.5 0 0 1-1.5-1.6z"/><path d="M8.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5"/>',
  qr:   '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M13.5 13.5h3v3h-3zM20.5 13.5v3M17.5 20.5h3M13.5 20.5h.01"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* [Pfad, Beschriftung, Icon, kurze Beschriftung für die untere Leiste] */
const NAV = [
  ['/admin',           'Übersicht',         'heim',     'Start'],
  ['/admin/tag',       'Tagesansicht',      'liste',    'Heute'],
  ['/admin/kalender',  'Kalender',          'kalender', 'Kalender'],
  ['/admin/warteliste','Warteliste',        'warte',    'Warte'],
  ['/admin/auswertung','Auswertung',        'kurve',    'Zahlen'],
  ['/admin/neu',       'Neue Reservierung', 'plus',     'Neu'],
  ['/admin/suche',     'Suche',             'lupe',     'Suche'],
  ['/admin/zettel',    'Küchenzettel',      'druck',    'Zettel'],
  ['/admin/karte',     'Speisekarte',       'karte',    'Karte'],
  ['/admin/aufsteller','QR-Aufsteller',     'qr',       'QR'],
  ['/admin/ware',      'Wareneingang',      'kiste',    'Ware'],
  ['/admin/hygiene',   'Hygiene-Kontrolle', 'liste',    'Hygiene'],
  /* Hieß „Lager". Falscher Name: Auf der Seite stehen Lieferanten, Artikel und
     Grenzwerte — ein Bestand entsteht erst mit der Inventur. */
  ['/admin/lager',     'Artikel & Lieferanten', 'regal', 'Artikel'],
  ['/admin/inventur',  'Inventur',          'zaehl',    'Inventur'],
  /* „Preis-Radar" war ein Eigenname, den außerhalb dieses Hauses niemand kennt. */
  ['/admin/preise',    'Einkaufspreise',    'etikett',  'Preise'],
  ['/admin/warenblatt','Kontrollblatt',     'druck',    'Blatt'],
  ['/admin/personal',  'Personal',          'leute',    'Team'],
  ['/admin/dienstplan','Dienstplan',        'kalender', 'Plan'],
  ['/admin/arbeitszeit','Arbeitszeit',      'sanduhr',  'Zeit'],
  /* Es gab zwei „Zettel" — einen für die Küche, einen für die Stunden. */
  ['/admin/zeitzettel','Stundennachweis',   'druck',    'Nachweis'],
  ['/admin/trinkgeld', 'Trinkgeld',         'muenze',   'Trinkgeld'],
  /* Führt auf /zeit — die Adresse bleibt nur wegen alter Lesezeichen bestehen.
     Der Menüpunkt zeigt weiter auf /admin/stempel, damit die Rechteprüfung
     greift: /zeit ist eine offene Seite, /admin/stempel nicht. */
  ['/admin/stempel',   'Stempeluhr öffnen', 'stempel', 'Stempel'],
  ['/admin/rechnung',  'Rechnungen',        'muenze',   'Rechnung'],
  ['/admin/privat',    'Privatkasse',       'beutel',   'Privat'],
  ['/admin/tische',    'Tische',            'tisch',    'Tische'],
  ['/admin/zeiten',    'Schließtage',       'uhr',      'Zeiten'],
  ['/admin/benutzer',  'Benutzer & Rechte', 'schluessel','Zugang'],
];

/**
 * Das Menü in zwei Ebenen.
 *
 * Vorher standen einundzwanzig Punkte nebeneinander in einer flachen Liste —
 * sechs als Reiter, der Rest in einem Sammelklappmenü „Mehr", das nach nichts
 * sortiert war. Vergleichbare Gastro-Backoffices kommen mit acht bis dreizehn
 * Oberpunkten und zwei Ebenen aus; das größte davon (Lightspeed) hat vierzehn
 * bei deutlich mehr Funktionsumfang.
 *
 * Zwei Entscheidungen, die man später hinterfragen wird:
 *
 * **Wareneingang, Artikel, Inventur, Preise und Kontrollblatt liegen unter
 * einem Punkt.** Die spezialisierten Warenwirtschaften trennen Einkauf und
 * Lager (gastronovi, Apicbase, FoodNotify) — das lohnt sich aber erst bei
 * mehreren Lagerorten oder Filialen. Die POS-nahen Systeme für Einzelbetriebe
 * bündeln (Lightspeed „Bestand", SIDES „Warenwirtschaft & Lager"), und ein
 * Haus mit einer Küche ist genau dieser Fall.
 *
 * **„Heute" ist kein eigener Reiter mehr.** Es stand als Reiter direkt neben
 * dem Klappmenü „Gäste", und beides führte zu denselben Reservierungen — beim
 * Draufschauen war nicht zu erkennen, wofür man welches nimmt (Rückmeldung
 * Gökhan, 30.08.2026). Jetzt gibt es einen Oberpunkt **Reservierungen**, und
 * die Tagesansicht ist dessen erster Eintrag.
 *
 * Der eine Klick, den das am Schreibtisch kostet, wird am Handy nicht fällig:
 * Dort liegt „Heute" weiter als eigenes Feld in der unteren Leiste (`UNTEN`),
 * und das ist das Gerät, auf dem die Seite tatsächlich zwanzigmal am Tag
 * aufgeht.
 */
const GRUPPEN = [
  { titel: 'Übersicht', pfad: '/admin' },
  { titel: 'Reservierungen', kinder: ['/admin/tag', '/admin/kalender', '/admin/warteliste',
                                      '/admin/neu', '/admin/suche', '/admin/zettel',
                                      '/admin/auswertung'] },
  { titel: 'Speisekarte', kinder: ['/admin/karte', '/admin/aufsteller'] },
  { titel: 'Warenwirtschaft', kinder: ['/admin/ware', '/admin/hygiene', '/admin/lager', '/admin/inventur',
                                       '/admin/preise', '/admin/warenblatt'] },
  { titel: 'Team', kinder: ['/admin/personal', '/admin/dienstplan', '/admin/arbeitszeit', '/admin/zeitzettel',
                            '/admin/trinkgeld', '/admin/stempel'] },
  /* Rechnungen für Feiern stehen für sich: sie gehören weder zu den
     Reservierungen (das ist der Tischplan) noch zur Warenwirtschaft (das ist
     der Einkauf), und der Chef öffnet sie bewusst. */
  { titel: 'Rechnungen', pfad: '/admin/rechnung' },
  /* Die Privatkasse steht bewusst allein und ganz am Ende — sie gehört nicht
     zum Betrieb, sondern dem Inhaber. Sie in eine Betriebsgruppe zu hängen
     wäre der erste Schritt dahin, beides zu verwechseln. */
  { titel: 'Privat', pfad: '/admin/privat' },
  { titel: 'Einstellungen', kinder: ['/admin/tische', '/admin/zeiten', '/admin/benutzer'] },
];

const eintrag = pfad => NAV.find(n => n[0] === pfad);

/** Gruppen für eine Rolle: gesperrte Seiten fallen weg, leere Gruppen auch. */
function gruppenFuer(rolle) {
  return GRUPPEN
    .map(g => ({
      titel: g.titel,
      pfad: g.pfad,
      eintraege: (g.kinder || []).map(eintrag).filter(Boolean)
        .filter(([h]) => darfSeite(rolle, h)),
    }))
    .filter(g => (g.pfad ? darfSeite(rolle, g.pfad) : g.eintraege.length > 0));
}

/* Untere Leiste am Handy: vier häufige Ziele plus „Mehr". */
const UNTEN = ['/admin', '/admin/tag', '/admin/neu', '/admin/karte'];

export function layout({ title, active, body, status = 200, user = null }) {
  const rolle = user?.role || 'chef';
  const gruppen = gruppenFuer(rolle);
  const unten = UNTEN.filter(h => darfSeite(rolle, h));
  return new Response(
`<!DOCTYPE html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} — Goya´s Lamm</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#14120F">
<style>${CSS}</style></head><body>
<header class="top"><div class="in">
  <a class="brand" href="/admin">
    <img src="/assets/logo-white.png" alt="Goya´s Lamm">
    <b>Verwaltung</b>
  </a>
  <div class="wer">
    ${tonSchalter()}
    ${user ? `<span class="nm">${esc(user.name)}</span>
      ${rolle !== 'chef' ? `<span class="ro">${esc(ROLLEN[rolle]?.label || rolle)}</span>` : ''}` : ''}
    <a class="out" href="/admin/logout">Abmelden</a>
  </div>
</div></header>
${rolle === 'demo' ? `<div class="demobar">Demo-Zugang · nur ansehen ·
  Gastdaten sind abgekürzt</div>` : ''}
<nav class="tabs"><div class="in">
  ${gruppen.map(g => g.pfad
    ? `<a href="${g.pfad}" class="${active === g.pfad ? 'on' : ''}">${esc(g.titel)}</a>`
    /* name="hauptnav" macht die Klappmenüs von Haus aus gegenseitig
       ausschließend — in Browsern, die es können, ohne eine Zeile JavaScript.
       Für die übrigen und fürs Zuklappen bei einem Klick daneben sorgt das
       Skript am Seitenende. */
    : `<details class="tmehr" name="hauptnav">
    <summary class="${g.eintraege.some(([h]) => h === active) ? 'on' : ''}">${esc(g.titel)}</summary>
    <div class="tliste">
      ${g.eintraege.map(([h, t]) =>
        `<a href="${h}" class="${active === h ? 'on' : ''}">${esc(t)}</a>`).join('')}
    </div></details>`).join('')}
</div></nav>
<main>${body}</main>

<nav class="bnav">
  ${unten.map(pfad => {
    const [h, , ic, kurz] = NAV.find(n => n[0] === pfad);
    return `<a href="${h}" class="${active === h ? 'on' : ''}${h === '/admin/neu' ? ' plus' : ''}">
      ${svg(ic)}<span>${kurz}</span></a>`;
  }).join('')}
  <details class="more">
    <summary>${svg('mehr')}<span>Mehr</span></summary>
    <div class="sheet-bg"></div>
    <div class="sheet">
      ${gruppen.map(g => g.pfad
        ? `<a href="${g.pfad}" class="${active === g.pfad ? 'on' : ''}">
             ${svg(eintrag(g.pfad)[2])}<span>${esc(g.titel)}</span></a>`
        : `<div class="grp">${esc(g.titel)}</div>
           ${g.eintraege.map(([h, t, ic]) =>
             `<a href="${h}" class="${active === h ? 'on' : ''}">
                ${svg(ic)}<span>${esc(t)}</span></a>`).join('')}`).join('')}
      <a href="/admin/logout" class="ab">${svg('aus')}<span>Abmelden</span></a>
    </div>
  </details>
</nav>
${fanfareMarkup()}
<script>
/* Klappmenüs schließen.
   Ein <details> bleibt offen, bis man es wieder antippt — beim Durchsehen der
   Reiterleiste standen deshalb nach kurzer Zeit fünf Menüs gleichzeitig offen
   und verdeckten die halbe Seite. Drei Regeln beheben das:
     1. Öffnet eines, schließen die anderen (das name-Attribut macht das in
        neuen Browsern schon selbst; hier für die übrigen).
     2. Ein Klick daneben schließt alles — auch der auf den abgedunkelten
        Rand des Handy-Blatts, der innerhalb des Elements liegt.
     3. Escape schließt alles.
   Ohne JavaScript bleibt es beim alten Verhalten: Antippen öffnet, Antippen
   schließt. Nichts ist dadurch unerreichbar. */
(function(){
  var alle = [].slice.call(document.querySelectorAll('nav.tabs details, nav.bnav details'));
  if (!alle.length) return;

  function zu(ausser){
    alle.forEach(function(d){ if (d !== ausser && d.open) d.open = false; });
  }

  alle.forEach(function(d){
    d.addEventListener('toggle', function(){ if (d.open) zu(d); });
  });

  document.addEventListener('click', function(e){
    var rand = e.target.classList && e.target.classList.contains('sheet-bg');
    alle.forEach(function(d){
      if (!d.open) return;
      if (rand || !d.contains(e.target)) d.open = false;
    });
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' || e.key === 'Esc') zu(null);
  });
})();
</script>
</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

export const redirect = (to, flash) =>
  new Response(null, { status: 303, headers: { location: to + (flash ? (to.includes('?') ? '&' : '?') + 'ok=' + encodeURIComponent(flash) : ''), 'cache-control': 'no-store' } });

/**
 * Seite für frisch vergebene Zugangsdaten.
 *
 * Bewusst KEIN Redirect mit `?ok=…`: sonst stünde das Passwort in der Adresszeile,
 * damit in der Browser-Historie des Küchen-Tablets und in jedem Zwischenprotokoll.
 */
export function geheimnis({ user, titel, zeilen, hinweis, zurueck }) {
  const body = `
    <h1>${esc(titel)}</h1>
    <p class="sub">Bitte jetzt notieren — danach lässt sich das nicht mehr anzeigen.</p>
    <div class="card">
      <h2>Zugangsdaten</h2>
      <div class="body">
        <div class="geheim">
          ${zeilen.map(([k, v]) =>
            `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
        ${hinweis ? `<p class="hint" style="margin-top:1rem">${esc(hinweis)}</p>` : ''}
        <div class="row" style="margin-top:1.3rem">
          <a class="btn" href="${esc(zurueck)}">Fertig</a>
        </div>
      </div>
    </div>`;
  return layout({ user, title: titel, active: zurueck, body });
}

export function flash(url) {
  const ok = url.searchParams.get('ok');
  const err = url.searchParams.get('err');
  if (ok) return `<div class="msg">${esc(ok)}</div>`;
  if (err) return `<div class="msg err">${esc(err)}</div>`;
  return '';
}

export const sourcePill = s =>
  s === 'telefon' ? '<span class="pill tel">Telefon</span>'
  : s === 'walk' ? '<span class="pill walk">Vor Ort</span>'
  : '<span class="pill web">Online</span>';

/** Reservierungs-Tabelle. `notes` = { phone_key: Gastnotiz } aus notesFor(). */
export function table(rows, { showDate = false, notes = {}, user = null } = {}) {
  const key = v => String(v ?? '').replace(/\D/g, '');
  const offen = darfPersonendaten(user?.role || 'chef');
  const nm = v => offen ? esc(v) : esc(kuerzeName(v));
  if (!rows.length) return '<div class="empty">Keine Reservierungen.</div>';
  return `<table class="stack"><thead><tr>
    <th>Zeit</th><th>${showDate ? 'Datum / Name' : 'Name'}</th><th>P.</th>
    <th class="hide-s">Kontakt</th><th class="hide-s">Anmerkung</th><th></th>
  </tr></thead><tbody>
  ${rows.map(r => `<tr class="${r.status === 'cancelled' ? 'cancelled' : ''}${r.no_show ? ' noshow' : ''}">
    <td class="t">${esc(r.res_time)}</td>
    <td class="nm">${offen ? `<a href="/admin/r/${esc(r.id)}">${esc(r.name)}</a>` : nm(r.name)}
      ${showDate ? `<div class="meta">${esc(formatDateDE(r.res_date))}</div>` : ''}
      ${r.status === 'cancelled' ? '<div class="meta">storniert</div>' : ''}
      ${r.no_show ? '<div class="meta"><span class="pill ns">nicht erschienen</span></div>' : ''}
      ${offen && notes[key(r.phone)] ? `<div class="meta gastnote">${esc(notes[key(r.phone)])}</div>` : ''}</td>
    <td class="g">${esc(String(r.guests))}</td>
    <td class="hide-s">${offen
      ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>
         ${r.email ? `<div class="meta">${esc(r.email)}</div>` : ''}`
      : '<span class="meta">—</span>'}</td>
    <td class="hide-s meta">${offen ? esc(r.note || '—') : '—'} ${sourcePill(r.source)}</td>
    <td class="det meta show-s">${offen
      ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.note ? ' · ' + esc(r.note) : ''}`
      : ''}</td>
    <td class="act">${offen
      ? `<a class="btn sm ghost" href="/admin/r/${esc(r.id)}">Öffnen</a>` : ''}</td>
  </tr>`).join('')}
  </tbody></table>`;
}

export function dayHeading(day, sum, count) {
  const n = nowBerlin().date;
  const tag = day === n ? ' · heute' : '';
  return `<h2><a href="/admin/tag?d=${day}" style="text-decoration:none;color:inherit">
    ${esc(formatDateDE(day))}${tag}</a>
    <em>${sum} ${sum === 1 ? 'Gast' : 'Gäste'} · ${count} ${count === 1 ? 'Reservierung' : 'Reservierungen'}</em></h2>`;
}

export const weekdayName = d => WEEKDAY_DE[weekday(d)];
