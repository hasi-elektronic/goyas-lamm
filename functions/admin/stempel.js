/**
 * Stempeluhr für das Tablet in der Küche.
 * Große Kacheln, PIN-Feld, zwei Knöpfe. Eigenes, sehr ruhiges Layout —
 * das hier bedient niemand mit Zeit zum Suchen.
 *
 * Liegt bewusst unter /admin, damit die Sitzungsprüfung greift. Das Tablet
 * bleibt 30 Tage angemeldet; wer die Uhr bedient, braucht kein eigenes Konto.
 */
import { clean, esc, nowBerlin, formatDateDE } from '../_lib/core.js';
import { pinHash, brutto, hhmm } from '../_lib/zeit.js';

const CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{--wine:#6D1826;--ink:#14120F;--cream:#F4F7EA;--paper:#FBFAF3;--sand:#E4DED0;
  --gold:#C0A062;--muted:#6E675A;--ok:#2E6B4F}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--cream);min-height:100svh;
  font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.wrap{width:min(100% - 1.6rem,940px);margin:0 auto;padding:1.4rem 0 3rem}
.kopf{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;
  border-bottom:1px solid rgba(244,247,234,.16);padding-bottom:.9rem;margin-bottom:1.4rem}
.kopf h1{font-size:1.3rem;margin:0;letter-spacing:-.01em}
.kopf .d{color:rgba(244,247,234,.6);font-size:.85rem}
.kopf a{color:rgba(244,247,234,.55);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
  text-decoration:none;border:1px solid rgba(244,247,234,.22);padding:.45rem .8rem;border-radius:2px}
.uhr{font-variant-numeric:tabular-nums;font-size:2.6rem;font-weight:700;letter-spacing:-.02em;line-height:1}
.msg{padding:1rem 1.2rem;border-left:3px solid var(--ok);background:rgba(46,107,79,.16);
  margin-bottom:1.2rem;font-size:1rem}
.msg.err{border-left-color:var(--gold);background:rgba(192,160,98,.14)}
.leute{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.8rem}
.p{display:block;text-decoration:none;color:inherit;background:#1e1a17;
  border:1px solid rgba(244,247,234,.14);border-radius:3px;padding:1.1rem 1.1rem 1rem;min-height:112px}
.p:hover{border-color:var(--gold)}
.p b{display:block;font-size:1.15rem;line-height:1.25}
.p .r{font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,247,234,.45);
  margin-top:.3rem}
.p .st{margin-top:.7rem;font-size:.82rem;color:rgba(244,247,234,.6)}
.p.an{background:var(--wine);border-color:var(--wine)}
.p.an .r,.p.an .st{color:rgba(255,255,255,.78)}
.p.an .st b{display:inline;font-size:.82rem}
.leer{padding:3rem 1rem;text-align:center;color:rgba(244,247,234,.55)}

/* PIN-Ansicht */
.pin{max-width:420px;margin:0 auto;text-align:center}
.pin h2{font-size:1.5rem;margin:0 0 .2rem}
.pin .r{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:1.4rem}
.pin input{width:100%;font:inherit;font-size:2rem;letter-spacing:.6em;text-align:center;
  padding:.8rem .4rem;border:1px solid rgba(244,247,234,.24);background:#1e1a17;color:#fff;
  border-radius:3px;margin-bottom:1rem}
.pin input:focus{outline:0;border-color:var(--gold)}
.tasten{display:flex;gap:.7rem;flex-direction:column}
.b{display:block;width:100%;font:inherit;font-size:.95rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;padding:1.15rem 1rem;border-radius:3px;border:1px solid transparent;cursor:pointer}
.b.kommen{background:var(--ok);color:#fff}
.b.gehen{background:var(--wine);color:#fff}
.b.zurueck{background:none;color:rgba(244,247,234,.6);border-color:rgba(244,247,234,.22)}
.hinweis{margin-top:1.6rem;font-size:.82rem;color:rgba(244,247,234,.45);line-height:1.6}
`;

const seite = (inhalt, { titel = 'Stempeluhr' } = {}) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titel)} — Goya´s Lamm</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><meta name="theme-color" content="#14120F">
<style>${CSS}</style></head><body><div class="wrap">${inhalt}</div></body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const zurueck = (flash, typ = 'ok') =>
  new Response(null, { status: 303, headers: {
    location: `/admin/stempel?${typ}=` + encodeURIComponent(flash), 'cache-control': 'no-store' } });

const PIN_MAX = 5;          // Fehlversuche
const PIN_SPERRE = 10;      // Minuten

/** @returns {Promise<number>} verbleibende Sperrminuten, 0 = frei */
async function pinGesperrt(db, key) {
  if (!db) return 0;
  try {
    const r = await db.prepare(
      `SELECT fails, last_at FROM login_attempts WHERE ip_hash=?`).bind(key).first();
    if (!r || r.fails < PIN_MAX) return 0;
    const min = (Date.now() - Date.parse(r.last_at)) / 60000;
    return min >= PIN_SPERRE ? 0 : Math.ceil(PIN_SPERRE - min);
  } catch { return 0; }
}

async function pinFehler(db, key) {
  if (!db) return;
  const jetzt = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO login_attempts (ip_hash, fails, last_at) VALUES (?, 1, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         fails = CASE WHEN (julianday(?) - julianday(last_at)) * 1440 >= ${PIN_SPERRE}
                      THEN 1 ELSE fails + 1 END,
         last_at = ?`).bind(key, jetzt, jetzt, jetzt).run();
  } catch { /* nicht kritisch */ }
}

const pinOk = (db, key) => db
  ? db.prepare(`DELETE FROM login_attempts WHERE ip_hash=?`).bind(key).run().catch(() => {})
  : Promise.resolve();

async function laufende(db) {
  try {
    return Object.fromEntries(((await db.prepare(
      `SELECT id,staff_id,work_date,start_at FROM shifts WHERE end_at IS NULL`).all()).results || [])
      .map(r => [r.staff_id, r]));
  } catch { return {}; }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();

  let leute = [];
  try {
    leute = (await db.prepare(
      `SELECT id,name,role FROM staff WHERE active=1 AND pin_hash IS NOT NULL ORDER BY sort, name`
    ).all()).results || [];
  } catch {
    return seite(`<div class="msg err">Die Arbeitszeiterfassung ist noch nicht eingerichtet
      (Migration 0007_zeit.sql fehlt).</div>
      <p><a class="b zurueck" href="/admin">Zurück zum Panel</a></p>`);
  }

  const offen = await laufende(db);
  const meldung = url.searchParams.get('ok');
  const problem = url.searchParams.get('err');

  const kopf = `<div class="kopf">
      <div><h1>Stempeluhr</h1>
        <div class="d">${esc(formatDateDE(now.date))}</div></div>
      <div style="text-align:right">
        <div class="uhr">${esc(now.time)}</div>
        <a href="/admin" style="display:inline-block;margin-top:.6rem">Panel</a></div>
    </div>`;

  /* Einzelansicht mit PIN */
  const wer = url.searchParams.get('p');
  if (wer) {
    const m = leute.find(x => x.id === wer);
    if (!m) return zurueck('Diese Person gibt es nicht mehr.', 'err');
    const o = offen[m.id];
    return seite(`${kopf}
      ${problem ? `<div class="msg err">${esc(problem)}</div>` : ''}
      <form class="pin" method="post" action="/admin/stempel">
        <input type="hidden" name="id" value="${esc(m.id)}">
        <h2>${esc(m.name)}</h2>
        <div class="r">${esc(m.role || '')}</div>
        ${o ? `<div class="msg">Im Dienst seit <b>${esc(o.start_at)} Uhr</b>${
              o.work_date !== now.date ? ` (${esc(o.work_date.slice(8))}.${esc(o.work_date.slice(5, 7))}.)` : ''}
              — aktuell ${esc(hhmm(brutto(o.start_at, now.time)))} Std.</div>` : ''}
        <label for="pin" style="display:block;font-size:.72rem;letter-spacing:.18em;
          text-transform:uppercase;color:rgba(244,247,234,.55);margin-bottom:.5rem">PIN</label>
        <input id="pin" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4"
               autocomplete="off" autofocus required>
        ${/* Fünferschritte wie bei der Abrechnung — eine Pause von 20 oder 25 Minuten
             gibt es im Betrieb wirklich, und sie soll ehrlich eintragbar sein. */ ''}
        ${o ? `<label for="pause" style="display:block;font-size:.72rem;letter-spacing:.18em;
            text-transform:uppercase;color:rgba(244,247,234,.55);margin:.4rem 0 .5rem">Pause</label>
          <select id="pause" name="pause" style="width:100%;font:inherit;font-size:1.05rem;
            padding:.85rem .8rem;border:1px solid rgba(244,247,234,.24);background:#1e1a17;
            color:#fff;border-radius:3px;margin-bottom:1rem">
            <option value="0">keine Pause</option>
            <option value="5">5 Minuten</option>
            <option value="10">10 Minuten</option>
            <option value="15">15 Minuten</option>
            <option value="20">20 Minuten</option>
            <option value="25">25 Minuten</option>
            <option value="30">30 Minuten</option>
            <option value="35">35 Minuten</option>
            <option value="40">40 Minuten</option>
            <option value="45">45 Minuten</option>
            <option value="50">50 Minuten</option>
            <option value="55">55 Minuten</option>
            <option value="60">60 Minuten</option>
            <option value="65">65 Minuten</option>
            <option value="70">70 Minuten</option>
            <option value="75">75 Minuten</option>
            <option value="80">80 Minuten</option>
            <option value="85">85 Minuten</option>
            <option value="90">90 Minuten</option>
          </select>` : ''}
        <div class="tasten">
          ${o ? `<button class="b gehen" name="do" value="gehen" type="submit">Feierabend</button>`
               : `<button class="b kommen" name="do" value="kommen" type="submit">Kommen</button>`}
          <a class="b zurueck" href="/admin/stempel" style="text-decoration:none">Zurück</a>
        </div>
        <p class="hinweis">${o
          ? 'Pause bitte ehrlich eintragen — sie wird von der Arbeitszeit abgezogen.'
          : 'Die Zeit läuft ab dem Moment, in dem du auf „Kommen" tippst.'}</p>
      </form>`, { titel: m.name });
  }

  /* Übersicht */
  const kacheln = leute.map(m => {
    const o = offen[m.id];
    return `<a class="p ${o ? 'an' : ''}" href="/admin/stempel?p=${encodeURIComponent(m.id)}">
      <b>${esc(m.name)}</b>
      <div class="r">${esc(m.role || '')}</div>
      <div class="st">${o
        ? `seit <b>${esc(o.start_at)}</b> · ${esc(hhmm(brutto(o.start_at, now.time)))} Std.`
        : 'nicht im Dienst'}</div>
    </a>`;
  }).join('');

  return seite(`${kopf}
    ${meldung ? `<div class="msg">${esc(meldung)}</div>` : ''}
    ${problem ? `<div class="msg err">${esc(problem)}</div>` : ''}
    ${leute.length
      ? `<div class="leute">${kacheln}</div>`
      : `<div class="leer">Noch niemand mit PIN angelegt.<br>
           <a href="/admin/personal" style="color:var(--gold)">Zum Personal</a></div>`}
    <p class="hinweis">Antippen, PIN eingeben, fertig. Vergessen zu stempeln? Der Chef kann
       die Zeit unter „Arbeitszeit" nachtragen.<br><br>
       Wer mit dem eigenen Telefon stempeln will, braucht diese Seite nicht: Unter
       <b>${esc(new URL(request.url).host)}/zeit</b> gibt es die Uhr ohne Anmeldung —
       dort führt die PIN allein zum Ziel. Eine gute Adresse fürs Lesezeichen.</p>`);
}

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const now = nowBerlin();
  const id = clean(d.id, 40);
  const pin = clean(d.pin, 8).replace(/\D/g, '');
  const zurZeile = m => new Response(null, { status: 303, headers: {
    location: `/admin/stempel?p=${encodeURIComponent(id)}&err=` + encodeURIComponent(m),
    'cache-control': 'no-store' } });

  if (!db || !id) return zurueck('Da ist etwas schiefgelaufen.', 'err');

  const m = await db.prepare(`SELECT id,name,pin_hash,active FROM staff WHERE id=?`).bind(id).first();
  if (!m || !m.active) return zurueck('Diese Person gibt es nicht mehr.', 'err');

  /* Bremse gegen Durchprobieren: eine vierstellige PIN ist schnell geraten, wenn man
     beliebig oft darf. Gezählt wird je Person in derselben Tabelle wie beim Login. */
  const zaehler = `pin:${id}`;
  const gesperrt = await pinGesperrt(env.DB, zaehler);
  if (gesperrt) {
    return zurZeile(`Zu viele Fehlversuche. Bitte in ${gesperrt} ${gesperrt === 1 ? 'Minute' : 'Minuten'} noch einmal — oder beim Chef melden.`);
  }

  if (!m.pin_hash || await pinHash(pin, env.IP_SALT) !== m.pin_hash) {
    await pinFehler(env.DB, zaehler);
    await new Promise(r => setTimeout(r, 700));
    return zurZeile('PIN stimmt nicht.');
  }
  await pinOk(env.DB, zaehler);

  const offen = await db.prepare(
    `SELECT id,work_date,start_at FROM shifts WHERE staff_id=? AND end_at IS NULL
      ORDER BY work_date DESC, start_at DESC LIMIT 1`).bind(id).first();

  if (d.do === 'kommen') {
    if (offen) return zurZeile('Du bist bereits eingestempelt.');
    await db.prepare(
      `INSERT INTO shifts (id,staff_id,work_date,start_at,break_min,source,created_at)
       VALUES (?,?,?,?,0,'stempel',?)`
    ).bind(crypto.randomUUID(), id, now.date, now.time, new Date().toISOString()).run();
    return zurueck(`${m.name} — Beginn ${now.time} Uhr. Guten Dienst.`);
  }

  if (d.do === 'gehen') {
    if (!offen) return zurZeile('Du bist gar nicht eingestempelt.');
    const pause = Math.max(0, Math.min(600, parseInt(d.pause, 10) || 0));
    const dauer = brutto(offen.start_at, now.time);
    await db.prepare(
      `UPDATE shifts SET end_at=?, break_min=?, updated_at=? WHERE id=?`
    ).bind(now.time, pause, new Date().toISOString(), offen.id).run();
    return zurueck(`${m.name} — Feierabend ${now.time} Uhr. ${hhmm(Math.max(0, dauer - pause))} Std. erfasst.`);
  }

  return zurueck('Unbekannte Eingabe.', 'err');
}
