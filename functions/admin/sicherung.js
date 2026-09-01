/**
 * Sicherung & Export — /admin/sicherung
 *
 * Drei Wege, an dieselben Daten zu kommen:
 *   ?json=1   vollständige Sicherung zum Wiederherstellen
 *   ?xlsx=1   Arbeitsmappe zum Ansehen und Weitergeben
 *   (ohne)    die Seite mit den Knöpfen und dem automatischen Ordner
 *
 * Die Seite liegt in der Gruppe „Einstellungen", ist für Service und Demo
 * gesperrt und hängt hinter der Chef-PIN. Das ist die eine Adresse im ganzen
 * Panel, hinter der die komplette Datenbank in einer Datei steht — Löhne,
 * Gästedaten, Privatkasse. Sie muss die am besten verschlossene sein.
 */
import { esc, nowBerlin } from '../_lib/core.js';
import { layout } from '../_lib/ui.js';
import { xlsxBauen } from '../_lib/xlsx.js';
import {
  allesLesen, zaehlen, dateiName, letzterStand, standNotieren, standText,
  tageSeit, DATEI_MUSTER, WARNUNG_AB_TAGEN,
} from '../_lib/sicherung.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const tag = nowBerlin().date;

  if (!db) {
    return layout({
      title: 'Sicherung',
      active: '/admin/sicherung',
      body: '<h1>Sicherung</h1><p class="sub">Keine Datenbank verbunden — hier gibt es gerade nichts zu sichern.</p>',
      status: 503,
    });
  }

  /* ---------------- Sicherung: die vollständige Datei ---------------- */
  if (url.searchParams.get('json') === '1') {
    const { tabellen, schema, daten, zeilen } = await allesLesen(db);
    const inhalt = JSON.stringify({
      programm: 'Goya´s Lamm — Verwaltung',
      format: 1,
      erstellt: new Date().toISOString(),
      art: url.searchParams.get('auto') === '1' ? 'automatisch' : 'manuell',
      datenbank: 'goyas-lamm-db',
      tabellen,
      zeilen,
      hinweis: 'Vollstaendige Sicherung. Enthaelt personenbezogene Daten — '
             + 'nicht weitergeben, nicht ungeschuetzt ablegen.',
      schema,
      daten,
    }, null, 1);

    await standNotieren(db, url.searchParams.get('auto') === '1' ? 'automatisch' : 'manuell');

    return new Response(inhalt, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${dateiName('sicherung', tag)}"`,
        'cache-control': 'no-store',
      },
    });
  }

  /* ---------------- Export: die Arbeitsmappe ---------------- */
  if (url.searchParams.get('xlsx') === '1') {
    const { tabellen, daten } = await allesLesen(db);
    const blaetter = tabellen.map(name => {
      const zeilen = daten[name];
      /* Spalten aus der ersten Zeile. Eine leere Tabelle bekommt trotzdem ihr
         Blatt — sonst sucht man später, ob sie vergessen wurde oder leer war. */
      const spalten = zeilen.length ? Object.keys(zeilen[0]) : ['(leer)'];
      return { name, spalten, zeilen: zeilen.map(z => spalten.map(s => z[s])) };
    });
    const mappe = await xlsxBauen(blaetter);

    return new Response(mappe, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${dateiName('export', tag)}"`,
        'cache-control': 'no-store',
      },
    });
  }

  /* ---------------- Die Seite ---------------- */
  const stand = await letzterStand(db);
  const tage = stand ? tageSeit(stand.zeit) : null;
  const faellig = tage === null || tage >= WARNUNG_AB_TAGEN;

  const { tabellen, zahlen } = await zaehlen(db);
  const zeilenGesamt = tabellen.reduce((s, t) => s + zahlen[t], 0);

  const uebersicht = tabellen
    .map(t => `<tr><td class="t">${esc(t)}</td><td class="r">${zahlen[t]}</td></tr>`)
    .join('');

  const body = `
    <h1>Sicherung &amp; Export</h1>
    <p class="sub">Eine vollständige Kopie aller Daten — zum Wegsichern oder zum
       Ansehen in Excel.</p>

    <div class="card ${faellig ? 'warn' : ''}">
      <h2>Letzte Sicherung</h2>
      <div class="body">
        <p style="font-size:1.15rem;margin:0 0 .3rem">
          <b>${esc(standText(stand))}</b>${stand ? ` <span class="meta">(${esc(stand.art)})</span>` : ''}
        </p>
        <p class="meta" style="margin:0">
          ${faellig
            ? `Länger als ${WARNUNG_AB_TAGEN} Tage her. Eine Sicherung dauert einen Klick.`
            : 'Alles im grünen Bereich.'}
        </p>
      </div>
    </div>

    <div class="card">
      <h2>Herunterladen</h2>
      <div class="body">
        <div class="grid">
          <div class="f">
            <a class="btn" href="/admin/sicherung?json=1">Sicherung herunterladen</a>
            <p class="meta" style="margin:.5rem 0 0">Eine JSON-Datei mit <b>allem</b>: alle
               ${tabellen.length} Tabellen, ${zeilenGesamt} Zeilen, dazu der Aufbau der
               Datenbank. Zum Wiederherstellen, nicht zum Lesen.</p>
          </div>
          <div class="f">
            <a class="btn ghost" href="/admin/sicherung?xlsx=1">Export für Excel</a>
            <p class="meta" style="margin:.5rem 0 0">Eine Arbeitsmappe, ein Blatt je Tabelle,
               Kopfzeile fest und Filter gesetzt. Zum Nachsehen, Sortieren und
               Weitergeben — daraus lässt sich <b>keine</b> Datenbank zurückbauen.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Automatisch in einen Ordner</h2>
      <div class="body">
        <p>Einmal einen Ordner auswählen — danach legt die Seite die Sicherung dort
           von selbst ab, sobald die letzte länger als ${WARNUNG_AB_TAGEN} Tage her ist.
           Am besten ein Ordner, der ohnehin in die Cloud synchronisiert wird
           (iCloud, Dropbox, OneDrive): dann liegt die Kopie nicht nur auf einem
           Gerät.</p>

        <div id="sich-box" class="hinweis" style="display:none"></div>

        <p style="margin:1rem 0 0">
          <button class="btn" type="button" id="sich-ordner">Ordner auswählen</button>
          <button class="btn ghost" type="button" id="sich-jetzt" style="display:none">Jetzt sichern</button>
          <button class="btn sm ghost" type="button" id="sich-loesen" style="display:none">Ordner vergessen</button>
        </p>
        <p class="meta" id="sich-stand" style="margin:.7rem 0 0"></p>

        <p class="meta" style="margin:1rem 0 0">
          Das funktioniert in <b>Chrome und Edge am Rechner</b>. Safari und die
          Telefon-Browser lassen eine Seite nicht in einen Ordner schreiben —
          dort bleiben die Knöpfe oben, und die Übersicht erinnert, wenn es zu
          lange her ist. Es werden die letzten <b>30</b> Dateien behalten;
          ältere mit genau diesem Namensmuster räumt die Seite weg.
        </p>
      </div>
    </div>

    <div class="card">
      <h2>Was in der Sicherung steht</h2>
      <div class="body">
        <p class="meta">Auch <b>Gästenamen, Telefonnummern, Personaldaten und die
           Privatkasse</b>. Die heruntergeladene Datei ist unverschlüsselt: sie gehört
           auf ein Gerät mit Passwort, nicht auf einen USB-Stick in der Schublade und
           nicht in einen geteilten Ordner. Das Protokoll der Anmeldeversuche
           (<code>login_attempts</code>) bleibt bewusst draußen — IP-Adressen haben in
           einer Sicherung nichts verloren und helfen beim Wiederherstellen nicht.</p>
        <details>
          <summary style="cursor:pointer;font-size:.9rem">Alle ${tabellen.length} Tabellen
            mit ${zeilenGesamt} Zeilen anzeigen</summary>
          <table style="margin-top:.6rem"><thead><tr><th>Tabelle</th><th class="r">Zeilen</th></tr></thead>
            <tbody>${uebersicht}</tbody></table>
        </details>
      </div>
    </div>

    <div class="card">
      <h2>Wiederherstellen</h2>
      <div class="body">
        <p>Bewusst <b>kein Knopf</b>. Ein Einspielen überschreibt den echten Betrieb,
           und dafür ist ein versehentlicher Klick der falsche Auslöser. Der Weg
           führt über Hamdi und dauert Minuten: die JSON-Datei enthält unter
           <code>schema</code> den Aufbau und unter <code>daten</code> alle Zeilen,
           daraus baut sich die Datenbank vollständig zurück.</p>
      </div>
    </div>

    ${sicherungSkript()}
  `;

  return layout({ title: 'Sicherung', active: '/admin/sicherung', body });
}

/**
 * Der Ordner-Teil, im Browser.
 *
 * Nutzt die File System Access API. Der Ordner-Griff (`FileSystemDirectoryHandle`)
 * wird in IndexedDB abgelegt — er übersteht damit das Schließen des Browsers,
 * die Erlaubnis dazu aber nicht immer. Deshalb zwei Fälle:
 *
 *   Erlaubnis steht noch  → die Datei wird ohne Zutun geschrieben.
 *   Erlaubnis ist weg     → ein Knopf „Jetzt sichern". Ein Browser lässt das
 *                           Nachfragen nur nach einem echten Klick zu; ein
 *                           Dialog, den niemand ausgelöst hat, ist verboten.
 *
 * ⚠️ In dieser Datei stehen Vorlagenliterale. Ein Backtick in diesem Skript
 * würde das umgebende Literal beenden — deshalb hier durchgehend
 * Zeichenkettenverkettung und einfache Anführungszeichen.
 */
export function sicherungSkript() {
  return `<script>
(function(){
  var BOX = document.getElementById('sich-box');
  var HIN = document.getElementById('sich-hinweis');   // schlanker Hinweis auf der Übersicht
  if (!BOX && !HIN) return;

  var MUSTER = new RegExp(${JSON.stringify(DATEI_MUSTER)});
  var BEHALTEN = 30;
  var TAGE = ${WARNUNG_AB_TAGEN};
  var KANN = typeof window.showDirectoryPicker === 'function';

  /* --- IndexedDB: der einzige Ort, an dem ein Ordner-Griff überleben kann --- */
  function idb(){
    return new Promise(function(ok, fehler){
      var a = indexedDB.open('goya-sicherung', 1);
      a.onupgradeneeded = function(){ a.result.createObjectStore('griffe'); };
      a.onsuccess = function(){ ok(a.result); };
      a.onerror = function(){ fehler(a.error); };
    });
  }
  function lesen(){
    return idb().then(function(d){ return new Promise(function(ok){
      var a = d.transaction('griffe').objectStore('griffe').get('ordner');
      a.onsuccess = function(){ ok(a.result || null); };
      a.onerror = function(){ ok(null); };
    }); }).catch(function(){ return null; });
  }
  function schreiben(h){
    return idb().then(function(d){ return new Promise(function(ok){
      var t = d.transaction('griffe', 'readwrite');
      t.objectStore('griffe').put(h, 'ordner');
      t.oncomplete = function(){ ok(true); };
      t.onerror = function(){ ok(false); };
    }); }).catch(function(){ return false; });
  }

  function sagen(text, art){
    if (BOX){ BOX.style.display = 'block'; BOX.className = 'hinweis' + (art ? ' ' + art : ''); BOX.textContent = text; }
    if (HIN && art === 'gut'){ HIN.style.display = 'none'; }
  }
  function knopf(id, an){ var e = document.getElementById(id); if (e) e.style.display = an ? '' : 'none'; }

  function heute(){ return new Date().toISOString().slice(0,10); }

  /* --- Die eigentliche Sicherung: holen, schreiben, aufräumen --- */
  function sichern(ordner, automatisch){
    sagen('Sicherung wird geschrieben …');
    return fetch('/admin/sicherung?json=1' + (automatisch ? '&auto=1' : ''), { credentials: 'same-origin' })
      .then(function(a){
        /* Ist die Chef-PIN abgelaufen, antwortet der Server mit der PIN-Seite
           statt mit JSON. Dann still aufgeben — ein halb geschriebenes
           HTML-Dokument als „Sicherung" wäre schlimmer als keine. */
        var typ = a.headers.get('content-type') || '';
        if (!a.ok || typ.indexOf('json') < 0) throw new Error('pin');
        return a.blob();
      })
      .then(function(b){
        var name = 'goyas-lamm-sicherung-' + heute() + '.json';
        return ordner.getFileHandle(name, { create: true })
          .then(function(f){ return f.createWritable(); })
          .then(function(w){ return w.write(b).then(function(){ return w.close(); }); })
          .then(function(){ return b.size; });
      })
      .then(function(groesse){
        try { localStorage.setItem('goya.sicherung', new Date().toISOString()); } catch(e){}
        sagen('Gesichert: ' + Math.round(groesse/1024) + ' kB, heute.', 'gut');
        knopf('sich-jetzt', false);
        return aufraeumen(ordner);
      })
      .catch(function(e){
        if (e && e.message === 'pin'){
          sagen('Die Chef-PIN ist abgelaufen. Seite neu laden, PIN eingeben, dann läuft es weiter.', 'warn');
        } else {
          sagen('Konnte nicht in den Ordner schreiben: ' + (e && e.message ? e.message : e), 'warn');
        }
        knopf('sich-jetzt', true);
      });
  }

  /* Nur Dateien mit genau unserem Namensmuster, nur die ältesten über 30. */
  function aufraeumen(ordner){
    if (!ordner.values) return Promise.resolve();
    var namen = [];
    var it = ordner.values();
    function weiter(){
      return it.next().then(function(s){
        if (s.done) return;
        if (s.value.kind === 'file' && MUSTER.test(s.value.name)) namen.push(s.value.name);
        return weiter();
      });
    }
    return weiter().then(function(){
      namen.sort();
      var weg = namen.slice(0, Math.max(0, namen.length - BEHALTEN));
      return weg.reduce(function(k, n){
        return k.then(function(){ return ordner.removeEntry(n).catch(function(){}); });
      }, Promise.resolve());
    }).catch(function(){});
  }

  function standAnzeigen(){
    var e = document.getElementById('sich-stand');
    if (!e) return;
    var s = null;
    try { s = localStorage.getItem('goya.sicherung'); } catch(x){}
    e.textContent = s
      ? 'Zuletzt in diesen Ordner geschrieben: ' + new Date(s).toLocaleString('de-DE')
      : 'In diesen Ordner wurde von diesem Gerät aus noch nichts geschrieben.';
  }

  function altGenug(){
    var s = null;
    try { s = localStorage.getItem('goya.sicherung'); } catch(x){}
    if (!s) return true;
    return (Date.now() - Date.parse(s)) > TAGE * 86400000;
  }

  /* --- Start --- */
  if (!KANN){
    sagen('Dieser Browser kann nicht in einen Ordner schreiben. Am Rechner mit Chrome '
        + 'oder Edge öffnen — oder oben von Hand herunterladen.', 'warn');
    knopf('sich-ordner', false);
    return;
  }

  lesen().then(function(ordner){
    if (!ordner){
      if (BOX) sagen('Noch kein Ordner gewählt.');
      return;
    }
    knopf('sich-loesen', true);
    standAnzeigen();
    return ordner.queryPermission({ mode: 'readwrite' }).then(function(recht){
      if (recht === 'granted'){
        if (altGenug()) return sichern(ordner, true);
        sagen('Ordner ist eingerichtet, die letzte Sicherung ist aktuell.', 'gut');
        return;
      }
      /* Nachfragen darf nur ein Klick — also einen anbieten. */
      sagen('Ordner ist eingerichtet. Der Browser fragt beim ersten Mal je Sitzung '
          + 'noch einmal nach der Erlaubnis.', altGenug() ? 'warn' : '');
      knopf('sich-jetzt', true);
    });
  });

  var b1 = document.getElementById('sich-ordner');
  if (b1) b1.addEventListener('click', function(){
    window.showDirectoryPicker({ mode: 'readwrite', id: 'goyas-sicherung' })
      .then(function(o){ return schreiben(o).then(function(){ knopf('sich-loesen', true); return sichern(o, false); }); })
      .catch(function(e){ if (e && e.name !== 'AbortError') sagen('Kein Ordner gewählt: ' + e.message, 'warn'); });
  });

  var b2 = document.getElementById('sich-jetzt');
  if (b2) b2.addEventListener('click', function(){
    lesen().then(function(o){
      if (!o) return sagen('Kein Ordner hinterlegt.', 'warn');
      return o.requestPermission({ mode: 'readwrite' }).then(function(r){
        if (r !== 'granted') return sagen('Ohne Erlaubnis für den Ordner geht es nicht.', 'warn');
        return sichern(o, false);
      });
    });
  });

  var b3 = document.getElementById('sich-loesen');
  if (b3) b3.addEventListener('click', function(){
    schreiben(null).then(function(){
      try { localStorage.removeItem('goya.sicherung'); } catch(e){}
      sagen('Ordner vergessen. Automatisch wird nichts mehr geschrieben.');
      knopf('sich-loesen', false); knopf('sich-jetzt', false);
      standAnzeigen();
    });
  });
})();
</script>`;
}
