/**
 * Wareneingang — die eigentliche Aufzeichnung.
 *
 * ── Warum es diese Seite gibt ─────────────────────────────────────────
 * Die Wareneingangskontrolle ist keine Komfortfunktion, sondern Pflicht.
 * Nach VO (EG) 852/2004 muss jeder Lebensmittelbetrieb ein Eigenkontroll-
 * system nach HACCP-Grundsätzen führen; der Wareneingang ist darin ein
 * kritischer Lenkungspunkt. Was einmal zu warm angekommen ist, wird in der
 * Küche nicht wieder gut.
 *
 * Dazu kommt Art. 18 VO (EG) 178/2002: Der Betrieb muss jederzeit sagen
 * können, **von wem** eine Ware kam. Lieferant + Tag + Artikel + Charge in
 * einer Zeile erfüllt genau das — bei einem Rückruf ist das der Unterschied
 * zwischen zehn Minuten und einem halben Tag Aktenwühlen.
 *
 * ── Was es ausdrücklich NICHT ist ─────────────────────────────────────
 * Keine Buchhaltung. Dieselbe Regel wie bei der Arbeitszeiterfassung und bei
 * GastrOptima Stufe 3 (Steuerberatungsgesetz). Und kein GoBD-Archiv: Ein
 * rechtlich ersetzendes Scannen verlangt Unveränderbarkeit, zeitgerechte
 * Erfassung **und** eine Verfahrensdokumentation. Solange die nicht existiert,
 * bleibt Papier Papier und das Foto hier eine Zweitablage zum Wiederfinden.
 * Der Hinweis steht auf der Seite. Nicht wegkürzen.
 *
 * ── Bedienung ─────────────────────────────────────────────────────────
 * Gebaut für die Hintertür: Handy in einer Hand, Kiste in der anderen.
 * Lieferant antippen, Foto, Temperatur, fertig. Die Positionen sind bewusst
 * **optional** — wer sie am Abend nicht tippt, hat trotzdem die
 * Hygienedokumentation, und die ist der Pflichtteil.
 */
import { clean, esc, jsq, nowBerlin, formatDateDE } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { monatLabel, monatVerschieben, tagKurz } from '../_lib/zeit.js';
import { jsonBlock } from '../_lib/warenui.js';
import {
  EINHEITEN, GRUPPEN, MASSNAHMEN, TEMP_KLASSEN, tempKlassen, tempOk,
  einheitLabel, euro, grad, menge, mengeAus, centAus, tempAus,
  positionCent, summeCent, kennung, istTag, istMonat, istEinheit,
} from '../_lib/ware.js';

const MIGRATION = 'Die Tabellen für den Wareneingang fehlen noch — '
  + 'bitte Migration 0011_ware.sql einspielen.';

/** Wie viele Positionszeilen das leere Formular anbietet. */
const ZEILEN = 4;

async function einstellung(db, k) {
  try {
    const r = await db.prepare(`SELECT v FROM settings WHERE k = ?`).bind(k).first();
    return r?.v ?? null;
  } catch { return null; }
}

const rechtshinweis = `
  <details class="card">
    <summary>Was diese Aufzeichnung ist — und was nicht</summary>
    <div class="body meta">
      <p style="margin:0 0 .6rem"><b>Sie erfüllt eine echte Pflicht.</b> Nach
         VO (EG) 852/2004 braucht jeder Lebensmittelbetrieb ein Eigenkontrollsystem
         nach HACCP-Grundsätzen. Der Wareneingang ist darin ein kritischer Punkt:
         Temperatur, Mindesthaltbarkeit, Verpackung und Sinnesprüfung gehören
         dokumentiert — mit Abweichung und ergriffener Maßnahme.</p>
      <p style="margin:0 0 .6rem"><b>Sie macht die Rückverfolgbarkeit möglich.</b>
         Art. 18 VO (EG) 178/2002 verlangt, dass der Betrieb jederzeit sagen kann,
         von wem eine Ware kam. Lieferant, Tag, Artikel und Charge in einer Zeile
         sind genau das.</p>
      <p style="margin:0 0 .6rem"><b>Sie ist keine Buchhaltung.</b> Dieselbe Regel
         wie bei der Arbeitszeiterfassung. Die Originalbelege gehen unverändert an
         den Steuerberater; hier steht, was für die Küche und die Kontrolle
         gebraucht wird.</p>
      <p style="margin:0"><b>Das Foto ersetzt das Papier nicht.</b> Ein rechtlich
         ersetzendes Scannen — also Belege wegwerfen — verlangt Unveränderbarkeit,
         zeitgerechte Erfassung und eine Verfahrensdokumentation. Solange die nicht
         existiert: Papier aufheben. Das Foto ist eine Zweitablage zum
         Wiederfinden.</p>
    </div>
  </details>`;

/* ================================================================== */
/* Anzeige                                                            */
/* ================================================================== */

export async function onRequestGet(context) {
  const { request, env, data } = context;
  const url = new URL(request.url);
  const db = env.DB;

  if (url.searchParams.get('neu') === '1') return formular(context, null);
  const id = clean(url.searchParams.get('id'), 40);
  if (id) return formular(context, id);

  /* --- Monatsliste ---------------------------------------------- */
  const monat = istMonat(url.searchParams.get('m'))
    ? url.searchParams.get('m') : nowBerlin().date.slice(0, 7);

  let lieferungen = [], posten = [], lieferanten = [], fehler = '';
  try {
    lieferungen = (await db.prepare(
      `SELECT * FROM deliveries WHERE day LIKE ? ORDER BY day DESC, created_at DESC`)
      .bind(monat + '%').all()).results || [];
    posten = (await db.prepare(
      `SELECT i.delivery_id, i.menge_milli, i.ep_cent FROM delivery_items i
         JOIN deliveries d ON d.id = i.delivery_id
        WHERE d.day LIKE ?`).bind(monat + '%').all()).results || [];
    lieferanten = (await db.prepare(`SELECT id, name FROM suppliers`).all()).results || [];
  } catch { fehler = MIGRATION; }

  const klassen = tempKlassen(await einstellung(db, 'ware_temp'));
  const liefName = Object.fromEntries(lieferanten.map(l => [l.id, l.name]));

  const summeJe = {};
  const anzahlJe = {};
  for (const p of posten) {
    summeJe[p.delivery_id] = (summeJe[p.delivery_id] || 0) + positionCent(p.menge_milli, p.ep_cent);
    anzahlJe[p.delivery_id] = (anzahlJe[p.delivery_id] || 0) + 1;
  }

  const gesamt = Object.values(summeJe).reduce((a, b) => a + b, 0);
  const beanstandet = lieferungen.filter(
    l => l.temp_ok === 0 || !l.mhd_ok || !l.ware_ok || (l.massnahme && l.massnahme !== 'angenommen'));

  const zeile = l => {
    const auffaellig = l.temp_ok === 0 || !l.mhd_ok || !l.ware_ok;
    return `<tr>
      <td class="t">${esc(tagKurz(l.day))}</td>
      <td class="nm"><a href="/admin/ware?id=${esc(l.id)}">${esc(liefName[l.supplier_id] || 'Ohne Lieferant')}</a>
        ${l.liefernr ? `<div class="meta">Nr. ${esc(l.liefernr)}</div>` : ''}
        ${l.corrected ? '<div class="meta"><span class="pill">korrigiert</span></div>' : ''}</td>
      <td class="temp ${l.temp_ok === 0 ? 'abweich' : ''}">${
        l.temp_zehntel === null ? '<span class="meta">—</span>' : esc(grad(l.temp_zehntel))}</td>
      <td class="hide-s">${auffaellig
        ? `<span class="pill walk">${esc([
            l.temp_ok === 0 ? 'Temperatur' : '', !l.mhd_ok ? 'MHD' : '', !l.ware_ok ? 'Zustand' : '',
          ].filter(Boolean).join(' · '))}</span>`
        : '<span class="meta">i. O.</span>'}
        ${l.massnahme && l.massnahme !== 'angenommen'
          ? `<div class="meta">${esc(MASSNAHMEN[l.massnahme] || l.massnahme)}</div>` : ''}</td>
      <td class="hide-s meta">${anzahlJe[l.id] || 0} Pos.${l.beleg_key ? ' · Foto' : ''}</td>
      <td class="g">${summeJe[l.id] ? esc(euro(summeJe[l.id])) + ' €' : '—'}</td>
      <td class="det meta show-s">${anzahlJe[l.id] || 0} Positionen${l.beleg_key ? ' · Foto' : ''}${
        auffaellig ? ' · <b class="abweich">Abweichung</b>' : ''}</td>
      <td class="act"><a class="btn sm ghost" href="/admin/ware?id=${esc(l.id)}">Öffnen</a></td>
    </tr>`;
  };

  const body = `
    <h1>Wareneingang</h1>
    <p class="sub">${esc(monatLabel(monat))} — Annahme, Temperatur und Beleg je Lieferung.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/ware?neu=1">Lieferung erfassen</a>
      <a class="btn ghost" href="/admin/ware?m=${monatVerschieben(monat, -1)}">←</a>
      <a class="btn ghost" href="/admin/ware">Aktueller Monat</a>
      <a class="btn ghost" href="/admin/ware?m=${monatVerschieben(monat, 1)}">→</a>
      <span class="spacer"></span>
      <a class="btn ghost" href="/admin/warenblatt?m=${esc(monat)}">Kontrollblatt drucken</a>
      <a class="btn ghost" href="/admin/lager">Artikel &amp; Lieferanten</a>
    </div>

    <div class="stats">
      <div class="stat"><b>${lieferungen.length}</b><span>Lieferungen</span></div>
      <div class="stat hot"><b>${euro(gesamt)} €</b><span>erfasste Positionen</span></div>
      <div class="stat ${beanstandet.length ? 'hot' : ''}"><b>${beanstandet.length}</b><span>mit Abweichung</span></div>
      <div class="stat"><b>${lieferungen.filter(l => l.beleg_key).length}</b><span>mit Beleg</span></div>
    </div>

    <div class="card">
      <h2>Lieferungen</h2>
      ${lieferungen.length ? `<table class="stack"><thead><tr>
          <th>Tag</th><th>Lieferant</th><th>Temp.</th><th class="hide-s">Kontrolle</th>
          <th class="hide-s">Inhalt</th><th>Wert</th><th></th>
        </tr></thead><tbody>${lieferungen.map(zeile).join('')}</tbody></table>`
        : `<div class="empty">In diesem Monat ist noch nichts erfasst.<br>
             <span class="meta">Die erste Lieferung dauert zwei Minuten — danach sind es dreißig Sekunden.</span></div>`}
    </div>

    ${rechtshinweis}`;

  return layout({ user: data?.user, title: 'Wareneingang', active: '/admin/ware', body });
}

/* ================================================================== */
/* Formular — neu und bearbeiten                                      */
/* ================================================================== */

async function formular({ request, env, data }, id) {
  const url = new URL(request.url);
  const db = env.DB;
  const heute = nowBerlin().date;

  let lieferung = null, posten = [], lieferanten = [], artikel = [], haeufig = [], fehler = '';
  try {
    lieferanten = (await db.prepare(
      `SELECT id, name FROM suppliers WHERE active = 1 ORDER BY sort, name`).all()).results || [];
    artikel = (await db.prepare(
      `SELECT id, name, einheit, gruppe, temp_klasse FROM articles WHERE active = 1
        ORDER BY gruppe, sort, name`).all()).results || [];
    /* Die zuletzt am häufigsten benutzten Lieferanten kommen als Kacheln nach
       oben — nach ein paar Wochen ist der richtige fast immer dabei. */
    haeufig = (await db.prepare(
      `SELECT supplier_id, COUNT(*) AS n FROM deliveries
        WHERE supplier_id IS NOT NULL GROUP BY supplier_id ORDER BY n DESC LIMIT 6`)
      .all()).results || [];
    if (id) {
      lieferung = await db.prepare(`SELECT * FROM deliveries WHERE id = ?`).bind(id).first();
      if (lieferung) {
        posten = (await db.prepare(
          `SELECT * FROM delivery_items WHERE delivery_id = ? ORDER BY sort, id`)
          .bind(id).all()).results || [];
      }
    }
  } catch { fehler = MIGRATION; }

  if (id && !lieferung && !fehler) {
    return redirect('/admin/ware', 'Diese Lieferung gibt es nicht (mehr).');
  }

  const klassen = tempKlassen(await einstellung(db, 'ware_temp'));
  const artNach = Object.fromEntries(artikel.map(a => [a.id, a]));

  /* Für die Ampel und die Live-Summe im Browser */
  const jsDaten = {
    klassen: Object.fromEntries(Object.entries(klassen).map(([k, v]) => [k, { l: v.label, m: v.max }])),
    einheit: Object.fromEntries(artikel.map(a => [a.id, einheitLabel(a.einheit)])),
    tempArt: Object.fromEntries(artikel.filter(a => a.temp_klasse).map(a => [a.id, a.temp_klasse])),
  };

  const kachelIds = haeufig.map(h => h.supplier_id).filter(sid => lieferanten.some(l => l.id === sid));
  const gewaehlt = lieferung?.supplier_id || '';
  const rest = lieferanten.filter(l => !kachelIds.includes(l.id));

  const artOptionen = (sel) =>
    `<option value="">— wählen —</option>`
    + Object.entries(GRUPPEN).map(([g, gl]) => {
        const inGruppe = artikel.filter(a => a.gruppe === g);
        if (!inGruppe.length) return '';
        return `<optgroup label="${esc(gl)}">${inGruppe.map(a =>
          `<option value="${esc(a.id)}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`;
      }).join('')
    + (() => {
        const ohne = artikel.filter(a => !a.gruppe || !GRUPPEN[a.gruppe]);
        return ohne.length ? `<optgroup label="Ohne Gruppe">${ohne.map(a =>
          `<option value="${esc(a.id)}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>` : '';
      })()
    + `<option value="__neu"${sel === '__neu' ? ' selected' : ''}>+ neuer Artikel …</option>`;

  const einheitOptionen = (sel) => Object.entries(EINHEITEN).map(([k, v]) =>
    `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v.label)}</option>`).join('');

  const posZeile = (p, i) => {
    const a = p ? artNach[p.article_id] : null;
    return `<div class="prow" data-zeile>
      <div class="f artikel"><label>Artikel</label>
        <select name="art" data-art>${artOptionen(p?.article_id || '')}</select>
        <input class="neuname" name="artneu" maxlength="80" placeholder="Name des neuen Artikels"
               style="margin-top:.35rem">
        <select class="neuname" name="artneu_einheit" style="margin-top:.35rem">${einheitOptionen('kg')}</select>
      </div>
      <div class="f"><label>Menge</label>
        <input name="menge" inputmode="decimal" maxlength="12" data-menge
               value="${p ? esc(menge(p.menge_milli, a?.einheit || 'kg')) : ''}"
               placeholder="0"><span class="hint" data-eh>${a ? esc(einheitLabel(a.einheit)) : ''}</span></div>
      <div class="f"><label>€ je Einheit</label>
        <input name="ep" inputmode="decimal" maxlength="12" data-ep
               value="${p?.ep_cent ? esc(euro(p.ep_cent)) : ''}" placeholder="optional"></div>
      <div class="f"><label>MHD</label>
        <input name="mhd" type="date" value="${esc(p?.mhd || '')}"></div>
      <div class="f"><label>Charge</label>
        <input name="charge" maxlength="40" value="${esc(p?.charge || '')}" placeholder="optional"></div>
      <button type="button" class="weg" data-weg aria-label="Zeile entfernen">✕</button>
    </div>`;
  };

  const zeilen = posten.length
    ? posten.map(posZeile).join('')
    : Array.from({ length: ZEILEN }, () => posZeile(null)).join('');

  const t = lieferung?.temp_zehntel;
  const body = `
    <h1>${id ? 'Lieferung' : 'Lieferung erfassen'}</h1>
    <p class="sub">${id
      ? esc(formatDateDE(lieferung.day)) + ' — Änderungen werden als Korrektur gekennzeichnet.'
      : 'Lieferant, Foto, Temperatur. Die Positionen können auch später nachgetragen werden.'}</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    ${!artikel.length && !fehler ? `<div class="msg warn">Es sind noch keine Artikel angelegt.
      Die Hygienekontrolle lässt sich trotzdem erfassen — für Positionen und Preise
      bitte zuerst unter <a href="/admin/lager">Artikel &amp; Lieferanten</a> ein paar Artikel anlegen.</div>` : ''}

    <script type="application/json" id="waredaten">${jsonBlock(jsDaten)}</script>

    <form method="post" action="/admin/ware" enctype="multipart/form-data" id="wform">
      <input type="hidden" name="do" value="save">
      ${id ? `<input type="hidden" name="id" value="${esc(id)}">` : ''}
      <input type="hidden" name="beleg_key" id="belegKey" value="${esc(lieferung?.beleg_key || '')}">

      <div class="card">
        <h2>Wer hat geliefert</h2>
        <div class="body">
          ${kachelIds.length ? `<div class="lkacheln" style="margin-bottom:.9rem">
            ${kachelIds.map(sid => {
              const l = lieferanten.find(x => x.id === sid);
              const n = haeufig.find(h => h.supplier_id === sid)?.n || 0;
              return `<button type="button" class="lkachel ${sid === gewaehlt ? 'on' : ''}"
                data-lief="${esc(sid)}"><b>${esc(l.name)}</b><span>${n}× geliefert</span></button>`;
            }).join('')}
          </div>` : ''}
          <div class="grid">
            <div class="f"><label for="lief">Lieferant</label>
              <select id="lief" name="lieferant">
                <option value="">— ohne / Einkauf im Markt —</option>
                ${lieferanten.map(l =>
                  `<option value="${esc(l.id)}"${l.id === gewaehlt ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}
              </select></div>
            <div class="f"><label for="tag">Tag der Annahme</label>
              <input id="tag" name="day" type="date" required
                     value="${esc(lieferung?.day || heute)}" max="${esc(heute)}"></div>
            <div class="f"><label for="nr">Lieferschein-Nr.</label>
              <input id="nr" name="liefernr" maxlength="40" value="${esc(lieferung?.liefernr || '')}"
                     placeholder="optional"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Beleg <em>Lieferschein oder Rechnung abfotografieren</em></h2>
        <div class="body">
          <div class="foto" id="fotoBox">
            ${lieferung?.beleg_key
              ? `<img src="/admin/ware/beleg?k=${encodeURIComponent(lieferung.beleg_key)}" alt="Beleg" id="vorschau">`
              : '<img id="vorschau" alt="" hidden>'}
            <label class="knopf" for="beleg">Foto aufnehmen</label>
            <input id="beleg" name="beleg" type="file" accept="image/*" capture="environment">
            <p class="stand" id="fotoStand">${lieferung?.beleg_key
              ? 'Ein Beleg ist hinterlegt. Ein neues Foto ersetzt ihn.'
              : 'Kein Beleg. Das Papier bitte trotzdem aufheben.'}</p>
            <div class="row" style="justify-content:center;margin-top:.8rem" id="lesenZeile" hidden>
              <button type="button" class="btn sm ghost" id="lesen">Beleg auslesen</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Hygienekontrolle <em>Pflichtteil</em></h2>
        <div class="body">
          <div class="grid">
            <div class="f"><label for="tk">Was wurde gemessen</label>
              <select id="tk" name="tempklasse">
                <option value="">— keine gekühlte Ware dabei —</option>
                ${Object.entries(klassen).map(([k, v]) =>
                  `<option value="${esc(k)}"${lieferung?.temp_klasse === k ? ' selected' : ''}
                    data-max="${v.max}">${esc(v.label)} — bis ${esc(grad(v.max))}</option>`).join('')}
              </select>
              <p class="hint">Die Kühltemperatur des Fahrzeugs ist nicht die Kerntemperatur
                 der Ware. Einstichthermometer bei Frischware, Infrarot bei Tiefkühl.</p></div>
            <div class="f"><label for="tg">Gemessene Temperatur °C</label>
              <input id="tg" name="temp" inputmode="decimal" maxlength="8"
                     value="${t === null || t === undefined ? '' : esc((t / 10).toFixed(1).replace('.', ','))}"
                     placeholder="z. B. 4,5"></div>
          </div>
          <div class="ampel" id="ampel"><i class="pkt"></i><div>
            <b id="ampelT">Noch nichts gemessen</b>
            <span id="ampelU">Warengruppe wählen und Temperatur eintragen.</span></div></div>

          <div style="margin-top:1.2rem">
            <label class="check"><input type="checkbox" name="mhd_ok" value="1"
              ${!lieferung || lieferung.mhd_ok ? 'checked' : ''}>
              <span><b>Mindesthaltbarkeit geprüft</b> — Datum ausreichend weit weg</span></label>
            <label class="check"><input type="checkbox" name="ware_ok" value="1"
              ${!lieferung || lieferung.ware_ok ? 'checked' : ''}>
              <span><b>Verpackung und Zustand in Ordnung</b> — unbeschädigt, kein auffälliger
                Geruch, keine Auftauspuren</span></label>
          </div>

          <div class="grid" style="margin-top:.6rem">
            <div class="f"><label for="ma">Was ist damit passiert</label>
              <select id="ma" name="massnahme">
                ${Object.entries(MASSNAHMEN).map(([k, v]) =>
                  `<option value="${esc(k)}"${(lieferung?.massnahme || 'angenommen') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}
              </select></div>
            <div class="f full"><label for="bem">Bemerkung</label>
              <input id="bem" name="note" maxlength="200" value="${esc(lieferung?.note || '')}"
                     placeholder="z. B. eine Kiste Tomaten zurück, Fahrer informiert"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Positionen <em>optional — kann abends nachgetragen werden</em></h2>
        <div class="body">
          <div id="posten">${zeilen}</div>
          <div class="row" style="margin-top:.8rem">
            <button type="button" class="btn sm ghost" id="mehr">Zeile hinzufügen</button>
          </div>
          <div class="psum"><span>Wert der erfassten Positionen</span><b id="summe">0,00 €</b></div>
        </div>
      </div>

      <div class="row end" style="margin-bottom:2rem">
        <a class="btn ghost" href="/admin/ware">Abbrechen</a>
        <button class="btn" type="submit">${id ? 'Änderung speichern' : 'Lieferung speichern'}</button>
      </div>
    </form>

    ${id ? `<div class="card"><h2>Angelegt</h2><div class="body meta">
      ${esc(lieferung.erfasst_von || 'unbekannt')} am
      ${esc(new Date(lieferung.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))}
      ${lieferung.corrected ? ' · später korrigiert' : ''}
      ${lieferung.updated_at
        ? `<br>zuletzt geändert ${esc(new Date(lieferung.updated_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))}` : ''}
    </div></div>` : ''}

    ${rechtshinweis}

    <script>${SKRIPT}</script>`;

  return layout({
    user: data?.user,
    title: id ? 'Lieferung' : 'Wareneingang erfassen',
    active: '/admin/ware', body,
  });
}

/* ------------------------------------------------------------------ */
/* Browser-Teil                                                        */
/* ------------------------------------------------------------------ */

const SKRIPT = `
(function(){
  var D={}; try{ D=JSON.parse(document.getElementById('waredaten').textContent)||{}; }catch(e){}
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

  /* --- Lieferantenkacheln ---------------------------------------- */
  var sel=$('#lief');
  $$('[data-lief]').forEach(function(k){
    k.addEventListener('click',function(){
      sel.value=k.dataset.lief;
      $$('[data-lief]').forEach(function(x){x.classList.remove('on')});
      k.classList.add('on');
    });
  });
  if(sel) sel.addEventListener('change',function(){
    $$('[data-lief]').forEach(function(x){x.classList.toggle('on',x.dataset.lief===sel.value)});
  });

  /* --- Temperaturampel -------------------------------------------- */
  var tk=$('#tk'), tg=$('#tg'), amp=$('#ampel'), aT=$('#ampelT'), aU=$('#ampelU');
  function zahl(v){ v=String(v||'').trim().replace(',','.');
    if(!v||!/^-?\\d*\\.?\\d*$/.test(v)) return null;
    var n=Number(v); return isFinite(n)?Math.round(n*10):null; }
  function ampel(){
    var k=tk.value, m=zahl(tg.value);
    amp.className='ampel';
    if(!k){ aT.textContent = m===null ? 'Keine gekühlte Ware' : 'Keine Warengruppe gewählt';
      aU.textContent = m===null ? 'Für Trockenware und Getränke ist keine Messung nötig.'
        : 'Ohne Warengruppe lässt sich der Wert nicht beurteilen.'; return; }
    var g=D.klassen[k]; if(!g) return;
    if(m===null){ aT.textContent=g.l;
      aU.textContent='Grenzwert '+(g.m/10).toFixed(1).replace('.',',')+' °C — jetzt messen.'; return; }
    var ok=m<=g.m;
    amp.className='ampel '+(ok?'gut':'schlecht');
    aT.textContent=(m/10).toFixed(1).replace('.',',')+' °C — '+(ok?'in Ordnung':'ZU WARM');
    aU.textContent=g.l+', Grenzwert '+(g.m/10).toFixed(1).replace('.',',')+' °C.'
      +(ok?'':' Ware zurückweisen oder Maßnahme unten festhalten.');
    if(!ok){ var ma=$('#ma'); if(ma&&ma.value==='angenommen') ma.focus(); }
  }
  if(tk&&tg){ tk.addEventListener('change',ampel); tg.addEventListener('input',ampel); ampel(); }

  /* --- Positionen -------------------------------------------------- */
  var box=$('#posten');
  function rechne(){
    var s=0;
    $$('[data-zeile]',box).forEach(function(r){
      var m=zahl3($('[data-menge]',r).value), e=zahl2($('[data-ep]',r).value);
      if(m&&e) s+=Math.round(m*e/1000);
    });
    $('#summe').textContent=(s/100).toFixed(2).replace('.',',')+' €';
  }
  function zahl3(v){ v=String(v||'').trim().replace(',','.');
    if(!v||!/^\\d*\\.?\\d*$/.test(v)) return 0; var n=Number(v); return isFinite(n)?Math.round(n*1000):0; }
  function zahl2(v){ v=String(v||'').trim().replace(',','.');
    if(!v||!/^\\d*\\.?\\d*$/.test(v)) return 0; var n=Number(v); return isFinite(n)?Math.round(n*100):0; }

  function zeileBinden(r){
    var a=$('[data-art]',r);
    function art(){
      r.classList.toggle('istneu', a.value==='__neu');
      var eh=$('[data-eh]',r);
      if(eh) eh.textContent = a.value&&a.value!=='__neu' ? (D.einheit[a.value]||'') : '';
      /* Passt die Warengruppe der Position zur gemessenen Klasse? Wenn noch
         keine gewählt ist, die des ersten gekühlten Artikels vorschlagen. */
      if(tk&&!tk.value&&D.tempArt&&D.tempArt[a.value]){ tk.value=D.tempArt[a.value]; ampel(); }
    }
    a.addEventListener('change',art); art();
    $$('[data-menge],[data-ep]',r).forEach(function(i){ i.addEventListener('input',rechne) });
    var w=$('[data-weg]',r);
    if(w) w.addEventListener('click',function(){
      if($$('[data-zeile]',box).length>1){ r.remove(); } else {
        $$('input,select',r).forEach(function(i){ if(i.type!=='hidden') i.value=''; });
        r.classList.remove('istneu');
      }
      rechne();
    });
  }
  $$('[data-zeile]',box).forEach(zeileBinden);
  rechne();

  var mehr=$('#mehr');
  if(mehr) mehr.addEventListener('click',function(){
    var v=$$('[data-zeile]',box)[0].cloneNode(true);
    $$('input',v).forEach(function(i){ i.value='' });
    $$('select',v).forEach(function(s){ s.selectedIndex=0 });
    v.classList.remove('istneu');
    box.appendChild(v); zeileBinden(v);
    $('[data-art]',v).focus();
  });

  /* --- Foto: verkleinern, hochladen, auslesen ---------------------- */
  var datei=$('#beleg'), vor=$('#vorschau'), stand=$('#fotoStand'),
      key=$('#belegKey'), lesenZ=$('#lesenZeile'), lesen=$('#lesen');
  if(lesenZ && key && key.value) lesenZ.hidden=false;

  function klein(file, cb){
    /* Ein Handyfoto hat gern 4000 px und 5 MB. 1600 px reichen, um einen
       Lieferschein zu lesen, und laden auch bei schlechtem Netz zügig. */
    var img=new Image(), url=URL.createObjectURL(file);
    img.onload=function(){
      var m=1600, w=img.width, h=img.height;
      if(w>m||h>m){ var f=Math.min(m/w,m/h); w=Math.round(w*f); h=Math.round(h*f); }
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ cb(b||file) },'image/jpeg',0.82);
    };
    img.onerror=function(){ URL.revokeObjectURL(url); cb(file) };
    img.src=url;
  }

  if(datei) datei.addEventListener('change',function(){
    var f=datei.files&&datei.files[0]; if(!f) return;
    stand.textContent='Bild wird vorbereitet …';
    klein(f,function(blob){
      if(vor){ vor.src=URL.createObjectURL(blob); vor.hidden=false; }
      var fd=new FormData(); fd.append('beleg',blob,'beleg.jpg');
      stand.textContent='Wird hochgeladen …';
      fetch('/admin/ware/foto',{method:'POST',body:fd})
        .then(function(r){ return r.json() })
        .then(function(j){
          if(j&&j.key){
            key.value=j.key;
            /* Das Original nicht ein zweites Mal mitschicken — es ist oben. */
            datei.value='';
            stand.textContent='Beleg gesichert. Das Papier bitte trotzdem aufheben.';
            if(lesenZ) lesenZ.hidden=false;
          } else {
            stand.textContent='Hochladen hat nicht geklappt — das Foto wird beim Speichern mitgeschickt.';
          }
        })
        .catch(function(){
          stand.textContent='Kein Netz für den Upload — das Foto wird beim Speichern mitgeschickt.';
        });
    });
  });

  if(lesen) lesen.addEventListener('click',function(){
    if(!key.value) return;
    lesen.disabled=true; lesen.textContent='Wird gelesen …';
    fetch('/admin/ware/lesen?k='+encodeURIComponent(key.value))
      .then(function(r){ return r.json() })
      .then(function(j){ uebernehmen(j||{}) })
      .catch(function(){ stand.textContent='Auslesen hat nicht geklappt.' })
      .then(function(){ lesen.disabled=false; lesen.textContent='Beleg auslesen'; });
  });

  function uebernehmen(v){
    var geaendert=[];
    if(v.fehler&&!(v.positionen&&v.positionen.length)){ stand.textContent=v.fehler; return; }
    var nr=$('#nr');
    if(v.liefernr&&!nr.value){ nr.value=String(v.liefernr).slice(0,40); geaendert.push('Nummer'); }
    var tag=$('#tag');
    if(v.datum&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v.datum)&&tag.value===tag.defaultValue){
      tag.value=v.datum; geaendert.push('Datum');
    }
    if(v.lieferant&&!sel.value){
      var t=String(v.lieferant).toLowerCase();
      for(var i=0;i<sel.options.length;i++){
        var o=sel.options[i];
        if(o.value&&(o.text.toLowerCase().indexOf(t)>=0||t.indexOf(o.text.toLowerCase())>=0)){
          sel.value=o.value; sel.dispatchEvent(new Event('change')); geaendert.push('Lieferant'); break;
        }
      }
    }
    var pos=(v.positionen||[]).filter(function(p){ return p&&p.name });
    if(pos.length){
      var frei=$$('[data-zeile]',box).filter(function(r){ return !$('[data-art]',r).value });
      pos.forEach(function(p,i){
        var r=frei[i];
        if(!r){ mehr.click(); var alle=$$('[data-zeile]',box); r=alle[alle.length-1]; }
        var a=$('[data-art]',r), tr=String(p.name).toLowerCase(), fund='';
        for(var j=0;j<a.options.length;j++){
          var o=a.options[j];
          if(o.value&&o.value!=='__neu'&&(o.text.toLowerCase().indexOf(tr)>=0||tr.indexOf(o.text.toLowerCase())>=0)){
            fund=o.value; break;
          }
        }
        if(fund){ a.value=fund; }
        else { a.value='__neu'; var nn=$('.neuname',r); if(nn) nn.value=String(p.name).slice(0,80); }
        a.dispatchEvent(new Event('change'));
        if(p.menge!=null) $('[data-menge]',r).value=String(p.menge).replace('.',',');
        /* Preise immer zweistellig: „42,9" liest sich wie ein halber Betrag und
           lädt beim Prüfen gegen den Beleg zum Übersehen ein. */
        if(p.preis!=null) $('[data-ep]',r).value=Number(p.preis).toFixed(2).replace('.',',');
      });
      geaendert.push(pos.length+' Positionen');
      rechne();
    }
    stand.textContent = geaendert.length
      ? 'Vorschlag eingetragen ('+geaendert.join(', ')+'). Bitte gegen den Beleg prüfen — '
        + 'die Maschine liest manchmal falsch.'
      : 'Aus dem Foto war nichts Verwertbares zu lesen. Bitte von Hand eintragen.';
  }
})();
`;

/* ================================================================== */
/* Speichern                                                          */
/* ================================================================== */

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }

  const id = clean(form.get('id'), 40);
  const zurueck = id ? `/admin/ware?id=${encodeURIComponent(id)}` : '/admin/ware?neu=1';
  const fehler = m => redirect(`${zurueck}${zurueck.includes('?') ? '&' : '?'}err=${encodeURIComponent(m)}`);
  if (!db) return fehler('Keine Datenbankverbindung.');

  const heute = nowBerlin().date;
  const day = istTag(clean(form.get('day'), 10)) ? clean(form.get('day'), 10) : heute;
  if (day > heute) return fehler('Ein Wareneingang in der Zukunft ergibt keinen Sinn.');

  const lieferant = clean(form.get('lieferant'), 40) || null;
  const liefernr = clean(form.get('liefernr'), 40) || null;
  const klasse = TEMP_KLASSEN[clean(form.get('tempklasse'), 20)]
    ? clean(form.get('tempklasse'), 20) : null;
  const tempZ = tempAus(form.get('temp'));
  const massnahme = MASSNAHMEN[clean(form.get('massnahme'), 20)]
    ? clean(form.get('massnahme'), 20) : 'angenommen';
  const note = clean(form.get('note'), 200) || null;
  const mhdOk = form.get('mhd_ok') ? 1 : 0;
  const wareOk = form.get('ware_ok') ? 1 : 0;

  const klassen = tempKlassen(await einstellung(db, 'ware_temp'));
  const ok = tempOk(tempZ, klasse, klassen);

  /* --- Beleg ------------------------------------------------------ */
  let belegKey = clean(form.get('beleg_key'), 120) || null;
  const datei = form.get('beleg');
  if (datei && typeof datei === 'object' && datei.size > 0) {
    const neu = await legeBelegAb(env, datei, day);
    if (neu) belegKey = neu;
  }

  const jetzt = new Date().toISOString();
  const wer = data?.user?.name || data?.user?.username || null;

  try {
    let lid = id;
    if (id) {
      const alt = await db.prepare(`SELECT id FROM deliveries WHERE id = ?`).bind(id).first();
      if (!alt) return redirect('/admin/ware', 'Diese Lieferung gibt es nicht (mehr).');
      await db.prepare(
        `UPDATE deliveries SET supplier_id=?, day=?, liefernr=?, beleg_key=?,
           temp_zehntel=?, temp_klasse=?, temp_ok=?, mhd_ok=?, ware_ok=?,
           massnahme=?, note=?, corrected=1, updated_at=? WHERE id=?`)
        .bind(lieferant, day, liefernr, belegKey, tempZ, klasse,
              ok === null ? null : (ok ? 1 : 0), mhdOk, wareOk, massnahme, note, jetzt, id).run();
      await db.prepare(`DELETE FROM delivery_items WHERE delivery_id=?`).bind(id).run();
    } else {
      lid = kennung('d');
      await db.prepare(
        `INSERT INTO deliveries (id,supplier_id,day,liefernr,beleg_key,temp_zehntel,temp_klasse,
           temp_ok,mhd_ok,ware_ok,massnahme,note,erfasst_von,created_at,corrected)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`)
        .bind(lid, lieferant, day, liefernr, belegKey, tempZ, klasse,
              ok === null ? null : (ok ? 1 : 0), mhdOk, wareOk, massnahme, note, wer, jetzt).run();
    }

    const anzahl = await speicherePositionen(db, form, lid, jetzt);

    const warnung = ok === false ? ' ⚠️ Die Temperatur lag über dem Grenzwert.' : '';
    return redirect('/admin/ware?m=' + day.slice(0, 7),
      `${tagKurz(day)} gespeichert — ${anzahl} ${anzahl === 1 ? 'Position' : 'Positionen'}.${warnung}`);
  } catch {
    return fehler(`Das hat nicht geklappt. ${MIGRATION}`);
  }
}

/**
 * Positionen schreiben. Fehlende Artikel werden hier angelegt — sonst müsste
 * man das Formular verlassen und käme mit leeren Feldern zurück.
 * @returns {Promise<number>} wie viele Positionen gespeichert wurden
 */
async function speicherePositionen(db, form, lid, jetzt) {
  const arts = form.getAll('art');
  const neuNamen = form.getAll('artneu');
  const neuEinheiten = form.getAll('artneu_einheit');
  const mengen = form.getAll('menge');
  const preise = form.getAll('ep');
  const mhds = form.getAll('mhd');
  const chargen = form.getAll('charge');

  let n = 0;
  for (let i = 0; i < arts.length; i++) {
    let artId = clean(arts[i], 40);
    const m = mengeAus(mengen[i]);

    if (artId === '__neu') {
      const name = clean(neuNamen[i], 80);
      if (!name) continue;
      const eh = istEinheit(clean(neuEinheiten[i], 12)) ? clean(neuEinheiten[i], 12) : 'kg';
      artId = kennung('a');
      await db.prepare(
        `INSERT INTO articles (id,name,einheit,active,sort,created_at) VALUES (?,?,?,1,0,?)`)
        .bind(artId, name, eh, jetzt).run();
    }
    if (!artId || !m || m <= 0) continue;

    await db.prepare(
      `INSERT INTO delivery_items (id,delivery_id,article_id,menge_milli,ep_cent,charge,mhd,sort)
       VALUES (?,?,?,?,?,?,?,?)`)
      .bind(kennung('p'), lid, artId, m, centAus(preise[i]),
            clean(chargen[i], 40) || null,
            istTag(clean(mhds[i], 10)) ? clean(mhds[i], 10) : null, n).run();
    n++;
  }
  return n;
}

/**
 * Belegfoto in R2 ablegen.
 *
 * Gibt bei jedem Problem `null` zurück statt zu werfen: Ein fehlgeschlagener
 * Upload darf niemals die Hygienedokumentation verhindern — die ist der Teil,
 * der gesetzlich zählt, das Foto ist Komfort.
 */
export async function legeBelegAb(env, datei, day) {
  if (!env.BELEGE) return null;
  try {
    if (datei.size > 12 * 1024 * 1024) return null;
    const typ = String(datei.type || '');
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(typ)) return null;
    const endung = typ.includes('png') ? 'png' : typ.includes('webp') ? 'webp' : 'jpg';
    const key = `${day.slice(0, 7)}/${kennung('b')}.${endung}`;
    await env.BELEGE.put(key, datei.stream(), { httpMetadata: { contentType: typ } });
    return key;
  } catch {
    return null;
  }
}
