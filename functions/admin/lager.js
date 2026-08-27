/**
 * Stammdaten für den Wareneingang — Lieferanten, Artikel, Grenzwerte.
 *
 * Das Fundament, nicht die Kür. Jede Quelle zum Thema sagt dasselbe: Wer mit
 * 300 Artikeln anfängt, hört nach einem Monat auf. Deshalb steht auf der Seite
 * ausdrücklich, dass zwanzig Positionen reichen — und beim Erfassen einer
 * Lieferung lässt sich ein fehlender Artikel in einem Zug anlegen, statt vorher
 * eine Liste abtippen zu müssen.
 *
 * Gelöscht wird nichts. Ein Artikel, der nicht mehr kommt, wird „ausgelistet"
 * und verschwindet aus den Auswahlfeldern — seine alten Lieferungen bleiben
 * lesbar. Ein Löschknopf würde die Rückverfolgbarkeit zerstören, die diese
 * Aufzeichnung überhaupt erst wertvoll macht.
 */
import { clean, esc, jsq } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import {
  EINHEITEN, GRUPPEN, ORTE, TEMP_KLASSEN, tempKlassen,
  istEinheit, einheitLabel, grad, tempAus, kennung, schwelle,
} from '../_lib/ware.js';

const MIGRATION = 'Die Tabellen für den Wareneingang fehlen noch — '
  + 'bitte Migration 0011_ware.sql einspielen.';

async function einstellung(db, k) {
  try {
    const r = await db.prepare(`SELECT v FROM settings WHERE k = ?`).bind(k).first();
    return r?.v ?? null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Anzeige                                                             */
/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const zeigeAlle = url.searchParams.get('alle') === '1';
  const gruppe = GRUPPEN[url.searchParams.get('g')] ? url.searchParams.get('g') : '';

  let lieferanten = [], artikel = [], zaehler = {}, fehler = '';
  try {
    lieferanten = (await db.prepare(
      `SELECT * FROM suppliers ORDER BY active DESC, sort, name`).all()).results || [];
    artikel = (await db.prepare(
      `SELECT * FROM articles ORDER BY active DESC, gruppe, sort, name`).all()).results || [];
    const z = (await db.prepare(
      `SELECT article_id, COUNT(*) AS n FROM delivery_items GROUP BY article_id`).all()).results || [];
    zaehler = Object.fromEntries(z.map(r => [r.article_id, r.n]));
  } catch { fehler = MIGRATION; }

  const klassen = tempKlassen(await einstellung(db, 'ware_temp'));
  const proz = schwelle(await einstellung(db, 'ware_schwelle'));

  /* Reihenfolge der Warengruppen wie in `ware.js` definiert, nicht alphabetisch:
     sonst stünde „Fisch" vor „Fleisch" und die Liste hätte eine andere Ordnung
     als die Reiter darüber. */
  const gruppenRang = Object.keys(GRUPPEN);
  const rang = g => { const i = gruppenRang.indexOf(g); return i < 0 ? 99 : i; };
  const gefiltert = artikel
    .filter(a => zeigeAlle || a.active)
    .filter(a => !gruppe || a.gruppe === gruppe)
    .sort((a, b) => (b.active - a.active) || (rang(a.gruppe) - rang(b.gruppe))
      || (a.sort - b.sort) || a.name.localeCompare(b.name, 'de'));

  const liefName = Object.fromEntries(lieferanten.map(l => [l.id, l.name]));
  const aktiveLief = lieferanten.filter(l => l.active);

  const optionen = (obj, gewaehlt, leer) =>
    (leer ? `<option value="">${esc(leer)}</option>` : '')
    + Object.entries(obj).map(([k, v]) =>
      `<option value="${esc(k)}"${k === gewaehlt ? ' selected' : ''}>${esc(
        typeof v === 'string' ? v : v.label)}</option>`).join('');

  const liefOptionen = (gewaehlt) =>
    `<option value="">— kein fester —</option>`
    + aktiveLief.map(l =>
      `<option value="${esc(l.id)}"${l.id === gewaehlt ? ' selected' : ''}>${esc(l.name)}</option>`).join('');

  const ortOptionen = (gewaehlt) =>
    `<option value="">—</option>`
    + ORTE.map(o => `<option value="${esc(o)}"${o === gewaehlt ? ' selected' : ''}>${esc(o)}</option>`).join('');

  /* --- Artikelzeile --------------------------------------------- */
  const artikelZeile = a => `
    <tr class="${a.active ? '' : 'cancelled'}">
      <td colspan="3" style="padding:0">
        <form method="post" action="/admin/lager" class="irow lager">
          <input type="hidden" name="do" value="artikel_save">
          <input type="hidden" name="id" value="${esc(a.id)}">
          <div class="f"><label>Artikel</label>
            <input name="name" maxlength="80" required value="${esc(a.name)}"></div>
          <div class="f"><label>Gruppe</label>
            <select name="gruppe">${optionen(GRUPPEN, a.gruppe, '—')}</select></div>
          <div class="f"><label>Einheit</label>
            <select name="einheit">${optionen(EINHEITEN, a.einheit)}</select></div>
          <div class="f"><label>Kühlung</label>
            <select name="temp">${optionen(klassen, a.temp_klasse, 'ungekühlt')}</select></div>
          <div class="irow-act"><button class="btn sm" type="submit">Sichern</button></div>
        </form>
        <div class="irow-sub">
          <form method="post" action="/admin/lager" class="row" style="gap:.45rem">
            <input type="hidden" name="do" value="artikel_save">
            <input type="hidden" name="id" value="${esc(a.id)}">
            <input type="hidden" name="name" value="${esc(a.name)}">
            <input type="hidden" name="gruppe" value="${esc(a.gruppe || '')}">
            <input type="hidden" name="einheit" value="${esc(a.einheit)}">
            <input type="hidden" name="temp" value="${esc(a.temp_klasse || '')}">
            <select name="lieferant" onchange="this.form.submit()"
                    style="font:inherit;font-size:.8rem;padding:.3rem .45rem;border:1px solid var(--sand)">
              ${liefOptionen(a.supplier_id)}</select>
            <select name="ort" onchange="this.form.submit()"
                    style="font:inherit;font-size:.8rem;padding:.3rem .45rem;border:1px solid var(--sand)">
              ${ortOptionen(a.lagerort)}</select>
          </form>
          <span class="meta">${zaehler[a.id] ? `${zaehler[a.id]}× geliefert` : 'noch nie geliefert'}</span>
          <span class="spacer"></span>
          <form method="post" action="/admin/lager"
                onsubmit="return confirm(${jsq(a.name)} + ' ' + ${jsq(a.active ? 'auslisten?' : 'wieder aufnehmen?')})">
            <input type="hidden" name="do" value="artikel_aus">
            <input type="hidden" name="id" value="${esc(a.id)}">
            <input type="hidden" name="an" value="${a.active ? '0' : '1'}">
            <button class="btn sm ${a.active ? 'danger' : 'ghost'}" type="submit">
              ${a.active ? 'Auslisten' : 'Aufnehmen'}</button>
          </form>
        </div>
      </td></tr>`;

  /* --- Lieferantenzeile ----------------------------------------- */
  const liefZeile = l => `
    <tr class="${l.active ? '' : 'cancelled'}">
      <td colspan="3" style="padding:0">
        <form method="post" action="/admin/lager" class="trow">
          <input type="hidden" name="do" value="lief_save">
          <input type="hidden" name="id" value="${esc(l.id)}">
          <div class="f"><label>Lieferant</label>
            <input name="name" maxlength="80" required value="${esc(l.name)}"></div>
          <div class="f"><label>Kundennummer</label>
            <input name="kundennr" maxlength="40" value="${esc(l.kundennr || '')}"></div>
          <div class="f"><label>Ansprechpartner</label>
            <input name="kontakt" maxlength="60" value="${esc(l.kontakt || '')}"></div>
          <div class="f"><label>Telefon</label>
            <input name="telefon" maxlength="40" value="${esc(l.telefon || '')}"></div>
          <div class="trow-act"><button class="btn sm" type="submit">Sichern</button></div>
        </form>
        <div class="trow-sub">
          <span class="meta">${esc(l.email || 'keine E-Mail hinterlegt')}</span>
          <span class="spacer"></span>
          <form method="post" action="/admin/lager"
                onsubmit="return confirm(${jsq(l.name)} + ' ' + ${jsq(l.active ? 'stilllegen?' : 'wieder aktivieren?')})">
            <input type="hidden" name="do" value="lief_aus">
            <input type="hidden" name="id" value="${esc(l.id)}">
            <input type="hidden" name="an" value="${l.active ? '0' : '1'}">
            <button class="btn sm ${l.active ? 'danger' : 'ghost'}" type="submit">
              ${l.active ? 'Stilllegen' : 'Aktivieren'}</button>
          </form>
        </div>
      </td></tr>`;

  const filterLeiste = `
    <div class="ktabs">
      <a class="ktab ${gruppe ? '' : 'on'}" href="/admin/lager${zeigeAlle ? '?alle=1' : ''}">
        Alle <span>${artikel.filter(a => zeigeAlle || a.active).length}</span></a>
      ${Object.entries(GRUPPEN).map(([k, v]) => {
        const n = artikel.filter(a => (zeigeAlle || a.active) && a.gruppe === k).length;
        if (!n) return '';
        return `<a class="ktab ${gruppe === k ? 'on' : ''}"
          href="/admin/lager?g=${esc(k)}${zeigeAlle ? '&alle=1' : ''}">${esc(v)} <span>${n}</span></a>`;
      }).join('')}
    </div>`;

  const body = `
    <h1>Lager &amp; Lieferanten</h1>
    <p class="sub">Die Stammdaten hinter dem Wareneingang. Wer hier anfängt, fängt
       am richtigen Ende an.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/ware">Wareneingang</a>
      <a class="btn ghost" href="/admin/preise">Preis-Radar</a>
      <a class="btn ghost" href="/admin/inventur">Inventur</a>
      <span class="spacer"></span>
      <a class="btn ghost" href="/admin/lager?${gruppe ? `g=${esc(gruppe)}&` : ''}${zeigeAlle ? '' : 'alle=1'}">
        ${zeigeAlle ? 'Nur aktive' : 'Auch ausgelistete'}</a>
    </div>

    <div class="stats">
      <div class="stat"><b>${artikel.filter(a => a.active).length}</b><span>Artikel</span></div>
      <div class="stat"><b>${aktiveLief.length}</b><span>Lieferanten</span></div>
      <div class="stat"><b>${proz} %</b><span>Preisalarm ab</span></div>
    </div>

    <details class="card"${artikel.length ? '' : ' open'}>
      <summary>Artikel anlegen</summary>
      <div class="body">
        <form method="post" action="/admin/lager">
          <input type="hidden" name="do" value="artikel_neu">
          <div class="grid">
            <div class="f"><label for="an">Name</label>
              <input id="an" name="name" maxlength="80" required placeholder="z. B. Rinderfilet"></div>
            <div class="f"><label for="ag">Warengruppe</label>
              <select id="ag" name="gruppe">${optionen(GRUPPEN, gruppe, '—')}</select></div>
            <div class="f"><label for="ae">Einheit</label>
              <select id="ae" name="einheit">${optionen(EINHEITEN, 'kg')}</select></div>
            <div class="f"><label for="at">Kühlung</label>
              <select id="at" name="temp">${optionen(klassen, '', 'ungekühlt')}</select>
              <p class="hint">Bestimmt, gegen welchen Grenzwert die Ampel beim
                 Wareneingang prüft.</p></div>
            <div class="f"><label for="al">Lieferant</label>
              <select id="al" name="lieferant">${liefOptionen('')}</select></div>
            <div class="f"><label for="ao">Lagerort</label>
              <select id="ao" name="ort">${ortOptionen('')}</select>
              <p class="hint">Die Reihenfolge beim Zählen der Inventur.</p></div>
          </div>
          <div class="row end" style="margin-top:1rem">
            <button class="btn" type="submit">Artikel anlegen</button></div>
        </form>
      </div>
    </details>

    <div class="card">
      <h2>Artikel <em>${gefiltert.length} ${gefiltert.length === 1 ? 'Eintrag' : 'Einträge'}</em></h2>
      ${artikel.length ? `<div class="body" style="padding-bottom:0">${filterLeiste}</div>` : ''}
      ${gefiltert.length
        ? `<table><tbody>${gefiltert.map(artikelZeile).join('')}</tbody></table>`
        : `<div class="empty">Noch keine Artikel.<br>
             <span class="meta">Zwanzig reichen für den Anfang — die zwanzig, die das Geld ausmachen.</span></div>`}
    </div>

    <details class="card"${lieferanten.length ? '' : ' open'}>
      <summary>Lieferant anlegen</summary>
      <div class="body">
        <form method="post" action="/admin/lager">
          <input type="hidden" name="do" value="lief_neu">
          <div class="grid">
            <div class="f"><label for="ln">Name</label>
              <input id="ln" name="name" maxlength="80" required placeholder="z. B. Metzgerei Müller"></div>
            <div class="f"><label for="lk">Kundennummer</label>
              <input id="lk" name="kundennr" maxlength="40"></div>
            <div class="f"><label for="lp">Ansprechpartner</label>
              <input id="lp" name="kontakt" maxlength="60"></div>
            <div class="f"><label for="lt">Telefon</label>
              <input id="lt" name="telefon" maxlength="40" inputmode="tel"></div>
            <div class="f"><label for="le">E-Mail</label>
              <input id="le" name="email" maxlength="120" type="email"></div>
            <div class="f full"><label for="lb">Notiz</label>
              <input id="lb" name="note" maxlength="160" placeholder="z. B. Liefertage Di und Fr, Bestellschluss 16 Uhr"></div>
          </div>
          <div class="row end" style="margin-top:1rem">
            <button class="btn" type="submit">Lieferant anlegen</button></div>
        </form>
      </div>
    </details>

    <div class="card">
      <h2>Lieferanten <em>${lieferanten.filter(l => zeigeAlle || l.active).length} ${
        lieferanten.filter(l => zeigeAlle || l.active).length === 1 ? 'Eintrag' : 'Einträge'}</em></h2>
      ${lieferanten.filter(l => zeigeAlle || l.active).length
        ? `<table><tbody>${lieferanten.filter(l => zeigeAlle || l.active).map(liefZeile).join('')}</tbody></table>`
        : '<div class="empty">Noch keine Lieferanten.</div>'}
    </div>

    <details class="card">
      <summary>Temperaturgrenzen und Preisalarm</summary>
      <div class="body">
        <form method="post" action="/admin/lager">
          <input type="hidden" name="do" value="temp_save">
          <table><thead><tr>
            <th>Warengruppe</th><th>Grenzwert °C</th><th class="hide-s">Grundlage</th>
          </tr></thead><tbody>
          ${Object.entries(klassen).map(([k, v]) => `<tr>
            <td><b>${esc(v.label)}</b></td>
            <td><input name="t_${esc(k)}" inputmode="decimal" maxlength="8"
                       value="${esc((v.max / 10).toFixed(1).replace('.', ','))}"
                       style="width:6.5rem;font:inherit;padding:.4rem .5rem;border:1px solid var(--sand)">
                ${v.max !== TEMP_KLASSEN[k].max
                  ? `<div class="meta">Voreinstellung ${esc(grad(TEMP_KLASSEN[k].max))}</div>` : ''}</td>
            <td class="hide-s meta">${esc(v.quelle)}</td>
          </tr>`).join('')}
          <tr>
            <td><b>Preisalarm ab</b></td>
            <td><input name="schwelle" inputmode="numeric" maxlength="3" value="${proz}"
                       style="width:6.5rem;font:inherit;padding:.4rem .5rem;border:1px solid var(--sand)"> %</td>
            <td class="hide-s meta">Sprung gegenüber dem letzten Einkaufspreis</td>
          </tr>
          </tbody></table>
          <div class="row end" style="margin-top:1rem">
            <button class="btn ghost" type="submit" name="reset" value="1">Voreinstellung</button>
            <button class="btn" type="submit">Grenzen speichern</button>
          </div>
        </form>
        <p class="hint" style="margin-top:1.1rem"><b>Woher die Werte kommen.</b>
          Grundlage sind die Anforderungen aus VO (EG) 853/2004 und der Tiefkühlverordnung.
          Die Quellen weichen im Detail voneinander ab — manche nennen für Geflügel und
          frisches Fleisch strengere Werte. Deshalb sind die Zahlen hier änderbar und keine
          feste Zusage. Vor dem Ernstfall einmal mit der Lebensmittelüberwachung oder dem
          Hauptlieferanten abgleichen.</p>
      </div>
    </details>

    <details class="card">
      <summary>Wie man hier anfängt</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Zwanzig Artikel, nicht dreihundert.</b> Die zwanzig
           Positionen, die das meiste Geld kosten, bringen den größten Teil des Nutzens.
           Alles andere wächst von allein mit: Beim Erfassen einer Lieferung lässt sich ein
           fehlender Artikel direkt anlegen.</p>
        <p style="margin:0 0 .6rem"><b>Eine Person, eine feste Zeit.</b> Ohne benannte
           Zuständigkeit verwaist die Pflege nach vier Wochen — dann stehen veraltete Preise
           in der Auswertung, und die schaden mehr, als sie nutzen.</p>
        <p style="margin:0"><b>Nichts wird gelöscht, nur ausgelistet.</b> Ausgelistete
           Artikel verschwinden aus den Auswahlfeldern, ihre alten Lieferungen bleiben
           lesbar. Das ist Absicht: Ohne die alten Zeilen wäre die Rückverfolgbarkeit weg.</p>
      </div>
    </details>`;

  return layout({ user: data?.user, title: 'Lager', active: '/admin/lager', body });
}

/* ------------------------------------------------------------------ */
/* Speichern                                                           */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const zurueck = '/admin/lager';
  const fehler = m => redirect(`${zurueck}?err=${encodeURIComponent(m)}`);
  if (!db) return fehler('Keine Datenbankverbindung.');

  const jetzt = new Date().toISOString();
  const tun = clean(d.do, 20);

  const gruppe = GRUPPEN[clean(d.gruppe, 20)] ? clean(d.gruppe, 20) : null;
  const einheit = istEinheit(clean(d.einheit, 12)) ? clean(d.einheit, 12) : 'kg';
  const temp = TEMP_KLASSEN[clean(d.temp, 20)] ? clean(d.temp, 20) : null;
  const ort = ORTE.includes(clean(d.ort, 30)) ? clean(d.ort, 30) : null;
  const lieferant = clean(d.lieferant, 40) || null;
  const id = clean(d.id, 40);

  try {
    switch (tun) {
      case 'artikel_neu': {
        const name = clean(d.name, 80);
        if (!name) return fehler('Der Artikel braucht einen Namen.');
        await db.prepare(
          `INSERT INTO articles (id,name,gruppe,einheit,supplier_id,temp_klasse,lagerort,active,sort,created_at)
           VALUES (?,?,?,?,?,?,?,1,0,?)`)
          .bind(kennung('a'), name, gruppe, einheit, lieferant, temp, ort, jetzt).run();
        return redirect(zurueck, `„${name}" angelegt.`);
      }

      case 'artikel_save': {
        const name = clean(d.name, 80);
        if (!id || !name) return fehler('Der Artikel braucht einen Namen.');
        await db.prepare(
          `UPDATE articles SET name=?, gruppe=?, einheit=?, temp_klasse=? WHERE id=?`)
          .bind(name, gruppe, einheit, temp, id).run();
        /* Lieferant und Lagerort stehen in einem zweiten, kleineren Formular.
           Wird die obere Zeile gespeichert, fehlen die Felder — dann dürfen die
           gespeicherten Werte nicht stillschweigend auf „leer" fallen. */
        if (Object.prototype.hasOwnProperty.call(d, 'lieferant')) {
          await db.prepare(`UPDATE articles SET supplier_id=? WHERE id=?`).bind(lieferant, id).run();
        }
        if (Object.prototype.hasOwnProperty.call(d, 'ort')) {
          await db.prepare(`UPDATE articles SET lagerort=? WHERE id=?`).bind(ort, id).run();
        }
        return redirect(zurueck, `„${name}" gesichert.`);
      }

      case 'artikel_aus': {
        if (!id) return fehler('Unbekannter Artikel.');
        const an = d.an === '1' ? 1 : 0;
        await db.prepare(`UPDATE articles SET active=? WHERE id=?`).bind(an, id).run();
        return redirect(zurueck, an ? 'Artikel wieder aufgenommen.' : 'Artikel ausgelistet.');
      }

      case 'lief_neu': {
        const name = clean(d.name, 80);
        if (!name) return fehler('Der Lieferant braucht einen Namen.');
        await db.prepare(
          `INSERT INTO suppliers (id,name,kundennr,kontakt,telefon,email,note,active,sort,created_at)
           VALUES (?,?,?,?,?,?,?,1,0,?)`)
          .bind(kennung('l'), name, clean(d.kundennr, 40) || null, clean(d.kontakt, 60) || null,
                clean(d.telefon, 40) || null, clean(d.email, 120) || null,
                clean(d.note, 160) || null, jetzt).run();
        return redirect(zurueck, `„${name}" angelegt.`);
      }

      case 'lief_save': {
        const name = clean(d.name, 80);
        if (!id || !name) return fehler('Der Lieferant braucht einen Namen.');
        await db.prepare(
          `UPDATE suppliers SET name=?, kundennr=?, kontakt=?, telefon=? WHERE id=?`)
          .bind(name, clean(d.kundennr, 40) || null, clean(d.kontakt, 60) || null,
                clean(d.telefon, 40) || null, id).run();
        return redirect(zurueck, `„${name}" gesichert.`);
      }

      case 'lief_aus': {
        if (!id) return fehler('Unbekannter Lieferant.');
        const an = d.an === '1' ? 1 : 0;
        await db.prepare(`UPDATE suppliers SET active=? WHERE id=?`).bind(an, id).run();
        return redirect(zurueck, an ? 'Lieferant aktiviert.' : 'Lieferant stillgelegt.');
      }

      case 'temp_save': {
        if (d.reset) {
          await db.prepare(`DELETE FROM settings WHERE k IN ('ware_temp','ware_schwelle')`).run();
          return redirect(zurueck, 'Grenzwerte auf die Voreinstellung zurückgesetzt.');
        }
        const eigen = {};
        for (const k of Object.keys(TEMP_KLASSEN)) {
          const v = tempAus(d['t_' + k]);
          /* Nur speichern, was wirklich abweicht — sonst friert man die
             Voreinstellung ein und merkt eine spätere Korrektur nicht. */
          if (v !== null && v !== TEMP_KLASSEN[k].max) eigen[k] = v;
        }
        const proz = schwelle(clean(d.schwelle, 3));
        await db.prepare(
          `INSERT INTO settings (k,v) VALUES ('ware_temp', ?)
             ON CONFLICT(k) DO UPDATE SET v = excluded.v`)
          .bind(Object.keys(eigen).length ? JSON.stringify(eigen) : null).run();
        await db.prepare(
          `INSERT INTO settings (k,v) VALUES ('ware_schwelle', ?)
             ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(String(proz)).run();
        return redirect(zurueck, 'Grenzwerte gespeichert.');
      }

      default:
        return fehler('Unbekannte Aktion.');
    }
  } catch {
    return fehler(`Das hat nicht geklappt. ${MIGRATION}`);
  }
}
