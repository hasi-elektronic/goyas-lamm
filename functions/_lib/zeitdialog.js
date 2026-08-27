/**
 * Der Zeit-Dialog — eine Eingabemaske für die ganze Seite statt eines Formulars
 * je Mitarbeiter.
 *
 * Vorher trug jede Mitarbeiterkarte ein vollständiges Formular; bei drei Leuten
 * standen drei davon untereinander, dazu je Schicht eine Zeile aus vier
 * Eingabefeldern. Das war die eigentliche Unruhe auf der Seite.
 *
 * Jetzt wie in gängigen Zeiterfassungen (Papershift, Kimai, Personio):
 *  - **ein** Knopf „Zeit nachtragen" oben, der einen Dialog öffnet
 *  - im Dialog wird zuerst gewählt, **wer** und **wann**
 *  - die Schichten stehen als ruhige Tabelle; ein Klick auf „Ändern" öffnet
 *    denselben Dialog mit den Werten dieser Zeile
 *
 * Was diese Umsetzung darüber hinaus kann: einen **Zeitraum mit Wochentagen**.
 * Eine vergessene Woche ist damit ein Dialog und nicht sechs.
 *
 * Technisch ein natives <dialog>: Escape, Fokusfalle und der abdunkelnde
 * Hintergrund kommen vom Browser, nicht aus nachgebautem JavaScript.
 */
import { esc, HOURS } from './core.js';
import { RUNDUNG_MIN } from './zeit.js';

/**
 * JSON für einen <script type="application/json">-Block.
 *
 * **Nicht** mit esc(): Der Inhalt eines <script> wird vom Parser nicht als HTML
 * gelesen — aus &quot; würde dort wörtlich &quot;, und JSON.parse scheitert.
 * Gefährlich ist hier nur die Zeichenfolge, die das Skript-Element vorzeitig
 * beendet; deshalb wird jedes `<` als \u003c geschrieben. Damit kann weder
 * `</script>` noch `<!--` entstehen.
 */
const jsonBlock = v => JSON.stringify(v).replace(/</g, '\\u003c');


export const VORLAGEN = [
  { t: 'Abenddienst',    von: '16:30', bis: '23:00', pause: 30 },
  { t: 'Sonntagsdienst', von: '11:30', bis: '20:30', pause: 45 },
  { t: 'Kurzdienst',     von: '18:00', bis: '22:00', pause: 0 },
];

const WT = [['1','Mo'],['2','Di'],['3','Mi'],['4','Do'],['5','Fr'],['6','Sa'],['0','So']];

/**
 * @param {object} o
 *   leute      [{id,name,active,wage_cent}]
 *   proPerson  { staffId: [{d,a,b}] }  belegte Zeiten für die Kollisionsprüfung
 *   letzte     { staffId: {start_at,end_at,break_min} }
 *   monat, heute, zu (Schließtage)
 */
export function zeitDialog({ leute, proPerson, letzte, monat, heute, zu = [] }) {
  const ruhetage = [0,1,2,3,4,5,6].filter(w => !HOURS[w]);
  const daten = {
    belegt: proPerson,
    letzte,
    lohn: Object.fromEntries(leute.map(m => [m.id, Number(m.wage_cent) || 0])),
  };

  return `
<dialog id="zd" class="zd" aria-labelledby="zdTitel">
  <form method="post" action="/admin/arbeitszeit" id="zdForm">
    <input type="hidden" name="do" value="add" id="zdDo">
    <input type="hidden" name="id" value="" id="zdId">
    <input type="hidden" name="m" value="${esc(monat)}">

    <div class="zd-kopf">
      <h2 id="zdTitel">Zeit nachtragen</h2>
      <button type="button" class="zd-zu" id="zdAbbruch" aria-label="Schließen">&times;</button>
    </div>

    <div class="zd-koerper">
      <div class="f" id="zdWerFeld">
        <label for="zdWer">Mitarbeiter</label>
        <select id="zdWer" name="staff" required>
          ${leute.map(m => `<option value="${esc(m.id)}">${esc(m.name)}${m.active ? '' : ' (ausgeschieden)'}</option>`).join('')}
        </select>
      </div>
      <p class="zd-wer-fest" id="zdWerFest" hidden></p>

      <div class="zd-modus" id="zdModusZeile">
        <label><input type="radio" name="modus" value="tag" checked> Einzelner Tag</label>
        <label><input type="radio" name="modus" value="zeitraum"> Zeitraum</label>
      </div>

      <div class="zd-vorlagen" id="zdVorlagen">
        ${VORLAGEN.map(v => `<button type="button" class="btn sm ghost"
            data-set-von="${v.von}" data-set-bis="${v.bis}" data-set-pause="${v.pause}"
            title="${v.von}–${v.bis}, ${v.pause} Min. Pause">${esc(v.t)}</button>`).join('')}
        <button type="button" class="btn sm ghost" id="zdLetzte" hidden>Letzte Schicht</button>
      </div>

      <div class="grid">
        <div class="f"><label for="zdVonTag">Tag</label>
          <input id="zdVonTag" name="date" type="date" value="${esc(heute)}" required></div>
        <div class="f zd-nur-zeitraum" hidden><label for="zdBisTag">bis Tag</label>
          <input id="zdBisTag" name="date_bis" type="date" value="${esc(heute)}"></div>
        <div class="f"><label for="zdVon">Von</label>
          <input id="zdVon" name="start" type="time" step="300" value="17:00" required></div>
        <div class="f"><label for="zdBis">Bis</label>
          <input id="zdBis" name="end" type="time" step="300" value="23:00"></div>
        <div class="f"><label for="zdPause">Pause (Min)</label>
          <input id="zdPause" name="pause" type="number" min="0" max="600" step="5" value="30"></div>
      </div>

      <div class="zd-tage zd-nur-zeitraum" hidden>
        <span class="zd-tage-l">Nur an diesen Tagen</span>
        <div class="wt">
          ${WT.map(([v,t]) => `<label><input type="checkbox" name="wt" value="${v}" checked>
            <span>${t}</span></label>`).join('')}
        </div>
        <label class="check"><input type="checkbox" name="auchzu" value="1" id="zdAuchzu">
          Auch an Ruhetagen und Schließtagen eintragen</label>
      </div>

      <div class="grid" style="margin-top:.9rem">
        <div class="f full"><label for="zdNotiz">Notiz</label>
          <input id="zdNotiz" name="note" maxlength="120" placeholder="z. B. Stempeln vergessen"></div>
      </div>

      <div class="zd-vorschau" id="zdVorschau" hidden></div>
    </div>

    <div class="zd-fuss">
      <button type="button" class="btn ghost" id="zdWeg" hidden>Löschen</button>
      <span class="zd-kurz" id="zdKurz"></span>
      <span class="spacer"></span>
      <label class="zd-egal" id="zdEgalBox" hidden>
        <input type="checkbox" name="egal" value="1" id="zdEgal"> Trotzdem eintragen
      </label>
      <button type="button" class="btn ghost" id="zdAbbruch2">Abbrechen</button>
      <button type="submit" class="btn" id="zdOk">Eintragen</button>
    </div>
  </form>
</dialog>
<script type="application/json" id="zdDaten">${jsonBlock(daten)}</script>
<script type="application/json" id="zdRuhe">${jsonBlock({ ruhetage, zu, stufe: RUNDUNG_MIN })}</script>`;
}

/* ------------------------------------------------------------------ */

export const ZEITDIALOG_CSS = `
/* ---------- Dialog ---------- */
.zd{border:0;padding:0;max-width:min(100% - 1.6rem,620px);width:100%;background:var(--paper);
  color:var(--ink);border-radius:3px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.zd::backdrop{background:rgba(20,18,15,.55);backdrop-filter:blur(2px)}
.zd form{display:flex;flex-direction:column;max-height:min(88svh,860px)}
.zd-kopf{display:flex;align-items:center;justify-content:space-between;gap:1rem;
  padding:1.05rem 1.2rem;border-bottom:1px solid var(--sand);background:var(--cream);flex:0 0 auto}
.zd-kopf h2{margin:0;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase}
.zd-zu{background:none;border:0;font-size:1.7rem;line-height:1;color:var(--muted);cursor:pointer;
  padding:0 .2rem;border-radius:2px}
.zd-zu:hover{color:var(--wine)}
.zd-koerper{padding:1.2rem;overflow-y:auto;flex:1 1 auto}
.zd-fuss{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.9rem 1.2rem;
  border-top:1px solid var(--sand);background:var(--cream);flex:0 0 auto}
.zd-wer-fest{margin:0 0 1rem;font-size:1.05rem;font-weight:700}
.zd-modus{display:flex;gap:1.1rem;flex-wrap:wrap;margin:.9rem 0}
.zd-modus label{display:inline-flex;align-items:center;gap:.42rem;font-size:.9rem;cursor:pointer}
.zd-modus input{accent-color:var(--wine);width:16px;height:16px}
.zd-vorlagen{display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:1rem}
.zd-tage{margin-top:.9rem;background:var(--cream);border:1px solid var(--sand);
  border-radius:2px;padding:.85rem .95rem}
.zd-tage-l{display:block;font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin-bottom:.5rem}
.zd-tage .wt{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem}
.zd-tage .wt label{cursor:pointer}
.zd-tage .wt input{position:absolute;opacity:0;pointer-events:none}
.zd-tage .wt span{display:inline-block;min-width:2.6rem;text-align:center;padding:.42rem .5rem;
  border:1px solid var(--sand);border-radius:2px;background:var(--paper);font-size:.8rem;
  font-weight:600;color:var(--muted)}
.zd-tage .wt input:checked + span{background:var(--wine);border-color:var(--wine);color:#fff}
.zd-tage .wt input:focus-visible + span{outline:2px solid var(--gold);outline-offset:1px}
.zd-tage .check{display:inline-flex;align-items:center;gap:.45rem;font-size:.86rem;color:var(--muted)}
.zd-tage .check input{accent-color:var(--wine)}
.zd-vorschau{margin-top:1rem;background:var(--cream);border:1px solid var(--sand);
  border-left:3px solid var(--gold);border-radius:0 2px 2px 0;padding:.85rem 1rem}
.zd-vorschau .zeile{display:flex;gap:1.3rem;flex-wrap:wrap;align-items:baseline}
.zd-vorschau .w{display:flex;flex-direction:column;gap:.1rem}
.zd-vorschau .w b{font-size:1.1rem;font-variant-numeric:tabular-nums;line-height:1.15}
.zd-vorschau .w span{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.zd-vorschau .hinweis{margin:.7rem 0 0;font-size:.86rem;color:var(--warn);font-weight:600}
.zd-vorschau .hinweis.err{color:var(--wine)}
.zd-vorschau .liste{margin:.55rem 0 0;font-size:.84rem;color:var(--muted)}
.zd-kurz{font-size:.84rem;color:var(--muted);font-variant-numeric:tabular-nums}
.zd-kurz b{color:var(--ink)}
.zd-egal{display:inline-flex;align-items:center;gap:.42rem;font-size:.84rem;color:var(--warn);
  font-weight:600;cursor:pointer}
.zd-egal input{accent-color:var(--warn)}

@media(max-width:560px){
  .zd-fuss{align-items:stretch}
  .zd-kurz{flex:0 0 100%;order:-1;margin-bottom:.2rem}
  .zd-fuss .spacer{display:none}
  .zd-fuss .btn{flex:1 1 auto;justify-content:center}
  .zd-egal{flex:0 0 100%}
  .zd-koerper{padding:1rem}
}

/* ---------- Schichttabelle ---------- */
.zt-huelle{overflow-x:auto}
table.zt{width:100%;border-collapse:collapse;min-width:540px}
table.zt th{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);
  font-weight:700;padding:.5rem 1.1rem;border-bottom:1px solid var(--sand);white-space:nowrap}
table.zt td{padding:.6rem 1.1rem;border-bottom:1px solid var(--sand);vertical-align:middle}
table.zt tbody tr:last-child td{border-bottom:0}
table.zt tbody tr:hover{background:var(--cream)}
table.zt .num{font-variant-numeric:tabular-nums;white-space:nowrap}
table.zt .tag{font-weight:700;white-space:nowrap}
table.zt .tag.so{color:var(--wine)}
table.zt .roh{color:var(--muted);font-size:.82rem}
table.zt .akt{text-align:right;white-space:nowrap}
table.zt tr.laeuft td{color:var(--muted)}
table.zt .knz{display:flex;gap:.25rem;flex-wrap:wrap}
@media(max-width:720px){
  table.zt th.opt,table.zt td.opt{display:none}
  table.zt{min-width:0}
  table.zt th,table.zt td{padding:.55rem .7rem}
}

/* ---------- Aktionsleiste und offene Schichten ---------- */
.az-offen{background:var(--paper);border:1px solid var(--sand);border-left:3px solid var(--warn);
  border-radius:0 3px 3px 0;padding:.95rem 1.1rem;margin-bottom:1.3rem}
.az-offen h3{margin:0 0 .2rem;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--warn)}
.az-offen p{margin:0 0 .7rem;font-size:.88rem;color:var(--muted)}
.az-offen ul{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.az-offen li{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;font-size:.9rem}
.az-offen li b{min-width:9rem}
`;

export const ZEITDIALOG_JS = `
<script>
(function(){
  var dlg = document.getElementById('zd');
  if (!dlg || !dlg.showModal) return;   // ohne <dialog> bleibt die Seite lesbar

  var MON = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  var lies = function(id){ try { return JSON.parse(document.getElementById(id).textContent); }
                           catch(e){ return {}; } };
  var D = lies('zdDaten'), R = lies('zdRuhe');
  var stufe = R.stufe || 5, ruhe = R.ruhetage || [], zuTage = R.zu || [];

  var toMin = function(t){ var p = String(t||'').split(':'); return (+p[0]||0)*60 + (+p[1]||0); };
  var hhmm  = function(m){ m = Math.max(0, Math.round(m));
                           return Math.floor(m/60) + ':' + String(m%60).padStart(2,'0'); };
  var dez   = function(m){ return (Math.max(0,m)/60).toFixed(2).replace('.', ','); };
  var euro  = function(c){ return (Math.round(c)/100).toFixed(2).replace('.', ',') + ' €'; };
  var tagOf = function(s){ var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2])); };
  var iso   = function(d){ return d.toISOString().slice(0,10); };
  var runde = function(m){ return Math.round(m/stufe)*stufe; };
  var kurz  = function(d){ var p = String(d).split('-'); return (+p[2]) + '.' + MON[+p[1]-1]; };

  var E = {};
  ['zdForm','zdDo','zdId','zdTitel','zdWer','zdWerFeld','zdWerFest','zdModusZeile','zdVorlagen',
   'zdLetzte','zdVonTag','zdBisTag','zdVon','zdBis','zdPause','zdNotiz','zdVorschau','zdOk',
   'zdWeg','zdEgalBox','zdEgal','zdAuchzu','zdKurz'].forEach(function(k){ E[k] = document.getElementById(k); });

  function zuschlaege(datum, von, bis){
    var b = toMin(bis) - toMin(von); if (b < 0) b += 1440;
    var beginn = toMin(von), so = 0, na = 0, d0 = tagOf(datum);
    for (var i = 0; i < b; i++){
      var abs = beginn + i, versatz = Math.floor(abs/1440), uhr = abs % 1440;
      if (new Date(d0.getTime() + versatz*86400000).getUTCDay() === 0) so++;
      if (uhr >= 1200 || uhr < 360) na++;
    }
    return { sonntag: so, nacht: na, brutto: b };
  }

  function stoesstAn(datum, von, bis, belegt, ausser){
    var d0 = tagOf(datum).getTime()/86400000;
    var a1 = d0*1440 + toMin(von);
    var e1 = d0*1440 + toMin(bis || von); if (e1 <= a1) e1 += 1440;
    for (var i = 0; i < belegt.length; i++){
      var s = belegt[i];
      if (ausser && s.id === ausser) continue;          // die Zeile, die man gerade ändert
      var dd = tagOf(s.d).getTime()/86400000;
      if (!s.b){ if (s.d === datum) return s; continue; }
      var a2 = dd*1440 + toMin(s.a);
      var e2 = dd*1440 + toMin(s.b); if (e2 <= a2) e2 += 1440;
      if (a1 < e2 && a2 < e1) return s;
    }
    return null;
  }

  function istZeitraum(){
    var r = E.zdForm.querySelector('input[name=modus]:checked');
    return r && r.value === 'zeitraum';
  }

  function tage(){
    var out = [];
    out.weg = 0;
    if (!istZeitraum()){ if (E.zdVonTag.value) out.push(E.zdVonTag.value); return out; }
    if (!E.zdVonTag.value || !E.zdBisTag.value) return out;
    var a = tagOf(E.zdVonTag.value), b = tagOf(E.zdBisTag.value);
    if (b < a) return out;
    var erlaubt = [].slice.call(E.zdForm.querySelectorAll('input[name=wt]:checked'))
      .map(function(c){ return +c.value; });
    var auchzu = E.zdAuchzu && E.zdAuchzu.checked;
    var d = new Date(a.getTime()), n = 0;
    while (d <= b && n++ < 400){
      if (erlaubt.indexOf(d.getUTCDay()) > -1){
        var t = iso(d);
        if (!auchzu && (ruhe.indexOf(d.getUTCDay()) > -1 || zuTage.indexOf(t) > -1)) out.weg++;
        else out.push(t);
      }
      d = new Date(d.getTime() + 86400000);
    }
    return out;
  }

  var bearbeiteId = '';

  function zeichne(){
    E.zdForm.querySelectorAll('.zd-nur-zeitraum').forEach(function(e){ e.hidden = !istZeitraum(); });

    var wer = E.zdWer.value;
    var lohn = (D.lohn || {})[wer] || 0;
    var belegt = (D.belegt || {})[wer] || [];
    var letzte = (D.letzte || {})[wer];
    if (E.zdLetzte) E.zdLetzte.hidden = !letzte || !!bearbeiteId;

    var liste = tage();
    if (!E.zdVon.value || !E.zdBis.value || !liste.length){
      E.zdVorschau.hidden = true;
      E.zdEgalBox.hidden = true;
      if (E.zdKurz) E.zdKurz.textContent = '';
      E.zdOk.textContent = bearbeiteId ? 'Speichern' : 'Eintragen';
      return;
    }

    var z = zuschlaege(liste[0], E.zdVon.value, E.zdBis.value);
    var netto = Math.max(0, z.brutto - (+E.zdPause.value || 0));
    var ger = runde(netto), n = liste.length;

    var koll = null;
    for (var i = 0; i < liste.length && !koll; i++){
      var t = stoesstAn(liste[i], E.zdVon.value, E.zdBis.value, belegt, bearbeiteId);
      if (t) koll = { tag: liste[i], s: t };
    }

    var h = '<div class="zeile">'
      + '<div class="w"><b>' + hhmm(netto) + '</b><span>Dauer je Tag</span></div>'
      + '<div class="w"><b>' + hhmm(ger) + ' <small style="font-weight:400;font-size:.72rem;color:var(--muted)">('
        + dez(ger) + ')</small></b><span>gerundet auf ' + stufe + ' Min</span></div>'
      + (lohn ? '<div class="w"><b>' + euro(ger/60*lohn) + '</b><span>brutto je Tag</span></div>' : '')
      + (z.sonntag ? '<div class="w"><b>' + dez(z.sonntag) + '</b><span>davon Sonntag</span></div>' : '')
      + (z.nacht ? '<div class="w"><b>' + dez(z.nacht) + '</b><span>davon 20–6 Uhr</span></div>' : '')
      + (n > 1 ? '<div class="w"><b>' + n + '</b><span>Einträge</span></div>' : '')
      + (n > 1 && lohn ? '<div class="w"><b>' + euro(n*(ger/60*lohn)) + '</b><span>zusammen brutto</span></div>' : '')
      + '</div>';

    if (n > 1){
      h += '<p class="liste">' + liste.slice(0,8).map(kurz).join(' · ')
         + (n > 8 ? ' … und ' + (n-8) + ' weitere' : '') + '</p>';
    }
    if (liste.weg){
      h += '<p class="liste">' + liste.weg + ' ' + (liste.weg === 1 ? 'Tag' : 'Tage')
         + ' übersprungen (Ruhetag oder Schließtag). Der Haken oben trägt sie mit ein.</p>';
    }
    if (netto === 0){
      h += '<p class="hinweis err">Beginn und Ende sind gleich — daraus entsteht keine Arbeitszeit.</p>';
    } else if (koll){
      h += '<p class="hinweis">Am ' + kurz(koll.tag) + ' gibt es schon eine Schicht ('
         + koll.s.a + (koll.s.b ? '–' + koll.s.b : ', läuft noch')
         + '). So wird nichts eingetragen — für eine echte Doppelschicht den Haken unten setzen.</p>';
    } else if (netto > 600){
      h += '<p class="hinweis">Mehr als zehn Stunden an einem Tag — bitte kurz prüfen.</p>';
    } else if (n === 1 && !istZeitraum() && ruhe.indexOf(tagOf(liste[0]).getUTCDay()) > -1
               && !(E.zdAuchzu && E.zdAuchzu.checked)){
      h += '<p class="hinweis">Das ist ein Ruhetag — er wird nur mit dem Haken „Auch an Ruhetagen…" eingetragen.</p>';
    }

    E.zdVorschau.innerHTML = h;
    E.zdVorschau.hidden = false;
    if (E.zdKurz){
      E.zdKurz.innerHTML = (n > 1 ? '<b>' + n + ' Tage</b> · ' : '')
        + '<b>' + hhmm(ger) + '</b> je Tag'
        + (lohn ? ' · <b>' + euro(n * (ger/60*lohn)) + '</b>' : '');
    }
    E.zdEgalBox.hidden = !koll;
    if (!koll && E.zdEgal) E.zdEgal.checked = false;
    E.zdOk.textContent = bearbeiteId ? 'Speichern' : (n > 1 ? n + ' Tage eintragen' : 'Eintragen');
  }

  /* ---------- Öffnen ---------- */
  function oeffnenNeu(wer, tag){
    bearbeiteId = '';
    E.zdDo.value = 'add';
    E.zdId.value = '';
    E.zdTitel.textContent = 'Zeit nachtragen';
    E.zdWerFeld.hidden = false;
    E.zdWerFest.hidden = true;
    E.zdModusZeile.hidden = false;
    E.zdVorlagen.hidden = false;
    E.zdWeg.hidden = true;
    if (wer) E.zdWer.value = wer;
    E.zdForm.querySelector('input[name=modus][value=tag]').checked = true;
    E.zdVonTag.value = tag || E.zdVonTag.value;
    E.zdBisTag.value = E.zdVonTag.value;
    E.zdVon.value = '17:00'; E.zdBis.value = '23:00'; E.zdPause.value = 30;
    E.zdNotiz.value = '';
    E.zdForm.querySelectorAll('input[name=wt]').forEach(function(c){ c.checked = true; });
    if (E.zdAuchzu) E.zdAuchzu.checked = false;
    zeichne();
    dlg.showModal();
  }

  function oeffnenAendern(b){
    bearbeiteId = b.dataset.zid;
    E.zdDo.value = 'save';
    E.zdId.value = b.dataset.zid;
    E.zdTitel.textContent = 'Schicht ändern';
    E.zdWer.value = b.dataset.wer;
    E.zdWerFeld.hidden = true;
    E.zdWerFest.hidden = false;
    E.zdWerFest.textContent = b.dataset.name;
    E.zdModusZeile.hidden = true;
    E.zdVorlagen.hidden = true;
    E.zdWeg.hidden = false;
    E.zdForm.querySelector('input[name=modus][value=tag]').checked = true;
    E.zdVonTag.value = b.dataset.tag;
    E.zdVon.value = b.dataset.von;
    E.zdBis.value = b.dataset.bis || '';
    E.zdPause.value = b.dataset.pause || 0;
    E.zdNotiz.value = b.dataset.notiz || '';
    zeichne();
    dlg.showModal();
  }

  document.addEventListener('click', function(ev){
    var neu = ev.target.closest('[data-zd-neu]');
    if (neu){ ev.preventDefault(); oeffnenNeu(neu.dataset.wer || '', neu.dataset.tag || ''); return; }
    var ae = ev.target.closest('[data-zd-aendern]');
    if (ae){ ev.preventDefault(); oeffnenAendern(ae); return; }
  });

  [E.zdWeg].forEach(function(b){
    if (!b) return;
    b.addEventListener('click', function(){
      if (!confirm('Diesen Eintrag löschen? Aufzeichnungen müssen zwei Jahre aufbewahrt werden.')) return;
      E.zdDo.value = 'del';
      E.zdForm.submit();
    });
  });

  ['zdAbbruch','zdAbbruch2'].forEach(function(k){
    var b = document.getElementById(k);
    if (b) b.addEventListener('click', function(){ dlg.close(); });
  });
  // Klick auf den abgedunkelten Hintergrund schließt ebenfalls
  dlg.addEventListener('click', function(ev){ if (ev.target === dlg) dlg.close(); });

  E.zdForm.addEventListener('input', zeichne);
  E.zdForm.addEventListener('change', zeichne);
  E.zdVonTag.addEventListener('change', function(){
    if (E.zdBisTag && (!E.zdBisTag.value || E.zdBisTag.value < E.zdVonTag.value)) {
      E.zdBisTag.value = E.zdVonTag.value;
    }
    zeichne();
  });
  E.zdVorlagen.addEventListener('click', function(ev){
    var b = ev.target.closest('[data-set-von]');
    if (!b) return;
    E.zdVon.value = b.dataset.setVon;
    E.zdBis.value = b.dataset.setBis;
    E.zdPause.value = b.dataset.setPause;
    zeichne();
  });
  if (E.zdLetzte) E.zdLetzte.addEventListener('click', function(){
    var l = (D.letzte || {})[E.zdWer.value];
    if (!l) return;
    E.zdVon.value = l.start_at; E.zdBis.value = l.end_at; E.zdPause.value = l.break_min || 0;
    zeichne();
  });
})();
</script>`;
