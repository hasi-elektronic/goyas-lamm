/**
 * Dienstplan — wer wann arbeiten soll.
 *
 * ── Was diese Seite ist und was nicht ─────────────────────────────────
 * Sie plant. Sie rechnet nichts ab. Auf dieser Seite steht deshalb **kein
 * einziger Geldbetrag**: keine Stundenlöhne, kein Trinkgeld, keine
 * Hochrechnung. Das ist der Grund, warum sie ohne Chef-PIN auskommt und der
 * Service sie lesen darf — ein Dienstplan, den nur der Chef sehen kann, ist
 * kein Dienstplan, sondern ein Zettel in seiner Schublade.
 *
 * Aufbau: eine Woche als Raster, Zeilen sind Mitarbeiter, Spalten die sieben
 * Tage. Am Fuß jeder Zeile steht **geplant gegen gestempelt** — die Zahl,
 * wegen der man so eine Seite überhaupt baut.
 *
 * ── Warum ein Formular oben statt eines Formulars je Zelle ────────────
 * Sieben Tage mal ein Dutzend Leute sind vierundachtzig Zellen. Ein
 * Eingabefeld in jeder davon wäre am Telefon unbedienbar und im Quelltext
 * ein Vielfaches der Seite. Stattdessen: ein Formular über dem Raster, das
 * Person und Tag als Auswahl führt, und in jeder Zelle nur die eingetragenen
 * Schichten als kleine Marken mit einem ✕. Ein Klick auf eine Marke lädt sie
 * zum Ändern in dasselbe Formular. Kein JavaScript nötig.
 *
 * ── Entwurf und Aushang ───────────────────────────────────────────────
 * Neue Einträge sind Entwürfe (`published = 0`) und tragen im Raster eine
 * gestrichelte Umrandung. „Woche aushängen" setzt alle Einträge der Woche auf
 * veröffentlicht. Der Service sieht ausschließlich veröffentlichte Einträge —
 * sonst diskutiert das halbe Haus über einen Plan, der noch dreimal umgebaut
 * wird.
 */
import { clean, esc, nowBerlin, addDays, weekday, WEEKDAY_DE, HOURS } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { summe, dezimal, toMin, brutto } from '../_lib/zeit.js';
import { darfSchreiben } from '../_lib/auth.js';
import { artLabel as ABW_LABEL } from '../_lib/abwesenheit.js';

const ARTEN = {
  schicht:  { label: 'Schicht',  kurz: '',          farbe: 'schicht' },
  urlaub:   { label: 'Urlaub',   kurz: 'Urlaub',    farbe: 'frei' },
  frei:     { label: 'Frei',     kurz: 'Frei',      farbe: 'frei' },
  abwesend: { label: 'Abwesend', kurz: 'Abwesend',  farbe: 'frei' },
};

/* Vorschläge für die Zeitfelder. Die Küche fängt vor dem Gastraum an und hört
   später auf — deshalb zwei Vorlagen statt einer. */
const VORLAGEN = [
  ['Abend Service', '17:00', '23:00'],
  ['Abend Küche',   '16:00', '23:30'],
  ['Sonntag',       '11:30', '20:30'],
];

/** Montag der Woche, in der `d` liegt. */
function montag(d) {
  const wt = weekday(d);           // 0 = Sonntag
  return addDays(d, wt === 0 ? -6 : 1 - wt);
}

/** Kalenderwoche nach ISO 8601 — die Zahl, die im Haus an der Wand steht. */
function kw(d) {
  const [y, m, t] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, t));
  const tag = (dt.getUTCDay() + 6) % 7;              // Montag = 0
  dt.setUTCDate(dt.getUTCDate() - tag + 3);          // Donnerstag derselben Woche
  const ersterDo = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const versatz = (ersterDo.getUTCDay() + 6) % 7;
  ersterDo.setUTCDate(ersterDo.getUTCDate() - versatz + 3);
  return 1 + Math.round((dt - ersterDo) / (7 * 86400000));
}

const tagKurzDe = d => `${WEEKDAY_DE[weekday(d)].slice(0, 2)} ${+d.slice(8)}.${+d.slice(5, 7)}.`;
const datumDe = d => `${+d.slice(8)}.${+d.slice(5, 7)}.${d.slice(0, 4)}`;
const istDatum = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const istZeit = v => /^\d{2}:\d{2}$/.test(v || '');

/** Geplante Minuten eines Eintrags. Über Mitternacht wird korrekt gerechnet. */
const planMinuten = e =>
  (e.art === 'schicht' && e.start_at && e.end_at) ? (brutto(e.start_at, e.end_at) || 0) : 0;

/* ------------------------------------------------------------------ */
/* Stil                                                               */
/* ------------------------------------------------------------------ */

const CSS = `
.wochekopf{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin:0 0 1.2rem}
.wochekopf .kw{font-weight:700;font-size:1.05rem}
.plan-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table.plan{width:100%;min-width:860px;border-collapse:collapse}
table.plan th,table.plan td{border:1px solid var(--sand);padding:.45rem .5rem;
  vertical-align:top;text-align:left}
table.plan thead th{background:var(--cream);font-size:.74rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted);white-space:nowrap}
table.plan thead th.zu{color:var(--wine)}
table.plan th.wer{width:170px;position:sticky;left:0;background:var(--paper);z-index:1}
table.plan td.wer{position:sticky;left:0;background:var(--paper);z-index:1}
table.plan td.tag{min-width:96px}
table.plan tr:nth-child(even) td{background:rgba(0,0,0,.015)}
table.plan tr:nth-child(even) td.wer{background:var(--paper)}
.wer b{display:block;line-height:1.2}
.wer .rolle{font-size:.76rem;color:var(--muted)}
.marke{display:flex;align-items:center;gap:.3rem;margin:0 0 .25rem;
  border:1px solid var(--sand);border-radius:3px;background:#fff;overflow:hidden}
.marke.entwurf{border-style:dashed}
.marke.frei{background:var(--cream)}
.marke a{flex:1;min-width:0;padding:.3rem .4rem;text-decoration:none;color:var(--ink);
  font-size:.82rem;font-variant-numeric:tabular-nums;white-space:nowrap}
.marke a:hover{color:var(--wine)}
.marke .weg{border:0;background:none;color:var(--muted);cursor:pointer;font:inherit;
  font-size:.9rem;line-height:1;padding:.3rem .4rem}
.marke .weg:hover{color:var(--wine)}
.marke .note{display:block;font-size:.72rem;color:var(--muted);white-space:normal}
.marke.kollision{border-color:var(--wine);box-shadow:inset 2px 0 0 var(--wine)}
td.tag.zu{background:repeating-linear-gradient(135deg,transparent 0 7px,rgba(0,0,0,.035) 7px 14px)}
tfoot td{font-size:.8rem;color:var(--muted);background:var(--cream)}
tfoot .soll{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.plan-legende{display:flex;gap:1.2rem;flex-wrap:wrap;font-size:.8rem;color:var(--muted);
  margin-top:.9rem}
.vorlagen{display:flex;gap:.4rem;flex-wrap:wrap;margin:.2rem 0 0}
.vorlagen a{font-size:.78rem;text-decoration:none;border:1px solid var(--sand);
  border-radius:100px;padding:.25rem .7rem;color:var(--muted)}
.vorlagen a:hover{border-color:var(--wine);color:var(--wine)}
@media print{
  .top,.tabs,.bnav,.wochekopf .btn,.karte-cta,form.eingabe,.plan-legende,.nodruck{display:none!important}
  table.plan{min-width:0;font-size:.82rem}
  .marke .weg{display:none}
  table.plan td.wer,table.plan th.wer{position:static}
  main{padding:0}
}
`;

/* ------------------------------------------------------------------ */
/* Lesen                                                              */
/* ------------------------------------------------------------------ */

async function lies(db, von, bis, nurVeroeffentlicht) {
  const eintraege = (await db.prepare(
    `SELECT id,staff_id,work_date,art,start_at,end_at,rolle,note,published
       FROM shift_plan WHERE work_date BETWEEN ? AND ?${nurVeroeffentlicht ? ' AND published=1' : ''}
      ORDER BY work_date, start_at`).bind(von, bis).all()).results || [];
  return eintraege;
}

/* ------------------------------------------------------------------ */
/* GET                                                                */
/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const rolle = data?.user?.role || 'chef';
  const darf = darfSchreiben(rolle) && rolle === 'chef';
  const heute = nowBerlin().date;

  const wRoh = clean(url.searchParams.get('w'), 10);
  const start = montag(istDatum(wRoh) ? wRoh : heute);
  const tage = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const ende = tage[6];

  let leute = [], plan = [], gestempelt = [], zu = new Set();
  let fehlt = '';
  try {
    leute = (await db.prepare(
      `SELECT id,name,role FROM staff WHERE active=1 ORDER BY sort, name`).all()).results || [];
  } catch { fehlt = 'Die Tabelle „staff" fehlt — bitte Migration 0007_zeit.sql einspielen.'; }

  try {
    plan = await lies(db, start, ende, !darf);
  } catch {
    fehlt = 'Der Dienstplan fehlt noch in der Datenbank — bitte Migration 0021_dienstplan.sql einspielen.';
  }

  try {
    gestempelt = (await db.prepare(
      `SELECT staff_id,work_date,start_at,end_at,break_min FROM shifts
        WHERE work_date BETWEEN ? AND ?`).bind(start, ende).all()).results || [];
  } catch { /* egal */ }

  try {
    const c = (await db.prepare(
      `SELECT day FROM closures WHERE day BETWEEN ? AND ?`).bind(start, ende).all()).results || [];
    zu = new Set(c.map(x => x.day));
  } catch { /* egal */ }

  /* Ruhetag aus den Öffnungszeiten zählt genauso wie ein eingetragener
     Schließtag — an beiden Tagen soll niemand versehentlich eingeplant werden. */
  const geschlossen = d => zu.has(d) || !HOURS[weekday(d)];

  const proZelle = {};
  for (const e of plan) (proZelle[`${e.staff_id}|${e.work_date}`] ||= []).push(e);

  /* Genehmigte Abwesenheiten aus der Personalakte.
     Sie werden hier nur ANGEZEIGT, nicht bearbeitet: Urlaub ist keine
     Planung, sondern eine Zusage. Wer ihn ändern will, tut das dort, wo auch
     das Urlaubskonto steht — sonst gäbe es zwei Wahrheiten. */
  const abwZelle = {};
  try {
    const abw = (await db.prepare(
      `SELECT staff_id, art, von, bis FROM absences
        WHERE status = 'genehmigt' AND von <= ? AND bis >= ?`).bind(ende, start).all()).results || [];
    for (const a of abw) {
      for (const t of tage) if (a.von <= t && t <= a.bis) (abwZelle[`${a.staff_id}|${t}`] ||= []).push(a);
    }
  } catch { /* Migration 0025 fehlt — dann eben ohne */ }

  /* Zum Ändern: ein Eintrag kann ins Formular geladen werden. */
  const editId = clean(url.searchParams.get('e'), 40);
  const edit = editId ? plan.find(e => e.id === editId) : null;
  const vorgabeTag = istDatum(clean(url.searchParams.get('t'), 10))
    ? clean(url.searchParams.get('t'), 10) : (tage.includes(heute) ? heute : tage[0]);
  const vorVon = istZeit(clean(url.searchParams.get('von'), 5)) ? clean(url.searchParams.get('von'), 5) : '17:00';
  const vorBis = istZeit(clean(url.searchParams.get('bis'), 5)) ? clean(url.searchParams.get('bis'), 5) : '23:00';

  const zelle = (m, tag) => {
    const eintraege = proZelle[`${m.id}|${tag}`] || [];
    const abwesend = abwZelle[`${m.id}|${tag}`] || [];
    const hatFrei = eintraege.some(e => e.art !== 'schicht') || abwesend.length > 0;
    return `<td class="tag${geschlossen(tag) ? ' zu' : ''}">
      ${abwesend.map(a => `<div class="marke frei" title="Aus der Personalakte — dort ändern">
        <a href="/admin/personal?id=${encodeURIComponent(m.id)}&t=frei">${esc(ABW_LABEL(a.art))}</a>
      </div>`).join('')}
      ${eintraege.map(e => {
        const a = ARTEN[e.art] || ARTEN.schicht;
        const kollision = e.art === 'schicht' && hatFrei;
        const text = e.art === 'schicht'
          ? `${esc(e.start_at || '')}–${esc(e.end_at || '')}`
          : esc(a.kurz);
        const ziel = `/admin/dienstplan?w=${start}&e=${encodeURIComponent(e.id)}`;
        return `<div class="marke ${a.farbe}${e.published ? '' : ' entwurf'}${kollision ? ' kollision' : ''}">
          ${darf ? `<a href="${ziel}" title="Ändern">` : '<a style="pointer-events:none">'}${text}${
            e.note ? `<span class="note">${esc(e.note)}</span>` : ''}${
            e.rolle ? `<span class="note">${esc(e.rolle)}</span>` : ''}</a>
          ${darf ? `<form method="post" action="/admin/dienstplan" style="display:inline">
            <input type="hidden" name="do" value="weg">
            <input type="hidden" name="id" value="${esc(e.id)}">
            <input type="hidden" name="w" value="${start}">
            <button class="weg" type="submit" title="Löschen" aria-label="Eintrag löschen">✕</button>
          </form>` : ''}
        </div>`;
      }).join('')}
      ${darf ? `<a class="btn sm ghost nodruck"
        href="/admin/dienstplan?w=${start}&p=${encodeURIComponent(m.id)}&t=${tag}#eingabe"
        style="padding:.15rem .45rem;font-size:.72rem">+</a>` : ''}
    </td>`;
  };

  const zeile = m => {
    const meine = plan.filter(e => e.staff_id === m.id);
    const geplant = meine.reduce((s, e) => s + planMinuten(e), 0);
    const ist = summe(gestempelt.filter(x => x.staff_id === m.id));
    return `<tr>
      <td class="wer"><b>${esc(m.name)}</b>
        <span class="rolle">${esc(m.role || '—')}</span>
        <span class="rolle">geplant ${dezimal(geplant)} h${
          ist.gerundet ? ` · gestempelt ${dezimal(ist.gerundet)} h` : ''}</span></td>
      ${tage.map(t => zelle(m, t)).join('')}
    </tr>`;
  };

  const summeTag = t => {
    const min = plan.filter(e => e.work_date === t).reduce((s, e) => s + planMinuten(e), 0);
    const wer = plan.filter(e => e.work_date === t && e.art === 'schicht').length;
    return `<td>${wer ? `<span class="soll">${wer}</span> im Dienst<br>${dezimal(min)} h` : '—'}</td>`;
  };

  const entwuerfe = plan.filter(e => !e.published).length;
  const vorWoche = addDays(start, -7);

  const body = `<style>${CSS}</style>
    <h1>Dienstplan</h1>
    <p class="sub">Wer wann arbeiten soll. Die tatsächlichen Zeiten stehen unter
       <a href="/admin/arbeitszeit">Arbeitszeit</a> — hier steht der Plan daneben.</p>
    ${fehlt ? `<div class="msg err">${esc(fehlt)}</div>` : ''}
    ${flash(url)}

    <div class="wochekopf">
      <span class="kw">KW ${kw(start)}</span>
      <span class="meta">${datumDe(start)} – ${datumDe(ende)}</span>
      <span style="flex:1"></span>
      <a class="btn sm ghost" href="/admin/dienstplan?w=${vorWoche}">← Woche</a>
      <a class="btn sm ghost" href="/admin/dienstplan">Diese Woche</a>
      <a class="btn sm ghost" href="/admin/dienstplan?w=${addDays(start, 7)}">Woche →</a>
      <button class="btn sm ghost" type="button" onclick="window.print()">Drucken</button>
    </div>

    ${darf && entwuerfe ? `<div class="msg">
      <b>${entwuerfe} ${entwuerfe === 1 ? 'Eintrag ist' : 'Einträge sind'} noch Entwurf</b> —
      gestrichelt umrandet, für das Team unsichtbar.
      <form method="post" action="/admin/dienstplan" style="display:inline;margin-left:.6rem">
        <input type="hidden" name="do" value="aushaengen">
        <input type="hidden" name="w" value="${start}">
        <button class="btn sm" type="submit">Woche aushängen</button>
      </form>
    </div>` : ''}

    <div class="card">
      <h2>Woche <em>${leute.length} ${leute.length === 1 ? 'Person' : 'Personen'} im Team</em></h2>
      <div class="plan-scroll">
        <table class="plan">
          <thead><tr>
            <th class="wer">Mitarbeiter</th>
            ${tage.map(t => `<th class="${geschlossen(t) ? 'zu' : ''}">${tagKurzDe(t)}${
              geschlossen(t) ? '<br>geschlossen' : ''}</th>`).join('')}
          </tr></thead>
          <tbody>${leute.length ? leute.map(zeile).join('')
            : `<tr><td colspan="8" class="empty">Niemand aktiv — unter
                 <a href="/admin/personal">Personal</a> anlegen.</td></tr>`}</tbody>
          <tfoot><tr><td class="wer">Im Dienst</td>${tage.map(summeTag).join('')}</tr></tfoot>
        </table>
      </div>
      <div class="body plan-legende">
        <span>Gestrichelt = Entwurf, noch nicht ausgehängt</span>
        <span>Schraffiert = Ruhetag oder Schließtag</span>
        <span>Roter Rand = Schicht an einem Tag mit Urlaub oder Frei</span>
      </div>
    </div>

    ${darf ? `
    <div class="card" id="eingabe">
      <h2>${edit ? 'Eintrag ändern' : 'Eintragen'}</h2>
      <div class="body">
        <form method="post" action="/admin/dienstplan" class="eingabe">
          <input type="hidden" name="do" value="${edit ? 'aendern' : 'neu'}">
          <input type="hidden" name="w" value="${start}">
          ${edit ? `<input type="hidden" name="id" value="${esc(edit.id)}">` : ''}
          <div class="grid">
            <div class="f"><label for="p">Mitarbeiter</label>
              <select id="p" name="p" required>
                ${leute.map(m => `<option value="${esc(m.id)}"${
                  (edit?.staff_id || clean(url.searchParams.get('p'), 40)) === m.id ? ' selected' : ''
                }>${esc(m.name)}</option>`).join('')}
              </select></div>
            <div class="f"><label for="t">Tag</label>
              <select id="t" name="t" required>
                ${tage.map(t => `<option value="${t}"${
                  (edit?.work_date || vorgabeTag) === t ? ' selected' : ''
                }>${tagKurzDe(t)}${geschlossen(t) ? ' · geschlossen' : ''}</option>`).join('')}
              </select></div>
            <div class="f"><label for="art">Art</label>
              <select id="art" name="art">
                ${Object.entries(ARTEN).map(([k, v]) => `<option value="${k}"${
                  (edit?.art || 'schicht') === k ? ' selected' : ''}>${v.label}</option>`).join('')}
              </select></div>
            <div class="f"><label for="von">Von</label>
              <input id="von" name="von" type="time" value="${esc(edit?.start_at || vorVon)}"></div>
            <div class="f"><label for="bis">Bis</label>
              <input id="bis" name="bis" type="time" value="${esc(edit?.end_at || vorBis)}"></div>
            <div class="f"><label for="note">Notiz <span class="meta">optional</span></label>
              <input id="note" name="note" maxlength="60" value="${esc(edit?.note || '')}"
                     placeholder="z. B. nur bis 21 Uhr"></div>
          </div>
          <div class="vorlagen">
            ${VORLAGEN.map(([n, v, b]) =>
              `<a href="/admin/dienstplan?w=${start}&von=${v}&bis=${b}${
                edit ? `&e=${encodeURIComponent(edit.id)}` : ''}#eingabe">${esc(n)} ${v}–${b}</a>`).join('')}
          </div>
          <div class="row end" style="margin-top:1.2rem">
            ${edit ? `<a class="btn ghost" href="/admin/dienstplan?w=${start}#eingabe">Abbrechen</a>` : ''}
            <button class="btn" type="submit">${edit ? 'Ändern' : 'Eintragen'}</button>
          </div>
        </form>
        <p class="hint" style="margin:1rem 0 0">Bei <b>Urlaub</b>, <b>Frei</b> und
          <b>Abwesend</b> werden die Zeiten nicht gespeichert. Einen Grund für die
          Abwesenheit trägt das Panel bewusst nicht ein — Krankmeldungen sind
          Gesundheitsdaten und gehören nicht in diese Datenbank.</p>
      </div>
    </div>

    <div class="card">
      <h2>Vorwoche übernehmen</h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Kopiert alle Einträge aus KW ${kw(vorWoche)}
           in diese Woche — als Entwurf, damit Sie sie noch anpassen können. Geht nur,
           solange diese Woche leer ist.</p>
        <form method="post" action="/admin/dienstplan">
          <input type="hidden" name="do" value="kopieren">
          <input type="hidden" name="w" value="${start}">
          <button class="btn ghost" type="submit"${plan.length ? ' disabled' : ''}
            >KW ${kw(vorWoche)} übernehmen</button>
          ${plan.length ? '<span class="meta" style="margin-left:.7rem">Diese Woche ist nicht leer.</span>' : ''}
        </form>
      </div>
    </div>` : `<p class="hint">Sie sehen den ausgehängten Plan. Ändern kann ihn nur der Chef.</p>`}`;

  return layout({ user: data?.user, title: `Dienstplan KW ${kw(start)}`,
                  active: '/admin/dienstplan', body });
}

/* ------------------------------------------------------------------ */
/* POST                                                               */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env, data }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const rolle = data?.user?.role || 'chef';
  const w = istDatum(clean(d.w, 10)) ? montag(clean(d.w, 10)) : montag(nowBerlin().date);
  const zurueck = (ok) => redirect(`/admin/dienstplan?w=${w}`, ok);
  const fehler = m => redirect(`/admin/dienstplan?w=${w}&err=` + encodeURIComponent(m));

  if (!db) return fehler('Keine Datenbankverbindung.');
  if (rolle !== 'chef') return fehler('Nur der Chef kann den Dienstplan ändern.');

  const ende = addDays(w, 6);
  const jetzt = new Date().toISOString();

  try {
    if (d.do === 'aushaengen') {
      const r = await db.prepare(
        `UPDATE shift_plan SET published=1, updated_at=? WHERE work_date BETWEEN ? AND ? AND published=0`)
        .bind(jetzt, w, ende).run();
      const n = r.meta?.changes || 0;
      return zurueck(n
        ? `${n} ${n === 1 ? 'Eintrag ist' : 'Einträge sind'} jetzt ausgehängt.`
        : 'Es gab nichts auszuhängen.');
    }

    if (d.do === 'weg') {
      const id = clean(d.id, 40);
      if (!id) return fehler('Eintrag nicht gefunden.');
      await db.prepare(`DELETE FROM shift_plan WHERE id=?`).bind(id).run();
      return zurueck('Eintrag gelöscht.');
    }

    if (d.do === 'kopieren') {
      const vorher = await db.prepare(
        `SELECT count(*) n FROM shift_plan WHERE work_date BETWEEN ? AND ?`).bind(w, ende).first();
      if ((vorher?.n || 0) > 0) return fehler('Diese Woche ist nicht leer — bitte zuerst leeren.');
      const alt = (await db.prepare(
        `SELECT staff_id,work_date,art,start_at,end_at,rolle,note FROM shift_plan
          WHERE work_date BETWEEN ? AND ?`).bind(addDays(w, -7), addDays(w, -1)).all()).results || [];
      if (!alt.length) return fehler('In der Vorwoche steht nichts.');
      /* Als Entwurf kopieren: Der Plan der Vorwoche war für die Vorwoche gedacht;
         wer ihn übernimmt, soll ihn noch einmal ansehen, bevor er aushängt. */
      const schritte = alt.map(e => db.prepare(
        `INSERT INTO shift_plan (id,staff_id,work_date,art,start_at,end_at,rolle,note,published,created_at)
         VALUES (?,?,?,?,?,?,?,?,0,?)`)
        .bind(crypto.randomUUID(), e.staff_id, addDays(e.work_date, 7), e.art,
              e.start_at, e.end_at, e.rolle, e.note, jetzt));
      await db.batch(schritte);
      return zurueck(`${alt.length} Einträge übernommen — als Entwurf.`);
    }

    /* --- Neu und Ändern --- */
    const p = clean(d.p, 40);
    const t = clean(d.t, 10);
    const art = ARTEN[clean(d.art, 12)] ? clean(d.art, 12) : 'schicht';
    const note = clean(d.note, 60) || null;
    if (!p) return fehler('Bitte einen Mitarbeiter wählen.');
    if (!istDatum(t)) return fehler('Bitte einen Tag wählen.');

    let von = null, bis = null;
    if (art === 'schicht') {
      von = clean(d.von, 5); bis = clean(d.bis, 5);
      if (!istZeit(von) || !istZeit(bis)) return fehler('Bitte Von- und Bis-Zeit angeben.');
      if (toMin(von) === toMin(bis)) return fehler('Anfang und Ende dürfen nicht gleich sein.');
      /* Über Mitternacht ist erlaubt — in der Gastronomie die Regel, nicht die
         Ausnahme. Länger als sechzehn Stunden ist dagegen ein Tippfehler. */
      if ((brutto(von, bis) || 0) > 16 * 60) {
        return fehler('Mehr als 16 Stunden — bitte die Zeiten prüfen.');
      }
    }

    if (d.do === 'aendern') {
      const id = clean(d.id, 40);
      if (!id) return fehler('Eintrag nicht gefunden.');
      /* Ein geänderter Eintrag geht zurück in den Entwurf: Wer den Plan ändert,
         nachdem er aushing, soll ihn bewusst neu aushängen — sonst merkt das
         Team die Änderung nicht. */
      await db.prepare(
        `UPDATE shift_plan SET staff_id=?, work_date=?, art=?, start_at=?, end_at=?,
                               note=?, published=0, updated_at=? WHERE id=?`)
        .bind(p, t, art, von, bis, note, jetzt, id).run();
      return zurueck('Geändert — der Eintrag ist wieder Entwurf.');
    }

    await db.prepare(
      `INSERT INTO shift_plan (id,staff_id,work_date,art,start_at,end_at,note,published,created_at)
       VALUES (?,?,?,?,?,?,?,0,?)`)
      .bind(crypto.randomUUID(), p, t, art, von, bis, note, jetzt).run();
    return zurueck('Eingetragen.');
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }
}
