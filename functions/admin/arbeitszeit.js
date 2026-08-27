/**
 * Arbeitszeit — Monatsübersicht, Nachtragen, Korrigieren, Export.
 *
 * Ausdrücklich **keine Lohnabrechnung**: hier werden Zeiten erfasst und
 * zusammengezählt. Was daraus wird, entscheidet der Steuerberater.
 */
import {
  clean, esc, nowBerlin, isValidDate, formatDateDE, addDays, weekday, WEEKDAY_DE,
} from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import {
  netto, nettoGerundet, runde, brutto, summe, hhmm, dezimal, monatLabel, istMonat,
  monatVerschieben, tagKurz, zuschlaege, euro, lohnCent, verteileTrinkgeld,
  RUNDUNG_MIN, MINDESTLOHN_CENT, MINIJOB_CENT,
} from '../_lib/zeit.js';

const zeit = v => /^\d{1,2}:\d{2}$/.test(String(v || '').trim())
  ? String(v).trim().padStart(5, '0') : null;

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

  const personKarte = m => {
    const s = alle.filter(x => x.staff_id === m.id);
    if (!s.length && nurWer !== m.id) return '';
    const g = summe(s);
    const zeilen = s.map(x => {
      const n = netto(x);
      return `<tr class="${x.end_at ? '' : 'cancelled'}">
        <td colspan="4" style="padding:0">
          <form method="post" action="/admin/arbeitszeit" class="trow">
            <input type="hidden" name="do" value="save">
            <input type="hidden" name="id" value="${esc(x.id)}">
            <input type="hidden" name="m" value="${esc(monat)}">
            <div class="f"><label for="d-${esc(x.id)}">Tag</label>
              <input id="d-${esc(x.id)}" name="date" type="date" value="${esc(x.work_date)}" required></div>
            <div class="f"><label for="a-${esc(x.id)}">Von</label>
              <input id="a-${esc(x.id)}" name="start" type="time" value="${esc(x.start_at)}" required></div>
            <div class="f"><label for="b-${esc(x.id)}">Bis</label>
              <input id="b-${esc(x.id)}" name="end" type="time" value="${esc(x.end_at || '')}"></div>
            <div class="f"><label for="p-${esc(x.id)}">Pause</label>
              <input id="p-${esc(x.id)}" name="pause" type="number" min="0" max="600" step="5"
                     value="${esc(String(x.break_min || 0))}"></div>
            <div class="trow-act"><button class="btn sm" type="submit">Speichern</button></div>
          </form>
          <div class="trow-sub">
            <span class="meta"><b>${esc(tagKurz(x.work_date))}</b>
              ${n === null ? '<span class="pill ns">läuft noch</span>'
                : `${esc(hhmm(n))} Std.${runde(n) !== n
                    ? ` → gerundet <b>${esc(hhmm(runde(n)))}</b> (${esc(dezimal(runde(n)))})`
                    : ` (${esc(dezimal(n))})`}`}</span>
            ${x.source === 'admin' ? '<span class="pill">nachgetragen</span>' : ''}
            ${x.corrected ? '<span class="pill tel">korrigiert</span>' : ''}
            ${x.note ? `<span class="meta">${esc(x.note)}</span>` : ''}
            <form method="post" action="/admin/arbeitszeit" style="display:inline"
                  onsubmit="return confirm('Diesen Eintrag löschen? Aufzeichnungen müssen zwei Jahre aufbewahrt werden.')">
              <input type="hidden" name="do" value="del">
              <input type="hidden" name="id" value="${esc(x.id)}">
              <input type="hidden" name="m" value="${esc(monat)}">
              <button class="btn sm danger" type="submit">Löschen</button></form>
          </div>
        </td></tr>`;
    }).join('');

    const bruttoLohn = lohnCent(g.gerundet, m.wage_cent);
    const tg = trinkgeld[m.id] || 0;
    const unterMindest = m.wage_cent && m.wage_cent < MINDESTLOHN_CENT;
    const ueberMinijob = bruttoLohn > MINIJOB_CENT;

    return `<div class="card">
      <h2>${esc(m.name)}${m.active ? '' : ' (ausgeschieden)'}
        <em>${dezimal(g.gerundet)} Std. an ${g.tage} ${g.tage === 1 ? 'Tag' : 'Tagen'}</em></h2>
      <div class="body" style="padding-bottom:.3rem">
        <div class="stats" style="margin-bottom:.6rem">
          <div class="stat hot"><b>${dezimal(g.gerundet)}</b><span>Stunden abgerechnet</span></div>
          <div class="stat"><b>${hhmm(g.pause)}</b><span>Pause gesamt</span></div>
          <div class="stat"><b>${dezimal(g.sonntag)}</b><span>davon Sonntag</span></div>
          <div class="stat"><b>${dezimal(g.nacht)}</b><span>davon 20–6 Uhr</span></div>
          ${m.wage_cent ? `<div class="stat"><b>${euro(bruttoLohn)} €</b><span>Lohn brutto, geschätzt</span></div>` : ''}
          ${tg ? `<div class="stat"><b>${euro(tg)} €</b><span>Trinkgeld-Anteil</span></div>` : ''}
        </div>
        ${g.gerundet !== g.arbeit ? `<p class="hint" style="margin:0 0 .5rem">Gestempelt sind
           ${dezimal(g.arbeit)} Std.; abgerechnet wird auf ${RUNDUNG_MIN} Minuten gerundet.
           Die gestempelten Zeiten bleiben unverändert in der Aufzeichnung.</p>` : ''}
        ${unterMindest ? `<div class="msg warn" style="margin:.2rem 0 .6rem">
           <b>${euro(m.wage_cent)} €</b> je Stunde liegt unter dem gesetzlichen Mindestlohn von
           ${euro(MINDESTLOHN_CENT)} € (2026).</div>` : ''}
        ${ueberMinijob ? `<div class="msg warn" style="margin:.2rem 0 .6rem">
           Über der Minijob-Grenze von ${euro(MINIJOB_CENT)} € im Monat — bitte mit dem
           Steuerberater klären, ob das so gewollt ist.</div>` : ''}
      </div>
      ${zeilen ? `<table><tbody>${zeilen}</tbody></table>`
        : '<div class="empty">In diesem Monat keine Zeiten erfasst.</div>'}
      <div class="body">
        <form method="post" action="/admin/arbeitszeit">
          <input type="hidden" name="do" value="add">
          <input type="hidden" name="staff" value="${esc(m.id)}">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="grid">
            <div class="f"><label for="nd-${esc(m.id)}">Tag nachtragen</label>
              <input id="nd-${esc(m.id)}" name="date" type="date" value="${esc(now.date)}" required></div>
            <div class="f"><label for="na-${esc(m.id)}">Von</label>
              <input id="na-${esc(m.id)}" name="start" type="time" value="17:00" required></div>
            <div class="f"><label for="nb-${esc(m.id)}">Bis</label>
              <input id="nb-${esc(m.id)}" name="end" type="time" value="23:00"></div>
            <div class="f"><label for="np-${esc(m.id)}">Pause (Min)</label>
              <input id="np-${esc(m.id)}" name="pause" type="number" min="0" max="600" step="5" value="30"></div>
            <div class="f full"><label for="nn-${esc(m.id)}">Notiz</label>
              <input id="nn-${esc(m.id)}" name="note" maxlength="120"
                     placeholder="z. B. Stempeln vergessen"></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn ghost" type="submit">Eintragen</button></div>
          </div>
        </form>
        <div class="row" style="margin-top:.8rem">
          <a class="btn sm ghost" href="/admin/zeitzettel?m=${esc(monat)}&p=${esc(m.id)}">
            Monatszettel zum Unterschreiben</a>
        </div>
      </div>
    </div>`;
  };

  const auswahl = `<div class="ktabs">
    <a href="/admin/arbeitszeit?m=${esc(monat)}" class="ktab ${nurWer ? '' : 'on'}">Alle</a>
    ${leute.map(m => `<a href="/admin/arbeitszeit?m=${esc(monat)}&p=${encodeURIComponent(m.id)}"
        class="ktab ${nurWer === m.id ? 'on' : ''}">${esc(m.name)}</a>`).join('')}
  </div>`;

  const body = `
    <h1>Arbeitszeit</h1>
    <p class="sub">${esc(monatLabel(monat))}${nurWer ? ' · ' + esc(namen[nurWer] || '') : ''}
       — erfasste Zeiten, Korrekturen und der Auszug für den Steuerberater.</p>
    ${flash(url)}

    <div class="row" style="margin-bottom:1.2rem">
      <a class="btn ghost" href="/admin/arbeitszeit?m=${monatVerschieben(monat, -1)}${nurWer ? '&p=' + encodeURIComponent(nurWer) : ''}">&larr; ${esc(monatLabel(monatVerschieben(monat, -1)))}</a>
      <a class="btn ghost" href="/admin/arbeitszeit?m=${esc(now.date.slice(0, 7))}">Aktueller Monat</a>
      <a class="btn ghost" href="/admin/arbeitszeit?m=${monatVerschieben(monat, 1)}${nurWer ? '&p=' + encodeURIComponent(nurWer) : ''}">${esc(monatLabel(monatVerschieben(monat, 1)))} &rarr;</a>
      <span class="spacer"></span>
      <a class="btn" href="/admin/arbeitszeit?m=${esc(monat)}&csv=1">CSV für den Steuerberater</a>
      <a class="btn ghost" href="/admin/trinkgeld?m=${esc(monat)}">Trinkgeld</a>
      <a class="btn ghost" href="/admin/stempel">Stempeluhr</a>
    </div>

    <div class="stats">
      <div class="stat hot"><b>${dezimal(gesamt.gerundet)}</b><span>Stunden im Monat</span></div>
      <div class="stat"><b>${gesamt.anzahl}</b><span>Schichten</span></div>
      <div class="stat"><b>${dezimal(gesamt.sonntag)}</b><span>Sonntagsstunden</span></div>
      ${lohnBekannt ? `<div class="stat"><b>${euro(leute.reduce((sum, m) =>
          sum + lohnCent(summe(alle.filter(x => x.staff_id === m.id)).gerundet, m.wage_cent), 0))} €</b>
        <span>Lohn brutto, geschätzt</span></div>` : ''}
      <div class="stat ${gesamt.offen ? 'hot' : ''}"><b>${gesamt.offen}</b><span>ohne Feierabend</span></div>
    </div>

    ${gesamt.offen ? `<div class="msg warn">Es ${gesamt.offen === 1 ? 'gibt eine Schicht' : `gibt ${gesamt.offen} Schichten`}
       ohne Feierabend. Bitte unten das Ende eintragen — sonst fehlt die Dauer in der Aufzeichnung.</div>` : ''}

    ${auswahl}

    ${leute.map(personKarte).join('') || '<div class="card"><div class="empty">Noch niemand angelegt.</div></div>'}

    <div class="card">
      <h2>Was diese Seite ist — und was nicht</h2>
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
        <p style="margin:0 0 .6rem"><b>Gerundet wird auf ${RUNDUNG_MIN} Minuten</b> — und zwar
           kaufmännisch, zur nächsten Stufe: 5:16 wird 5:15, 5:18 wird 5:20. Wer den Beginn hoch
           und das Ende herunter rundet, kürzt systematisch die Arbeitszeit; das ist
           arbeitsrechtlich unwirksam und beim Zoll ein Fehlbetrag, kein Rundungsfehler.
           <b>Die gestempelten Zeiten bleiben unverändert gespeichert</b> — sie sind die
           Aufzeichnung, die Rundung ist nur die Rechengrundlage. Im CSV stehen beide Werte.</p>
        <p style="margin:0 0 .6rem"><b>Der Lohnbetrag ist eine Schätzung.</b> Stunden mal
           Stundenlohn, brutto — ohne Steuern, ohne Sozialabgaben, ohne Zuschläge für Sonntag und
           Nacht. Das Panel warnt nur, wenn der Stundenlohn unter dem Mindestlohn liegt oder der
           Monatsbetrag über der Minijob-Grenze. Gerechnet wird die Abrechnung beim Steuerberater.</p>
        <p style="margin:0"><b>Korrekturen</b> sind erlaubt und normal — wer das Stempeln
           vergisst, trägt nach. Nachgetragene und geänderte Einträge werden als solche
           gekennzeichnet, damit die Aufzeichnung ehrlich bleibt.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Arbeitszeit', active: '/admin/arbeitszeit', body });
}

/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
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
      const gibtEs = await db.prepare(`SELECT id FROM staff WHERE id=?`).bind(staff).first();
      if (!gibtEs) return fehler('Diesen Mitarbeiter gibt es nicht.');
      if (!isValidDate(datum) || !von) return fehler('Bitte Datum und Beginn angeben.');
      if (bis && brutto(von, bis) === 0) return fehler('Beginn und Ende dürfen nicht gleich sein.');
      await db.prepare(
        `INSERT INTO shifts (id,staff_id,work_date,start_at,end_at,break_min,note,source,corrected,created_at)
         VALUES (?,?,?,?,?,?,?, 'admin', 0, ?)`
      ).bind(crypto.randomUUID(), staff, datum, von, bis, pause, note || null,
             new Date().toISOString()).run();
      return redirect(ziel, `Zeit für den ${datum.slice(8)}.${datum.slice(5, 7)}. eingetragen.`);
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
      await db.prepare(`DELETE FROM shifts WHERE id=?`).bind(id).run();
      return redirect(ziel, 'Eintrag gelöscht.');
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect(ziel);
}
