/**
 * Inventur und Wareneinsatz.
 *
 * ── Warum es hier keinen Echtzeit-Bestand gibt ────────────────────────
 * Ohne Anbindung an eine Kasse weiß das System nicht, was verkauft wurde. Ein
 * Bestand, der jeden Verkauf mitzählt, wäre also erfunden. Stattdessen wird
 * gezählt:
 *
 *     Anfangsbestand + Einkauf − Endbestand = Wareneinsatz
 *
 * Was nicht mehr im Regal steht, ist verbraucht — ob gekocht, verdorben oder
 * verschwunden, unterscheidet die Rechnung nicht. Genau darum ist die Zahl
 * etwas wert: Sie enthält den Schwund, den eine Rezepturkalkulation gerade
 * nicht sieht.
 *
 * ── Bewertung ─────────────────────────────────────────────────────────
 * Jede gezählte Menge wird mit dem **letzten bekannten Einkaufspreis** bis zum
 * Stichtag bewertet. Wer es genauer will, trägt beim Zählen einen eigenen Preis
 * ein. Ohne jeden Preis bleibt der Artikel mit 0 € stehen — sichtbar, nicht
 * stillschweigend weggelassen.
 *
 * Liegt hinter der Chef-PIN, weil hier Geld steht.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { monatLabel, monatVerschieben } from '../_lib/zeit.js';
import {
  ORTE, einheitLabel, euro, menge, mengeAus, centAus, positionCent,
  wareneinsatz, quote, kennung, istMonat, istTag,
} from '../_lib/ware.js';

const MIGRATION = 'Die Tabellen für den Wareneingang fehlen noch — '
  + 'bitte Migration 0011_ware.sql einspielen.';

/** Letzter Tag eines Monats, ohne Zeitzonendrift. */
function monatsEnde(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
}

/** Preis je Einheit aus der letzten Lieferung bis einschließlich `bis`. */
async function letztePreise(db, bis) {
  const r = (await db.prepare(
    `SELECT i.article_id, i.ep_cent FROM delivery_items i
       JOIN deliveries d ON d.id = i.delivery_id
      WHERE i.ep_cent IS NOT NULL AND d.day <= ?
      ORDER BY d.day, i.sort`).bind(bis).all()).results || [];
  const aus = {};
  for (const z of r) aus[z.article_id] = z.ep_cent;   // spätere überschreiben frühere
  return aus;
}

/**
 * Wert der letzten Zählung bis einschließlich `bis`.
 * @returns {Promise<{cent:number, tag:string|null, posten:number}>}
 */
async function bestandBis(db, bis, preise) {
  const tagR = await db.prepare(
    `SELECT day FROM stock_counts WHERE day <= ? ORDER BY day DESC LIMIT 1`).bind(bis).first();
  if (!tagR) return { cent: 0, tag: null, posten: 0 };
  const zeilen = (await db.prepare(
    `SELECT article_id, menge_milli, ep_cent FROM stock_counts WHERE day = ?`)
    .bind(tagR.day).all()).results || [];
  let cent = 0;
  for (const z of zeilen) cent += positionCent(z.menge_milli, z.ep_cent ?? preise[z.article_id] ?? 0);
  return { cent, tag: tagR.day, posten: zeilen.length };
}

/* ================================================================== */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const heute = nowBerlin().date;
  const monat = istMonat(url.searchParams.get('m'))
    ? url.searchParams.get('m') : heute.slice(0, 7);
  const ende = monatsEnde(monat);
  const vorMonat = monatVerschieben(monat, -1);

  /* Stichtag: der letzte Tag des Monats, aber nie in der Zukunft. */
  const stichtag = istTag(url.searchParams.get('t'))
    ? url.searchParams.get('t') : (ende > heute ? heute : ende);

  let artikel = [], gezaehlt = [], einkauf = 0, fehler = '';
  let anfang = { cent: 0, tag: null, posten: 0 };
  let schluss = { cent: 0, tag: null, posten: 0 };
  let preise = {}, umsatzCent = 0;

  try {
    artikel = (await db.prepare(
      `SELECT id, name, einheit, lagerort, gruppe FROM articles WHERE active = 1
        ORDER BY lagerort, gruppe, sort, name`).all()).results || [];

    const posten = (await db.prepare(
      `SELECT i.menge_milli, i.ep_cent FROM delivery_items i
         JOIN deliveries d ON d.id = i.delivery_id
        WHERE d.day >= ? AND d.day <= ?`).bind(monat + '-01', ende).all()).results || [];
    einkauf = posten.reduce((s, p) => s + positionCent(p.menge_milli, p.ep_cent), 0);

    preise = await letztePreise(db, ende);
    anfang = await bestandBis(db, monatsEnde(vorMonat), await letztePreise(db, monatsEnde(vorMonat)));
    schluss = await bestandBis(db, ende, preise);

    gezaehlt = (await db.prepare(
      `SELECT article_id, menge_milli, ep_cent FROM stock_counts WHERE day = ?`)
      .bind(stichtag).all()).results || [];

    const u = await db.prepare(`SELECT v FROM settings WHERE k = ?`)
      .bind('umsatz_' + monat).first();
    umsatzCent = parseInt(u?.v, 10) || 0;
  } catch { fehler = MIGRATION; }

  const zaehlung = Object.fromEntries(gezaehlt.map(z => [z.article_id, z]));
  const einsatz = wareneinsatz(anfang.cent, einkauf, schluss.cent);
  const q = quote(einsatz, umsatzCent);

  /* --- Zählliste nach Lagerort ---------------------------------- */
  const orte = [...ORTE, null].filter(o =>
    artikel.some(a => (a.lagerort || null) === o));

  const zeile = a => {
    const z = zaehlung[a.id];
    const p = z?.ep_cent ?? preise[a.id] ?? null;
    return `<div class="prow" style="grid-template-columns:minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)">
      <div class="f artikel"><label>Artikel</label>
        <div style="padding:.5rem 0;font-weight:600">${esc(a.name)}
          <span class="meta" style="font-weight:400"> · ${esc(einheitLabel(a.einheit))}</span></div>
        <input type="hidden" name="art" value="${esc(a.id)}"></div>
      <div class="f"><label>Gezählt</label>
        <input name="menge" inputmode="decimal" maxlength="12"
               value="${z ? esc(menge(z.menge_milli, a.einheit)) : ''}" placeholder="0"></div>
      <div class="f"><label>€ je Einheit</label>
        <input name="ep" inputmode="decimal" maxlength="12"
               value="${z?.ep_cent ? esc(euro(z.ep_cent)) : ''}"
               placeholder="${p ? esc(euro(p)) : '—'}"></div>
      <div class="f"><label>Wert</label>
        <div style="padding:.5rem 0;font-variant-numeric:tabular-nums">${
          z ? esc(euro(positionCent(z.menge_milli, z.ep_cent ?? p ?? 0))) + ' €'
            : '<span class="meta">—</span>'}</div></div>
    </div>`;
  };

  const leerAmpel = q === null ? ''
    : q >= 35 ? 'schlecht' : (q >= 25 && q <= 32 ? 'gut' : '');

  const body = `
    <h1>Inventur</h1>
    <p class="sub">${esc(monatLabel(monat))} — was eingekauft, was gezählt und was
       daraus verbraucht wurde.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="/admin/inventur?m=${monatVerschieben(monat, -1)}">← ${
        esc(monatLabel(monatVerschieben(monat, -1)).split(' ')[0])}</a>
      <a class="btn ghost" href="/admin/inventur">Aktueller Monat</a>
      <a class="btn ghost" href="/admin/inventur?m=${monatVerschieben(monat, 1)}">${
        esc(monatLabel(monatVerschieben(monat, 1)).split(' ')[0])} →</a>
      <span class="spacer"></span>
      <a class="btn ghost" href="/admin/preise">Einkaufspreise</a>
      <a class="btn ghost" href="/admin/ware?m=${esc(monat)}">Wareneingang</a>
    </div>

    <div class="stats">
      <div class="stat"><b>${euro(anfang.cent)} €</b><span>Anfangsbestand</span></div>
      <div class="stat"><b>${euro(einkauf)} €</b><span>Einkauf im Monat</span></div>
      <div class="stat"><b>${euro(schluss.cent)} €</b><span>Endbestand</span></div>
      <div class="stat hot"><b>${euro(einsatz)} €</b><span>Wareneinsatz</span></div>
      <div class="stat ${leerAmpel === 'schlecht' ? 'hot' : ''}">
        <b>${q === null ? '—' : String(q).replace('.', ',') + ' %'}</b><span>Quote vom Umsatz</span></div>
    </div>

    <div class="card">
      <h2>Umsatz des Monats <em>aus der Kasse</em></h2>
      <div class="body">
        <form method="post" action="/admin/inventur" class="row" style="align-items:flex-end">
          <input type="hidden" name="do" value="umsatz">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="f" style="max-width:220px"><label for="ums">Netto-Umsatz €</label>
            <input id="ums" name="umsatz" inputmode="decimal" maxlength="14"
                   value="${umsatzCent ? esc(euro(umsatzCent)) : ''}" placeholder="z. B. 31450,00"></div>
          <button class="btn" type="submit">Speichern</button>
          <span class="spacer"></span>
        </form>
        <p class="hint" style="margin-top:.9rem">Wird nur für die Quote gebraucht und
          sonst nirgends verwendet. Ohne Umsatz bleibt die Quote leer — der
          Wareneinsatz in Euro stimmt trotzdem.</p>
      </div>
    </div>

    ${anfang.tag ? '' : `<div class="msg warn">Für den Vormonat gibt es noch keine Zählung.
      Der Anfangsbestand wird deshalb mit 0 € gerechnet und der Wareneinsatz ist im
      ersten Monat zu hoch. Ab der zweiten Inventur stimmt die Zahl.</div>`}

    <div class="card">
      <h2>Zählung <em>Stichtag ${esc(stichtag)}${schluss.posten ? ` · ${schluss.posten} Posten` : ''}</em></h2>
      <div class="body">
        <form method="post" action="/admin/inventur">
          <input type="hidden" name="do" value="zaehlen">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="row" style="margin-bottom:1.2rem;align-items:flex-end">
            <div class="f" style="max-width:220px"><label for="st">Stichtag</label>
              <input id="st" name="tag" type="date" value="${esc(stichtag)}" max="${esc(heute)}"></div>
            <span class="meta">Am besten der letzte Öffnungstag des Monats, vor der
              ersten Lieferung des Folgemonats.</span>
          </div>

          ${artikel.length ? orte.map(o => `
            <h2 style="margin:1.6rem 0 .3rem;font-size:.72rem;letter-spacing:.18em;
                       text-transform:uppercase;color:var(--muted)">${esc(o || 'Ohne Lagerort')}</h2>
            ${artikel.filter(a => (a.lagerort || null) === o).map(zeile).join('')}
          `).join('') : `<div class="empty">Noch keine Artikel angelegt.<br>
            <span class="meta">Unter <a href="/admin/lager">Artikel &amp; Lieferanten</a> anfangen.</span></div>`}

          ${artikel.length ? `<div class="row end" style="margin-top:1.4rem">
            <button class="btn" type="submit">Zählung speichern</button></div>` : ''}
        </form>
      </div>
    </div>

    <details class="card">
      <summary>Wie die Zahl zustande kommt — und was sie wert ist</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Anfangsbestand + Einkauf − Endbestand.</b>
           Ohne Kassenanbindung ist das der einzig ehrliche Weg. Was nicht mehr da
           ist, gilt als verbraucht — gekocht, verdorben oder verschwunden macht
           für die Rechnung keinen Unterschied. Genau deshalb ist die Zahl
           brauchbar: Sie enthält den Schwund.</p>
        <p style="margin:0 0 .6rem"><b>Bewertet wird mit dem letzten bekannten
           Einkaufspreis</b> bis zum Stichtag. Ein eigener Preis in der Zeile
           schlägt ihn. Artikel ohne jeden Preis stehen mit 0 € da — sichtbar,
           damit man es merkt.</p>
        <p style="margin:0 0 .6rem"><b>Zur Einordnung:</b> In der Gastronomie
           gelten stabile 25 bis 30 Prozent als üblich. Wer dauerhaft über 35
           Prozent liegt, ohne dass es eine Erklärung gibt, hat meist an einer
           konkreten Stelle ein Problem — zu große Portionen, zu viel Verderb,
           zu teuer eingekauft oder etwas, das nicht bezahlt wird.</p>
        <p style="margin:0"><b>Ein einzelner Monat sagt wenig.</b> Wer am 3. eine
           Großbestellung annimmt und am 31. das halbe Lager voll hat, bekommt
           eine schiefe Quote. Aussagekräftig wird sie ab dem dritten Monat mit
           gleicher Zählweise und gleichem Stichtag.</p>
      </div>
    </details>`;

  return layout({ user: data?.user, title: 'Inventur', active: '/admin/inventur', body });
}

/* ================================================================== */

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }

  const monat = istMonat(clean(form.get('m'), 7)) ? clean(form.get('m'), 7)
    : nowBerlin().date.slice(0, 7);
  const zurueck = `/admin/inventur?m=${monat}`;
  const fehler = m => redirect(`${zurueck}&err=${encodeURIComponent(m)}`);
  if (!db) return fehler('Keine Datenbankverbindung.');

  try {
    if (clean(form.get('do'), 12) === 'umsatz') {
      const roh = String(form.get('umsatz') ?? '').trim();
      if (!roh) {
        await db.prepare(`DELETE FROM settings WHERE k = ?`).bind('umsatz_' + monat).run();
        return redirect(zurueck, 'Umsatz entfernt.');
      }
      const cent = centAus(roh);
      if (cent === null || cent < 0) return fehler('Umsatz bitte als Zahl angeben, z. B. 31450,00.');
      await db.prepare(
        `INSERT INTO settings (k,v) VALUES (?,?)
           ON CONFLICT(k) DO UPDATE SET v = excluded.v`)
        .bind('umsatz_' + monat, String(cent)).run();
      return redirect(zurueck, `Umsatz ${euro(cent)} € gespeichert.`);
    }

    /* --- Zählung ------------------------------------------------- */
    const heute = nowBerlin().date;
    let tag = clean(form.get('tag'), 10);
    if (!istTag(tag) || tag > heute) tag = monatsEnde(monat) > heute ? heute : monatsEnde(monat);

    const arts = form.getAll('art');
    const mengen = form.getAll('menge');
    const preise = form.getAll('ep');
    const jetzt = new Date().toISOString();
    const wer = data?.user?.name || data?.user?.username || null;

    /* Eine Zählung ersetzt die vorige desselben Tages vollständig — sonst
       bliebe ein Artikel stehen, der beim zweiten Durchgang leer war.
       Alles in einem `batch()`: Bei über hundert Artikeln wären hundert
       einzelne Fahrten zur Datenbank innerhalb einer Anfrage zu langsam, und
       ein Abbruch mittendrin hinterließe eine halb gelöschte Inventur. */
    const schritte = [db.prepare(`DELETE FROM stock_counts WHERE day = ?`).bind(tag)];

    for (let i = 0; i < arts.length; i++) {
      const id = clean(arts[i], 40);
      const m = mengeAus(mengen[i]);
      if (!id || m === null || m < 0) continue;
      if (m === 0 && !String(mengen[i] ?? '').trim()) continue;   // leer ≠ null gezählt
      schritte.push(db.prepare(
        `INSERT INTO stock_counts (id,day,article_id,menge_milli,ep_cent,erfasst_von,created_at)
         VALUES (?,?,?,?,?,?,?)`)
        .bind(kennung('z'), tag, id, m, centAus(preise[i]), wer, jetzt));
    }
    await db.batch(schritte);
    const n = schritte.length - 1;
    return redirect(`${zurueck}&t=${tag}`,
      `Zählung vom ${tag} gespeichert — ${n} ${n === 1 ? 'Posten' : 'Posten'}.`);
  } catch {
    return fehler(`Das hat nicht geklappt. ${MIGRATION}`);
  }
}
