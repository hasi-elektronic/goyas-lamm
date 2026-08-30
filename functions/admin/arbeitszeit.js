/**
 * Arbeitszeit — Monatsübersicht, Nachtragen, Korrigieren, Export.
 *
 * Ausdrücklich **keine Lohnabrechnung**: hier werden Zeiten erfasst und
 * zusammengezählt. Was daraus wird, entscheidet der Steuerberater.
 */
import {
  clean, esc, nowBerlin, isValidDate, formatDateDE, addDays, diffDays, weekday,
  WEEKDAY_DE, slotsForDate,
} from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { zeitDialog, ZEITDIALOG_JS } from '../_lib/zeitdialog.js';
import {
  netto, nettoGerundet, runde, brutto, summe, hhmm, dezimal, monatLabel, istMonat,
  monatVerschieben, tagKurz, zuschlaege, euro, lohnCent, verteileTrinkgeld,
  RUNDUNG_MIN, MINDESTLOHN_CENT, MINIJOB_CENT,
} from '../_lib/zeit.js';

const zeit = v => /^\d{1,2}:\d{2}$/.test(String(v || '').trim())
  ? String(v).trim().padStart(5, '0') : null;

/** So viele Tage darf ein Zeitraum höchstens umfassen. */
const MAX_ZEITRAUM = 62;

const minuten = t => { const [h, m] = String(t || '0:00').split(':').map(Number);
                       return (h || 0) * 60 + (m || 0); };

/**
 * Stößt eine neue Schicht mit einer vorhandenen zusammen?
 *
 * Gerechnet wird in absoluten Minuten ab dem Tag, damit eine Schicht über
 * Mitternacht richtig verglichen wird. Eine noch laufende Schicht (kein Ende)
 * zählt am selben Tag immer als Konflikt — wie lang sie wird, weiß niemand.
 *
 * @returns die kollidierende Schicht oder null
 */
function kollision(tag, von, bis, vorhanden) {
  const tagNr = t => Math.round(Date.parse(t + 'T00:00:00Z') / 86400000);
  const a1 = tagNr(tag) * 1440 + minuten(von);
  let e1 = tagNr(tag) * 1440 + minuten(bis || von);
  if (e1 <= a1) e1 += 1440;
  for (const s of vorhanden) {
    if (!s.end_at) { if (s.work_date === tag) return s; continue; }
    const a2 = tagNr(s.work_date) * 1440 + minuten(s.start_at);
    let e2 = tagNr(s.work_date) * 1440 + minuten(s.end_at);
    if (e2 <= a2) e2 += 1440;
    if (a1 < e2 && a2 < e1) return s;
  }
  return null;
}

/**
 * Schrittweite für ein Uhrzeitfeld: 5 Minuten, damit der Picker in Fünferschritten
 * läuft.
 *
 * Aber nur, wenn der vorhandene Wert auch auf einer Fünferstufe liegt. Sonst wäre
 * es eine Falle: Eine gestempelte 17:07 gilt bei `step="300"` als ungültiger Wert,
 * der Browser verweigert das Speichern der ganzen Zeile — und die gestempelte Zeit
 * darf nicht angetastet werden, sie ist die Aufzeichnung. Für solche Zeilen bleibt
 * das Feld deshalb minutengenau.
 */
const schritt = v => {
  const t = String(v ?? '').trim();
  if (!t) return '300';
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return (m && Number(m[2]) % 5 === 0) ? '300' : '60';
};

async function team(db) {
  try {
    return (await db.prepare(
      `SELECT id,name,role,active,wage_cent FROM staff ORDER BY active DESC, sort, name`)
      .all()).results || [];
  } catch {
    // Migration 0010 fehlt: ohne Lohnspalte weiterarbeiten statt die Seite zu verweigern.
    try {
      return (await db.prepare(
        `SELECT id,name,role,active FROM staff ORDER BY active DESC, sort, name`).all()).results || [];
    } catch { return null; }
  }
}

/**
 * Trinkgeldanteile eines Monats, staff_id → Cent.
 * Gerechnet, nicht gespeichert — ändert sich eine Schicht, stimmt die Aufteilung
 * beim nächsten Aufruf wieder.
 */
async function trinkgeldAnteile(db, monat) {
  let toepfe = [], schichten = [];
  try {
    toepfe = (await db.prepare(
      `SELECT day, amount_cent FROM tips WHERE day LIKE ?`).bind(monat + '%').all()).results || [];
    if (!toepfe.length) return {};
    schichten = (await db.prepare(
      `SELECT staff_id, work_date, start_at, end_at, break_min FROM shifts WHERE work_date LIKE ?`)
      .bind(monat + '%').all()).results || [];
  } catch { return {}; }

  const proTag = {};
  for (const s of schichten) {
    const m = nettoGerundet(s);
    if (m === null) continue;
    (proTag[s.work_date] ||= {});
    proTag[s.work_date][s.staff_id] = (proTag[s.work_date][s.staff_id] || 0) + m;
  }
  const out = {};
  for (const t of toepfe) {
    if (!t.amount_cent) continue;
    const leute = Object.entries(proTag[t.day] || {}).map(([id, minuten]) => ({ id, minuten }));
    for (const [id, cent] of Object.entries(verteileTrinkgeld(t.amount_cent, leute))) {
      out[id] = (out[id] || 0) + cent;
    }
  }
  return out;
}

async function schichtenIm(db, monat, staffId) {
  const wo = staffId ? 'AND staff_id = ?' : '';
  const b = staffId ? [monat + '%', staffId] : [monat + '%'];
  return (await db.prepare(
    `SELECT id,staff_id,work_date,start_at,end_at,break_min,note,source,corrected
       FROM shifts WHERE work_date LIKE ? ${wo}
      ORDER BY work_date, start_at`).bind(...b).all()).results || [];
}

/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();

  const leute = await team(db);
  if (leute === null) {
    return layout({ user: data?.user, title: 'Arbeitszeit', active: '/admin/arbeitszeit',
      body: `<h1>Arbeitszeit</h1>
        <div class="msg err">Die Arbeitszeiterfassung ist noch nicht eingerichtet — bitte
        Migration <code>0007_zeit.sql</code> einspielen.</div>` });
  }

  const monat = istMonat(url.searchParams.get('m')) ? url.searchParams.get('m') : now.date.slice(0, 7);
  const nurWer = clean(url.searchParams.get('p') || '', 40) || null;
  const alle = await schichtenIm(db, monat, nurWer);
  const trinkgeld = await trinkgeldAnteile(db, monat);
  let zuTage = [];
  try {
    zuTage = ((await db.prepare(`SELECT day FROM closures WHERE day LIKE ?`)
      .bind(monat + '%').all()).results || []).map(r => r.day);
  } catch { /* keine Schließtage */ }
  const lohnBekannt = leute.some(m => m.wage_cent);

  /* CSV für den Steuerberater.
     Zwei Fallstricke, die hier bewusst behandelt werden:
     1. Felder werden gequotet — ein Semikolon im Namen darf die Spalten nicht verschieben.
     2. Beginnt ein Feld mit = + - @, setzt Excel es als FORMEL um. Ein Eintrag wie
        „=HYPERLINK(…)" würde also beim Steuerberater ausgeführt. Deshalb wird ein
        Apostroph vorangestellt. */
  if (url.searchParams.get('csv') === '1') {
    const feld = v => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const namen = Object.fromEntries(leute.map(m => [m.id, m.name]));
    const lohn = Object.fromEntries(leute.map(m => [m.id, m.wage_cent || 0]));
    const zeilen = [
      ['Mitarbeiter','Datum','Wochentag','Beginn','Ende','Pause (Min)',
       'Arbeitszeit (Std)','Arbeitszeit (dezimal)',
       `gerundet auf ${RUNDUNG_MIN} Min (Std)`,'gerundet (Minuten)','gerundet (dezimal)',
       'Stundenlohn (EUR)','Lohn brutto (EUR)',
       'davon Sonntag','davon 20-6 Uhr','Quelle','korrigiert','Notiz']
        .map(feld).join(';'),
      ...alle.map(s => {
        const n = netto(s);
        const gr = runde(n);
        const z = zuschlaege(s);
        const std = lohn[s.staff_id] || 0;
        return [
          namen[s.staff_id] || s.staff_id, s.work_date, WEEKDAY_DE[weekday(s.work_date)],
          s.start_at, s.end_at || '', s.break_min || 0,
          n === null ? '' : hhmm(n), n === null ? '' : dezimal(n),
          gr === null ? '' : hhmm(gr), gr === null ? '' : String(gr),
          gr === null ? '' : dezimal(gr),
          std ? euro(std) : '',
          (std && gr !== null) ? euro(lohnCent(gr, std)) : '',
          dezimal(z.sonntag), dezimal(z.nacht),
          s.source === 'admin' ? 'nachgetragen' : 'Stempeluhr',
          s.corrected ? 'ja' : 'nein',
          String(s.note || '').replace(/[\n\r]/g, ' '),
        ].map(feld).join(';');
      }),
    ];

    /* Eine Zeile, die eine Rückfrage erspart: Der Lohn wird aus den **Minuten** gerechnet,
       nicht aus der auf zwei Stellen gekürzten Dezimalstunde. Wer 5,33 × 16,00 rechnet,
       kommt auf 85,28 statt 85,33 und ruft dann an. */
    zeilen.push('');
    zeilen.push([`Lohn = gerundete Minuten / 60 x Stundenlohn. Die Spalte "gerundet (dezimal)" `
      + `ist auf zwei Stellen gekuerzt und eignet sich nicht zum Nachrechnen — `
      + `dafuer die Spalte "gerundet (Minuten)" nehmen.`].map(feld).join(';'));
    zeilen.push([`Gerundet wird kaufmaennisch auf ${RUNDUNG_MIN} Minuten. `
      + `Die gestempelten Zeiten stehen unveraendert in den Spalten "Beginn", "Ende" und `
      + `"Arbeitszeit (Std)" — sie sind die Aufzeichnung nach § 17 MiLoG.`].map(feld).join(';'));
    zeilen.push([`Betraege sind brutto, ohne Steuern, Sozialabgaben und ohne Zuschlaege `
      + `fuer Sonntag und Nacht. Keine Lohnabrechnung.`].map(feld).join(';'));

    /* Trinkgeld steht am Ende als eigener Block: es hängt am Monat, nicht an einer
       einzelnen Schicht, und der Steuerberater muss es getrennt beurteilen können. */
    const tgIds = Object.keys(trinkgeld).filter(id => trinkgeld[id]);
    if (tgIds.length) {
      zeilen.push('');
      zeilen.push(['Trinkgeld aus dem Haus-Topf (Tronc) — steuerlich gesondert zu beurteilen']
        .map(feld).join(';'));
      zeilen.push(['Mitarbeiter', 'Trinkgeld (EUR)'].map(feld).join(';'));
      for (const id of tgIds) {
        zeilen.push([namen[id] || id, euro(trinkgeld[id])].map(feld).join(';'));
      }
    }
    return new Response('﻿' + zeilen.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="arbeitszeit-${monat}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  const namen = Object.fromEntries(leute.map(m => [m.id, m.name]));
  const gesamt = summe(alle);

  /** Eine Schichtzeile — ruhige Tabelle; geändert wird im Dialog, nicht hier. */
  const schichtZeile = (x, m) => {
    const n = netto(x);
    const gr = runde(n);
    const so = weekday(x.work_date) === 0;
    const lohn = (n !== null && m.wage_cent) ? lohnCent(gr, m.wage_cent) : null;
    return `<tr class="${x.end_at ? '' : 'laeuft'}">
      <td class="tag ${so ? 'so' : ''}">${esc(tagKurz(x.work_date))}</td>
      <td class="num">${esc(x.start_at)}<span class="roh"> – ${esc(x.end_at || '…')}</span></td>
      <td class="num opt">${x.break_min ? esc(String(x.break_min)) + ' min' : '—'}</td>
      <td class="num">${n === null ? '<span class="pill ns">läuft noch</span>'
        : `<b>${esc(hhmm(gr))}</b>${gr !== n ? `<span class="roh"> statt ${esc(hhmm(n))}</span>` : ''}`}</td>
      <td class="num opt">${lohn === null ? '—' : esc(euro(lohn)) + ' €'}</td>
      <td class="opt"><div class="knz">
        ${x.source === 'admin' ? '<span class="pill">nachgetragen</span>' : ''}
        ${x.corrected ? '<span class="pill tel">korrigiert</span>' : ''}
        ${x.note ? `<span class="meta">${esc(x.note)}</span>` : ''}
      </div></td>
      <td class="akt"><button type="button" class="btn sm ghost" data-zd-aendern
        data-zid="${esc(x.id)}" data-wer="${esc(m.id)}" data-name="${esc(m.name)}"
        data-tag="${esc(x.work_date)}" data-von="${esc(x.start_at)}" data-bis="${esc(x.end_at || '')}"
        data-pause="${esc(String(x.break_min || 0))}" data-notiz="${esc(x.note || '')}"
      >Ändern</button></td>
    </tr>`;
  };

  const personKarte = m => {
    const eigene = alle.filter(x => x.staff_id === m.id);
    if (!eigene.length && nurWer !== m.id) return '';
    const g = summe(eigene);
    const bruttoLohn = lohnCent(g.gerundet, m.wage_cent);
    const tg = trinkgeld[m.id] || 0;
    const unterMindest = m.wage_cent && m.wage_cent < MINDESTLOHN_CENT;
    const ueberMinijob = bruttoLohn > MINIJOB_CENT;

    return `<div class="card">
      <h2>${esc(m.name)}${m.active ? '' : ' (ausgeschieden)'}
        <em>${dezimal(g.gerundet)} Std. an ${g.tage} ${g.tage === 1 ? 'Tag' : 'Tagen'}${
          m.wage_cent ? ` · ${euro(bruttoLohn)} € brutto` : ''}${
          tg ? ` · ${euro(tg)} € Trinkgeld` : ''}</em></h2>
      ${unterMindest || ueberMinijob ? `<div class="body" style="padding-bottom:0">
        ${unterMindest ? `<div class="msg warn" style="margin:0 0 .6rem">
           <b>${euro(m.wage_cent)} €</b> je Stunde liegt unter dem gesetzlichen Mindestlohn von
           ${euro(MINDESTLOHN_CENT)} € (2026).</div>` : ''}
        ${ueberMinijob ? `<div class="msg warn" style="margin:0 0 .6rem">
           Über der Minijob-Grenze von ${euro(MINIJOB_CENT)} € im Monat — bitte mit dem
           Steuerberater klären.</div>` : ''}
      </div>` : ''}
      ${eigene.length ? `<div class="zt-huelle"><table class="zt">
        <thead><tr>
          <th>Tag</th><th>Zeit</th><th class="opt">Pause</th><th>Abgerechnet</th>
          <th class="opt">Lohn</th><th class="opt">Hinweis</th><th></th>
        </tr></thead>
        <tbody>${eigene.map(x => schichtZeile(x, m)).join('')}</tbody>
      </table></div>` : '<div class="empty">In diesem Monat keine Zeiten erfasst.</div>'}
      <div class="body" style="padding-top:.9rem">
        <div class="row">
          <button type="button" class="btn sm ghost" data-zd-neu data-wer="${esc(m.id)}">+ Zeit nachtragen</button>
          <a class="btn sm ghost" href="/admin/zeitzettel?m=${esc(monat)}&p=${esc(m.id)}">Monatszettel</a>
          <span class="spacer"></span>
          <span class="meta">${dezimal(g.arbeit)} Std. gestempelt · ${hhmm(g.pause)} Pause ·
            ${dezimal(g.sonntag)} Std. Sonntag · ${dezimal(g.nacht)} Std. 20–6 Uhr</span>
        </div>
      </div>
    </div>`;
  };

  const auswahl = `<div class="ktabs">
    <a href="/admin/arbeitszeit?m=${esc(monat)}" class="ktab ${nurWer ? '' : 'on'}">Alle</a>
    ${leute.map(m => `<a href="/admin/arbeitszeit?m=${esc(monat)}&p=${encodeURIComponent(m.id)}"
        class="ktab ${nurWer === m.id ? 'on' : ''}">${esc(m.name)}</a>`).join('')}
  </div>`;

  /* Offene Schichten nach oben: das Einzige auf dieser Seite, was wirklich eine
     Handlung verlangt — ohne Ende fehlt die Dauer in der Aufzeichnung. */
  const offeneListe = alle.filter(x => !x.end_at);
  const offenKarte = offeneListe.length ? `
    <div class="az-offen">
      <h3>${offeneListe.length === 1 ? 'Eine Schicht ohne Feierabend'
                                     : offeneListe.length + ' Schichten ohne Feierabend'}</h3>
      <p>Ohne Ende fehlt die Dauer in der Aufzeichnung — und der Abend fällt aus der
         Trinkgeldverteilung heraus.</p>
      <ul>
        ${offeneListe.map(x => {
          const m = leute.find(l => l.id === x.staff_id) || { name: '—', id: x.staff_id };
          return `<li><b>${esc(m.name)}</b>
            <span class="meta">${esc(tagKurz(x.work_date))} ab ${esc(x.start_at)} Uhr</span>
            <button type="button" class="btn sm ghost" data-zd-aendern
              data-zid="${esc(x.id)}" data-wer="${esc(m.id)}" data-name="${esc(m.name)}"
              data-tag="${esc(x.work_date)}" data-von="${esc(x.start_at)}" data-bis=""
              data-pause="${esc(String(x.break_min || 0))}" data-notiz="${esc(x.note || '')}"
            >Ende eintragen</button></li>`;
        }).join('')}
      </ul>
    </div>` : '';

  const gesamtLohn = leute.reduce((sum, m) =>
    sum + lohnCent(summe(alle.filter(x => x.staff_id === m.id)).gerundet, m.wage_cent), 0);

  const body = `
    <div class="row" style="align-items:flex-start">
      <div>
        <h1>Arbeitszeit</h1>
        <p class="sub" style="margin-bottom:0">${esc(monatLabel(monat))}${nurWer ? ' · ' + esc(namen[nurWer] || '') : ''}
           — erfasste Zeiten, Korrekturen und der Auszug für den Steuerberater.</p>
      </div>
      <span class="spacer"></span>
      <button type="button" class="btn" data-zd-neu${nurWer ? ` data-wer="${esc(nurWer)}"` : ''}>+ Zeit nachtragen</button>
    </div>

    <div class="row" style="margin:1.3rem 0 1.2rem">
      <a class="btn sm ghost" href="/admin/arbeitszeit?m=${monatVerschieben(monat, -1)}${nurWer ? '&p=' + encodeURIComponent(nurWer) : ''}">&larr; ${esc(monatLabel(monatVerschieben(monat, -1)).split(' ')[0])}</a>
      <a class="btn sm ghost" href="/admin/arbeitszeit?m=${esc(now.date.slice(0, 7))}">Aktueller Monat</a>
      <a class="btn sm ghost" href="/admin/arbeitszeit?m=${monatVerschieben(monat, 1)}${nurWer ? '&p=' + encodeURIComponent(nurWer) : ''}">${esc(monatLabel(monatVerschieben(monat, 1)).split(' ')[0])} &rarr;</a>
      <span class="spacer"></span>
      <a class="btn sm ghost" href="/admin/arbeitszeit?m=${esc(monat)}&csv=1">CSV für den Steuerberater</a>
      <a class="btn sm ghost" href="/admin/trinkgeld?m=${esc(monat)}">Trinkgeld</a>
      <a class="btn sm ghost" href="/admin/stempel">Stempeluhr</a>
    </div>

    ${flash(url)}

    <div class="stats">
      <div class="stat hot"><b>${dezimal(gesamt.gerundet)}</b><span>Stunden im Monat</span></div>
      <div class="stat"><b>${gesamt.anzahl}</b><span>Schichten</span></div>
      <div class="stat"><b>${dezimal(gesamt.sonntag)}</b><span>Sonntagsstunden</span></div>
      ${lohnBekannt ? `<div class="stat"><b>${euro(gesamtLohn)} €</b><span>Lohn brutto, geschätzt</span></div>` : ''}
      <div class="stat ${gesamt.offen ? 'hot' : ''}"><b>${gesamt.offen}</b><span>ohne Feierabend</span></div>
    </div>

    ${offenKarte}

    ${auswahl}

    ${leute.map(personKarte).join('') || '<div class="card"><div class="empty">Noch niemand angelegt.</div></div>'}

    <details class="card az-info">
      <summary>Was diese Seite ist — und was nicht</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem">Das hier ist die <b>Arbeitszeitaufzeichnung</b> nach
           § 17 Mindestlohngesetz: Beginn, Ende und Dauer je Tag, innerhalb von sieben Tagen
           festgehalten, zwei Jahre aufzubewahren. Für Gaststätten ist das Pflicht, und der Zoll
           prüft genau das.</p>
        <p style="margin:0 0 .6rem">Es ist <b>keine Lohnabrechnung und keine Buchhaltung</b>.
           Die Spalten „davon Sonntag" und „davon 20–6 Uhr" sind eine Hilfe für den
           Steuerberater — sie beziehen sich auf die Anwesenheit ohne Pausenabzug, weil sich
           eine Pause keiner Tageszeit zuordnen lässt. Was daraus an Zuschlägen wird,
           entscheidet der Steuerberater.</p>
        <p style="margin:0 0 .6rem"><b>Gerundet wird auf ${RUNDUNG_MIN} Minuten</b>, kaufmännisch
           zur nächsten Stufe: 5:16 wird 5:15, 5:18 wird 5:20. Wer den Beginn hoch und das Ende
           herunter rundet, kürzt systematisch die Arbeitszeit; das ist arbeitsrechtlich
           unwirksam und beim Zoll ein Fehlbetrag, kein Rundungsfehler.
           <b>Die gestempelten Zeiten bleiben unverändert gespeichert</b> — in der Tabelle steht
           die gerundete Dauer, die gestempelte daneben, sobald sie abweicht. Im CSV stehen beide.</p>
        <p style="margin:0 0 .6rem"><b>Der Lohnbetrag ist eine Schätzung.</b> Stunden mal
           Stundenlohn, brutto — ohne Steuern, ohne Sozialabgaben, ohne Zuschläge für Sonntag und
           Nacht. Das Panel warnt nur, wenn der Stundenlohn unter dem Mindestlohn liegt oder der
           Monatsbetrag über der Minijob-Grenze.</p>
        <p style="margin:0"><b>Korrekturen</b> sind erlaubt und normal — wer das Stempeln
           vergisst, trägt nach. Nachgetragene und geänderte Einträge werden als solche
           gekennzeichnet, damit die Aufzeichnung ehrlich bleibt.</p>
      </div>
    </details>

    ${zeitDialog({
      leute,
      proPerson: Object.fromEntries(leute.map(m => [m.id,
        alle.filter(x => x.staff_id === m.id)
            .map(x => ({ id: x.id, d: x.work_date, a: x.start_at, b: x.end_at || null }))])),
      letzte: Object.fromEntries(leute.map(m => {
        const l = [...alle].reverse().find(x => x.staff_id === m.id && x.end_at);
        return [m.id, l ? { start_at: l.start_at, end_at: l.end_at, break_min: l.break_min || 0 } : null];
      })),
      monat, heute: now.date, zu: zuTage,
    })}`;

  return layout({ user: data?.user, title: 'Arbeitszeit', active: '/admin/arbeitszeit',
                  body: body + ZEITDIALOG_JS });
}

export async function onRequestPost({ request, env }) {
  let d = {}, roh = new FormData();
  try { roh = await request.formData(); d = Object.fromEntries(roh); } catch { /* leer */ }
  const db = env.DB;
  const monat = istMonat(d.m) ? d.m : nowBerlin().date.slice(0, 7);
  const ziel = `/admin/arbeitszeit?m=${monat}`;
  const fehler = m => redirect(ziel + '&err=' + encodeURIComponent(m));
  if (!db) return fehler('Keine Datenbankverbindung.');

  const id    = clean(d.id, 40);
  const datum = clean(d.date, 10);
  const von   = zeit(d.start);
  const bis   = clean(d.end, 5) ? zeit(d.end) : null;
  const pause = Math.max(0, Math.min(600, parseInt(d.pause, 10) || 0));
  const note  = clean(d.note, 120);

  try {
    if (d.do === 'add') {
      const staff = clean(d.staff, 40);
      const gibtEs = await db.prepare(`SELECT id,name FROM staff WHERE id=?`).bind(staff).first();
      if (!gibtEs) return fehler('Diesen Mitarbeiter gibt es nicht.');
      if (!isValidDate(datum) || !von) return fehler('Bitte Datum und Beginn angeben.');
      if (bis && brutto(von, bis) === 0) return fehler('Beginn und Ende dürfen nicht gleich sein.');

      /* --- Welche Tage? --- */
      let tage = [datum];
      if (d.modus === 'zeitraum') {
        const bisTag = clean(d.date_bis, 10);
        if (!isValidDate(bisTag)) return fehler('Bitte auch das Ende des Zeitraums angeben.');
        if (bisTag < datum) return fehler('Das Ende des Zeitraums liegt vor dem Anfang.');
        if (diffDays(datum, bisTag) > MAX_ZEITRAUM) {
          return fehler(`Höchstens ${MAX_ZEITRAUM} Tage auf einmal — sonst wird aus einem `
            + 'Vertipper schnell ein halbes Jahr.');
        }
        /* formData liefert bei mehreren gleichnamigen Feldern nur das letzte —
           deshalb hier über getAll() gehen. */
        const gewaehlt = new Set(roh.getAll('wt').map(v => Number(v))
          .filter(n => Number.isInteger(n) && n >= 0 && n <= 6));
        if (!gewaehlt.size) return fehler('Bitte mindestens einen Wochentag auswählen.');

        tage = [];
        for (let t = datum; t <= bisTag; t = addDays(t, 1)) {
          if (gewaehlt.has(weekday(t))) tage.push(t);
        }
        if (!tage.length) return fehler('In diesem Zeitraum liegt keiner der gewählten Wochentage.');
      }

      /* --- Ruhetage und Schließtage überspringen, wenn nicht ausdrücklich gewollt --- */
      const uebersprungen = [];
      if (d.auchzu !== '1') {
        let zu = new Set();
        try {
          zu = new Set(((await db.prepare(
            `SELECT day FROM closures WHERE day >= ? AND day <= ?`)
            .bind(tage[0], tage[tage.length - 1]).all()).results || []).map(r => r.day));
        } catch { /* keine Schließtage-Tabelle */ }
        const bleibt = [];
        for (const t of tage) {
          if (!slotsForDate(t).length) { uebersprungen.push([t, 'Ruhetag']); continue; }
          if (zu.has(t)) { uebersprungen.push([t, 'Schließtag']); continue; }
          bleibt.push(t);
        }
        tage = bleibt;
        if (!tage.length) {
          return fehler('Alle Tage im Zeitraum sind Ruhetage oder Schließtage. Mit dem Haken '
            + '„Auch an Ruhetagen und Schließtagen eintragen" geht es trotzdem.');
        }
      }

      /* --- Überschneidungen --- */
      if (d.egal !== '1') {
        const vorhanden = (await db.prepare(
          `SELECT work_date, start_at, end_at FROM shifts
            WHERE staff_id = ? AND work_date >= ? AND work_date <= ?`)
          .bind(staff, addDays(tage[0], -1), tage[tage.length - 1]).all()).results || [];
        const stoss = [];
        for (const t of tage) {
          const k = kollision(t, von, bis, vorhanden);
          if (k) stoss.push([t, k]);
        }
        if (stoss.length) {
          const [t, k] = stoss[0];
          const wo = stoss.length === 1
            ? `am ${t.slice(8)}.${t.slice(5, 7)}.`
            : `an ${stoss.length} Tagen, zuerst am ${t.slice(8)}.${t.slice(5, 7)}.`;
          return fehler(`${gibtEs.name} hat ${wo} schon eine Schicht `
            + `(${k.start_at}${k.end_at ? '–' + k.end_at : ', läuft noch'}). `
            + 'Nichts eingetragen. Zum Doppeleintrag den Haken „Trotzdem eintragen" setzen.');
        }
      }

      const jetzt = new Date().toISOString();
      const notiz = note || null;
      await db.batch(tage.map(t => db.prepare(
        `INSERT INTO shifts (id,staff_id,work_date,start_at,end_at,break_min,note,source,corrected,created_at)
         VALUES (?,?,?,?,?,?,?, 'admin', 0, ?)`
      ).bind(crypto.randomUUID(), staff, t, von, bis, pause, notiz, jetzt)));

      const uebrig = uebersprungen.length
        ? ` ${uebersprungen.length} ${uebersprungen.length === 1 ? 'Tag' : 'Tage'} übersprungen `
          + `(${[...new Set(uebersprungen.map(u => u[1]))].join(', ')}).`
        : '';
      return redirect(ziel, tage.length === 1
        ? `Zeit für den ${tage[0].slice(8)}.${tage[0].slice(5, 7)}. eingetragen.${uebrig}`
        : `${tage.length} Tage eingetragen (${tage[0].slice(8)}.${tage[0].slice(5, 7)}. bis `
          + `${tage[tage.length - 1].slice(8)}.${tage[tage.length - 1].slice(5, 7)}.).${uebrig}`);
    }

    if (!id) return fehler('Eintrag nicht gefunden.');

    if (d.do === 'save') {
      if (!isValidDate(datum) || !von) return fehler('Bitte Datum und Beginn angeben.');
      if (bis && brutto(von, bis) === 0) return fehler('Beginn und Ende dürfen nicht gleich sein.');
      await db.prepare(
        `UPDATE shifts SET work_date=?, start_at=?, end_at=?, break_min=?, corrected=1, updated_at=?
          WHERE id=?`
      ).bind(datum, von, bis, pause, new Date().toISOString(), id).run();
      return redirect(ziel, 'Eintrag korrigiert.');
    }

    if (d.do === 'del') {
      /* Die gestempelten Pausen hängen an der Schicht. Bleiben sie liegen,
         sammeln sich Zeilen an, zu denen es keine Schicht mehr gibt — und beim
         nächsten Eintrag mit derselben zufälligen ID wären sie plötzlich wieder
         da. SQLite in D1 erzwingt keine Fremdschlüssel, also von Hand. */
      try { await db.prepare(`DELETE FROM shift_breaks WHERE shift_id=?`).bind(id).run(); }
      catch { /* Tabelle gibt es erst ab Migration 0024 */ }
      await db.prepare(`DELETE FROM shifts WHERE id=?`).bind(id).run();
      return redirect(ziel, 'Eintrag gelöscht.');
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect(ziel);
}
