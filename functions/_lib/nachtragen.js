/**
 * „Zeit nachtragen" — das Formular, mit dem der Chef vergessene oder korrigierte
 * Schichten einträgt.
 *
 * Es ist der Teil der Arbeitszeiterfassung, der am häufigsten benutzt wird: Die
 * Stempeluhr wird vergessen, jemand hat eine Woche lang ohne PIN gearbeitet, eine
 * Aushilfe kam spontan. Deshalb kann das Formular mehr als ein Eingabefeld je Wert:
 *
 *  - **Schnellwahl** für die immer gleichen Dienste, plus „letzte Schicht übernehmen"
 *  - **Zeitraum** statt einzelnem Tag, mit Auswahl der Wochentage — eine vergessene
 *    Woche ist ein Formular, nicht sechs
 *  - **Vorschau**, die beim Tippen mitrechnet: Dauer, gerundete Dauer, Lohn,
 *    Sonntags- und Nachtanteil, und wie viele Einträge entstehen
 *
 * Die Vorschau rechnet im Browser mit — sie ist eine Hilfe, keine Quelle. Gespeichert
 * wird, was der Server rechnet; dort liegen dieselben Regeln noch einmal.
 */
import { esc } from './core.js';
import { RUNDUNG_MIN } from './zeit.js';
import { HOURS } from './core.js';

/** Die Dienste, die im Haus wirklich vorkommen. Öffnungszeiten siehe core.js. */
export const VORLAGEN = [
  { k: 'abend',   t: 'Abenddienst',    von: '16:30', bis: '23:00', pause: 30 },
  { k: 'sonntag', t: 'Sonntagsdienst', von: '11:30', bis: '20:30', pause: 45 },
  { k: 'kurz',    t: 'Kurzdienst',     von: '18:00', bis: '22:00', pause: 0 },
];

const WT = [['1','Mo'],['2','Di'],['3','Mi'],['4','Do'],['5','Fr'],['6','Sa'],['0','So']];

/**
 * @param {object} m       Mitarbeiter (id, name, wage_cent)
 * @param {object} ctx     { monat, heute, letzte, schichten }
 *   letzte    = letzte abgeschlossene Schicht dieses Mitarbeiters oder null
 *   schichten = Schichten des Monats dieses Mitarbeiters (für die Überschneidungswarnung)
 */
export function nachtragenForm(m, { monat, heute, letzte, schichten = [], zu = [] }) {
  const id = esc(m.id);
  const belegt = schichten.map(s => ({
    d: s.work_date, a: s.start_at, b: s.end_at || null,
  }));
  /* Wochentage ohne Öffnungszeiten — damit die Vorschau dieselbe Zahl nennt,
     die der Server am Ende wirklich einträgt. */
  const ruhetage = [0, 1, 2, 3, 4, 5, 6].filter(w => !HOURS[w]);

  return `
  <form method="post" action="/admin/arbeitszeit" class="nach" data-nach
        data-wage="${Number(m.wage_cent) || 0}"
        data-stufe="${RUNDUNG_MIN}"
        data-belegt="${esc(JSON.stringify(belegt))}"
        data-ruhetage="${esc(JSON.stringify(ruhetage))}"
        data-zu="${esc(JSON.stringify(zu))}">
    <input type="hidden" name="do" value="add">
    <input type="hidden" name="staff" value="${id}">
    <input type="hidden" name="m" value="${esc(monat)}">

    <div class="nach-kopf">
      <b>Zeit nachtragen</b>
      <div class="nach-vorlagen">
        ${VORLAGEN.map(v => `<button type="button" class="btn sm ghost" data-vorlage
            data-set-von="${v.von}" data-set-bis="${v.bis}" data-set-pause="${v.pause}"
            title="${v.von}–${v.bis}, ${v.pause} Min. Pause">${esc(v.t)}</button>`).join('')}
        ${letzte ? `<button type="button" class="btn sm ghost" data-vorlage
            data-set-von="${esc(letzte.start_at)}" data-set-bis="${esc(letzte.end_at)}"
            data-set-pause="${Number(letzte.break_min) || 0}"
            title="${esc(letzte.work_date)}: ${esc(letzte.start_at)}–${esc(letzte.end_at)}"
          >Letzte Schicht</button>` : ''}
      </div>
    </div>

    <div class="nach-modus">
      <label><input type="radio" name="modus" value="tag" checked data-modus> Einzelner Tag</label>
      <label><input type="radio" name="modus" value="zeitraum" data-modus> Zeitraum</label>
    </div>

    <div class="grid">
      <div class="f"><label for="nd-${id}">Tag</label>
        <input id="nd-${id}" name="date" type="date" value="${esc(heute)}" required data-von-tag></div>
      <div class="f" data-nur-zeitraum hidden><label for="nb2-${id}">bis Tag</label>
        <input id="nb2-${id}" name="date_bis" type="date" value="${esc(heute)}" data-bis-tag></div>
      <div class="f"><label for="na-${id}">Von</label>
        <input id="na-${id}" name="start" type="time" step="300" value="17:00" required data-von></div>
      <div class="f"><label for="nb-${id}">Bis</label>
        <input id="nb-${id}" name="end" type="time" step="300" value="23:00" data-bis></div>
      <div class="f"><label for="np-${id}">Pause (Min)</label>
        <input id="np-${id}" name="pause" type="number" min="0" max="600" step="5" value="30" data-pause></div>
    </div>

    <div class="nach-tage" data-nur-zeitraum hidden>
      <span class="nach-tage-l">Nur an diesen Tagen</span>
      <div class="wt">
        ${WT.map(([v, t]) => `<label><input type="checkbox" name="wt" value="${v}" checked data-wt>
          <span>${t}</span></label>`).join('')}
      </div>
      <label class="check"><input type="checkbox" name="auchzu" value="1" data-auchzu>
        Auch an Ruhetagen und Schließtagen eintragen</label>
    </div>

    <div class="grid" style="margin-top:.9rem">
      <div class="f full"><label for="nn-${id}">Notiz</label>
        <input id="nn-${id}" name="note" maxlength="120"
               placeholder="z. B. Stempeln vergessen"></div>
    </div>

    <div class="nach-vorschau" data-vorschau hidden></div>

    <div class="row" style="margin-top:.9rem">
      <button class="btn" type="submit" data-knopf>Eintragen</button>
      <label class="nach-egal" data-egal-box hidden>
        <input type="checkbox" name="egal" value="1"> Trotzdem eintragen (Doppelschicht)
      </label>
      <span class="hint" style="margin:0">Die Vorschau rechnet mit; gespeichert wird, was der Server rechnet.</span>
    </div>
  </form>`;
}

export const NACHTRAGEN_CSS = `
.nach{border-top:1px solid var(--sand);padding-top:1.1rem;margin-top:.4rem}
.nach-kopf{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-bottom:.9rem}
.nach-kopf b{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.nach-vorlagen{display:flex;gap:.35rem;flex-wrap:wrap}
.nach-modus{display:flex;gap:1.1rem;flex-wrap:wrap;margin-bottom:.9rem}
.nach-modus label{display:inline-flex;align-items:center;gap:.42rem;font-size:.9rem;cursor:pointer}
.nach-modus input{accent-color:var(--wine);width:16px;height:16px}
.nach-tage{margin-top:.9rem;background:var(--cream);border:1px solid var(--sand);
  border-radius:2px;padding:.85rem .95rem}
.nach-tage-l{display:block;font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin-bottom:.5rem}
.nach-tage .wt{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem}
.nach-tage .wt label{cursor:pointer}
.nach-tage .wt input{position:absolute;opacity:0;pointer-events:none}
.nach-tage .wt span{display:inline-block;min-width:2.6rem;text-align:center;padding:.42rem .5rem;
  border:1px solid var(--sand);border-radius:2px;background:var(--paper);font-size:.8rem;
  font-weight:600;color:var(--muted)}
.nach-tage .wt input:checked + span{background:var(--wine);border-color:var(--wine);color:#fff}
.nach-tage .wt input:focus-visible + span{outline:2px solid var(--gold);outline-offset:1px}
.nach-tage .check{display:inline-flex;align-items:center;gap:.45rem;font-size:.86rem;color:var(--muted)}
.nach-tage .check input{accent-color:var(--wine)}
.nach-vorschau{margin-top:1rem;background:var(--cream);border:1px solid var(--sand);
  border-left:3px solid var(--gold);border-radius:0 2px 2px 0;padding:.85rem 1rem}
.nach-vorschau .zeile{display:flex;gap:1.4rem;flex-wrap:wrap;align-items:baseline}
.nach-vorschau .w{display:flex;flex-direction:column;gap:.1rem}
.nach-vorschau .w b{font-size:1.12rem;font-variant-numeric:tabular-nums;line-height:1.15}
.nach-vorschau .w span{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.nach-vorschau .hinweis{margin:.7rem 0 0;font-size:.86rem;color:var(--warn);font-weight:600}
.nach-vorschau .hinweis.err{color:var(--wine)}
.nach-vorschau .liste{margin:.55rem 0 0;font-size:.84rem;color:var(--muted)}
.nach-egal{display:inline-flex;align-items:center;gap:.45rem;font-size:.86rem;color:var(--warn);
  font-weight:600;cursor:pointer}
.nach-egal input{accent-color:var(--warn)}
@media(max-width:560px){
  .nach-vorschau .zeile{gap:.9rem}
  .nach-tage .wt span{min-width:2.3rem;padding:.4rem .35rem}
}
`;

/**
 * Die Vorschau. Rechnet dieselben Regeln wie der Server noch einmal im Browser —
 * bewusst als Kopie und nicht per Abfrage: Sie soll beim Tippen mitlaufen, nicht
 * bei jedem Zeichen eine Runde übers Netz drehen.
 */
export const NACHTRAGEN_JS = `
<script>
(function(){
  var MON = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  var toMin = function(t){ var p = String(t||'').split(':'); return (+p[0]||0)*60 + (+p[1]||0); };
  var hhmm  = function(m){ m = Math.max(0, Math.round(m));
                           return Math.floor(m/60) + ':' + String(m%60).padStart(2,'0'); };
  var dez   = function(m){ return (Math.max(0,m)/60).toFixed(2).replace('.', ','); };
  var euro  = function(c){ return (Math.round(c)/100).toFixed(2).replace('.', ',') + ' €'; };
  var tagOf = function(s){ var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2])); };
  var iso   = function(d){ return d.toISOString().slice(0,10); };

  function zuschlaege(datum, von, bis){
    var b = toMin(bis) - toMin(von); if (b < 0) b += 1440;
    var beginn = toMin(von), so = 0, na = 0, d0 = tagOf(datum);
    for (var i = 0; i < b; i++){
      var abs = beginn + i, versatz = Math.floor(abs/1440), uhr = abs % 1440;
      var d = new Date(d0.getTime() + versatz*86400000);
      if (d.getUTCDay() === 0) so++;
      if (uhr >= 1200 || uhr < 360) na++;
    }
    return { sonntag: so, nacht: na, brutto: b };
  }

  /** Überschneiden sich zwei Schichten? Mitternacht wird mitgerechnet. */
  function stoesstAn(datum, von, bis, belegt){
    var d0 = tagOf(datum).getTime()/86400000;
    var a1 = d0*1440 + toMin(von);
    var e1 = d0*1440 + toMin(bis || von); if (e1 <= a1) e1 += 1440;
    for (var i = 0; i < belegt.length; i++){
      var s = belegt[i], dd = tagOf(s.d).getTime()/86400000;
      if (!s.b) { if (s.d === datum) return s; continue; }   // läuft noch
      var a2 = dd*1440 + toMin(s.a);
      var e2 = dd*1440 + toMin(s.b); if (e2 <= a2) e2 += 1440;
      if (a1 < e2 && a2 < e1) return s;
    }
    return null;
  }

  document.querySelectorAll('[data-nach]').forEach(function(f){
    var stufe  = +f.dataset.stufe || 5;
    var wage   = +f.dataset.wage || 0;
    var belegt = [], ruhe = [], zuTage = [];
    try { belegt  = JSON.parse(f.dataset.belegt   || '[]'); } catch(e){}
    try { ruhe    = JSON.parse(f.dataset.ruhetage || '[]'); } catch(e){}
    try { zuTage  = JSON.parse(f.dataset.zu       || '[]'); } catch(e){}
    var runde  = function(m){ return Math.round(m/stufe)*stufe; };

    var q = function(s){ return f.querySelector(s); };
    var vonTag = q('[data-von-tag]'), bisTag = q('[data-bis-tag]');
    var von = q('[data-von]'), bis = q('[data-bis]'), pause = q('[data-pause]');
    var box = q('[data-vorschau]'), knopf = q('[data-knopf]'), egal = q('[data-egal-box]');

    function tage(){
      var modus = f.querySelector('[data-modus]:checked');
      if (!modus || modus.value === 'tag'){
        var eins = vonTag.value ? [vonTag.value] : [];
        eins.weg = 0;
        return eins;
      }
      if (!vonTag.value || !bisTag.value) return [];
      var a = tagOf(vonTag.value), b = tagOf(bisTag.value);
      if (b < a) return [];
      var erlaubt = [].slice.call(f.querySelectorAll('[data-wt]:checked')).map(function(c){ return +c.value; });
      var auchzu = (f.querySelector('[data-auchzu]')||{}).checked;
      var out = [], weg = 0, d = new Date(a.getTime()), n = 0;
      while (d <= b && n++ < 200){
        if (erlaubt.indexOf(d.getUTCDay()) > -1){
          var t = iso(d);
          if (!auchzu && (ruhe.indexOf(d.getUTCDay()) > -1 || zuTage.indexOf(t) > -1)) weg++;
          else out.push(t);
        }
        d = new Date(d.getTime() + 86400000);
      }
      out.weg = weg;
      return out;
    }

    function zeichne(){
      var istZeitraum = (f.querySelector('[data-modus]:checked')||{}).value === 'zeitraum';
      f.querySelectorAll('[data-nur-zeitraum]').forEach(function(e){ e.hidden = !istZeitraum; });

      var liste = tage();
      if (!von.value || !bis.value || !liste.length){
        box.hidden = true;
        if (egal) egal.hidden = true;
        knopf.textContent = 'Eintragen';
        return;
      }
      var z = zuschlaege(liste[0], von.value, bis.value);
      var netto = Math.max(0, z.brutto - (+pause.value || 0));
      var ger = runde(netto);
      var n = liste.length;

      var kollision = null;
      for (var i = 0; i < liste.length && !kollision; i++){
        var t = stoesstAn(liste[i], von.value, bis.value, belegt);
        if (t) kollision = { tag: liste[i], s: t };
      }

      var teile =
        '<div class="zeile">'
        + '<div class="w"><b>' + hhmm(netto) + '</b><span>Dauer je Tag</span></div>'
        + '<div class="w"><b>' + hhmm(ger) + ' <small style="font-weight:400;font-size:.72rem;color:var(--muted)">('
          + dez(ger) + ')</small></b><span>gerundet auf ' + stufe + ' Min</span></div>'
        + (wage ? '<div class="w"><b>' + euro(ger/60*wage) + '</b><span>brutto je Tag</span></div>' : '')
        + (z.sonntag ? '<div class="w"><b>' + dez(z.sonntag) + '</b><span>davon Sonntag</span></div>' : '')
        + (z.nacht ? '<div class="w"><b>' + dez(z.nacht) + '</b><span>davon 20–6 Uhr</span></div>' : '')
        + (n > 1 ? '<div class="w"><b>' + n + '</b><span>Einträge</span></div>' : '')
        + (n > 1 && wage ? '<div class="w"><b>' + euro(n*(ger/60*wage)) + '</b><span>zusammen brutto</span></div>' : '')
        + '</div>';

      if (n > 1){
        var kurz = liste.slice(0, 8).map(function(d){
          var p = d.split('-'); return (+p[2]) + '.' + MON[+p[1]-1];
        }).join(' · ');
        teile += '<p class="liste">' + kurz + (n > 8 ? ' … und ' + (n-8) + ' weitere' : '') + '</p>';
      }
      if (liste.weg){
        teile += '<p class="liste">' + liste.weg + ' ' + (liste.weg === 1 ? 'Tag' : 'Tage')
          + ' übersprungen (Ruhetag oder Schließtag). Mit dem Haken unten werden sie mit eingetragen.</p>';
      }
      if (netto === 0){
        teile += '<p class="hinweis err">Beginn und Ende sind gleich — daraus entsteht keine Arbeitszeit.</p>';
      } else if (kollision){
        var k = kollision.s, kt = kollision.tag.split('-');
        teile += '<p class="hinweis">Am ' + (+kt[2]) + '.' + MON[+kt[1]-1] + ' gibt es schon eine Schicht ('
          + k.a + (k.b ? '–' + k.b : ', läuft noch') + '). So wird nichts eingetragen — '
          + 'für eine echte Doppelschicht den Haken unten setzen.</p>';
      } else if (netto > 600){
        teile += '<p class="hinweis">Mehr als zehn Stunden an einem Tag — bitte kurz prüfen.</p>';
      } else if (liste.length === 1 && ruhe.indexOf(tagOf(liste[0]).getUTCDay()) > -1
                 && !(f.querySelector('[data-auchzu]')||{}).checked){
        teile += '<p class="hinweis">Das ist ein Ruhetag — wird nur mit dem Haken „Auch an '
          + 'Ruhetagen…" eingetragen.</p>';
      }

      box.innerHTML = teile;
      box.hidden = false;
      if (egal){
        egal.hidden = !kollision;
        if (!kollision) egal.querySelector('input').checked = false;
      }
      knopf.textContent = n > 1 ? n + ' Tage eintragen' : 'Eintragen';
    }

    f.addEventListener('input', zeichne);
    f.addEventListener('change', zeichne);

    f.querySelectorAll('[data-vorlage]').forEach(function(b){
      b.addEventListener('click', function(){
        von.value = b.dataset.setVon;
        bis.value = b.dataset.setBis;
        pause.value = b.dataset.setPause;
        zeichne();
      });
    });

    // „bis Tag" folgt dem Starttag, solange er davor liegt
    vonTag.addEventListener('change', function(){
      if (bisTag && (!bisTag.value || bisTag.value < vonTag.value)) bisTag.value = vonTag.value;
      zeichne();
    });

    zeichne();
  });
})();
</script>`;
