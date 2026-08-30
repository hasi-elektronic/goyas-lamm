/**
 * Übersicht — die Startseite der Verwaltung.
 *
 * Sie zeigte bis zum 30.08.2026 ausschließlich Reservierungen. Das war
 * historisch richtig (das Reservierungssystem war zuerst da) und inhaltlich
 * falsch: Wer morgens das Panel aufmacht, will wissen, ob der Betrieb steht —
 * nicht nur, wie viele Gäste kommen. Rückmeldung Gökhan: „Die Übersicht muss
 * das ganze System zeigen, nicht nur Reservierungen."
 *
 * Deshalb steht jetzt zwischen den Reservierungszahlen und der Tagesliste ein
 * Block mit einer Kachel je Bereich — Team, Wareneingang, Hygiene, Artikel,
 * Speisekarte, Warteliste. Jede Kachel beantwortet genau eine Frage („muss ich
 * da heute hin?") und verlinkt auf die Seite, die es genauer weiß. Bewusst
 * keine zweite Tagesliste und keine Diagramme: Die Übersicht soll in drei
 * Sekunden lesbar sein.
 *
 * Zwei Regeln für spätere Erweiterungen:
 *
 * 1. **Jede Abfrage hier ist unkritisch.** Fehlt eine Tabelle (frische
 *    Datenbank, Migration noch nicht eingespielt), fällt die Kachel weg —
 *    die Übersicht darf daran nie scheitern. Deshalb `zahl()`/`zeile()`
 *    mit try/catch statt roher `db.prepare`-Aufrufe.
 * 2. **Keine Kachel ohne Rechteprüfung.** `darfSeite` entscheidet, was eine
 *    Rolle sieht; sonst zeigt der Demo-Zugang Einkaufszahlen.
 */
import { nowBerlin, addDays, formatDateDE, slotsForDate, esc, capacityFor } from '../_lib/core.js';
import { layout, flash, table, dayHeading } from '../_lib/ui.js';
import { mailReady } from '../_lib/mail.js';
import { notesFor } from '../_lib/gaeste.js';
import { darfSeite } from '../_lib/auth.js';
import { tagKurz } from '../_lib/zeit.js';

/** Eine Zahl holen. Fehlt die Tabelle, ist das Ergebnis `null`, nicht ein Fehler. */
async function zahl(db, sql, ...args) {
  try {
    const r = await db.prepare(sql).bind(...args).first();
    return r ? Number(Object.values(r)[0] ?? 0) : 0;
  } catch { return null; }
}

/** Eine Zeile holen; `null`, wenn es sie nicht gibt oder die Tabelle fehlt. */
async function zeile(db, sql, ...args) {
  try { return (await db.prepare(sql).bind(...args).first()) || null; }
  catch { return null; }
}

async function liste(db, sql, ...args) {
  try { return (await db.prepare(sql).bind(...args).all()).results || []; }
  catch { return []; }
}

/**
 * Eine Bereichskachel.
 * @param {object} k
 * @param {string} k.titel   Bereichsname (Großbuchstaben, klein gesetzt)
 * @param {string} k.wert    die eine Zahl oder Aussage, groß
 * @param {string} k.zusatz  eine Zeile Erläuterung darunter
 * @param {string} k.href    Ziel
 * @param {string} [k.stand] 'warn' = braucht Aufmerksamkeit, 'gut' = erledigt
 */
const kachel = ({ titel, wert, zusatz, href, stand = '' }) => `
  <a class="mod${stand ? ' ' + stand : ''}" href="${esc(href)}">
    <span class="mt">${esc(titel)}</span>
    <b>${wert}</b>
    <span class="ms">${zusatz}</span>
  </a>`;

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  if (!db) return layout({ user: data?.user, title: 'Übersicht', active: '/admin', body: '<div class="msg err">Datenbank nicht verbunden.</div>' });

  const rolle = data?.user?.role || 'chef';
  const darf = pfad => darfSeite(rolle, pfad);
  const now = nowBerlin();
  const until = addDays(now.date, 13);
  const monat = now.date.slice(0, 7);

  const rows = (await db.prepare(
    `SELECT id,res_date,res_time,guests,name,email,phone,note,status,source,no_show
       FROM reservations
      WHERE res_date >= ? AND res_date <= ? AND status='confirmed'
      ORDER BY res_date, res_time, created_at`
  ).bind(now.date, until).all()).results || [];

  const openTotal = (await db.prepare(
    `SELECT COUNT(*) n, COALESCE(SUM(guests),0) g FROM reservations
      WHERE res_date >= ? AND status='confirmed'`
  ).bind(now.date).first()) || { n: 0, g: 0 };

  const tomorrow = addDays(now.date, 1);
  const today   = rows.filter(r => r.res_date === now.date);
  const tomo    = rows.filter(r => r.res_date === tomorrow);
  const week    = rows.filter(r => r.res_date > now.date && r.res_date <= addDays(now.date, 7));
  const sum = a => a.reduce((s, r) => s + r.guests, 0);

  const byDay = {};
  for (const r of rows) if (r.res_date > now.date) (byDay[r.res_date] ||= []).push(r);

  const ruhetag = !slotsForDate(now.date).length;
  const notes = await notesFor(db, rows.map(r => r.phone));
  const kap = await capacityFor(db, env, now.date);
  const cap = kap.seats;

  /* ---------------------------------------------------------------- */
  /* Bereichskacheln                                                   */
  /* ---------------------------------------------------------------- */

  const kacheln = [];

  /* --- Team: wer ist gerade eingestempelt, wer ist eingeplant ----- */
  if (darf('/admin/personal')) {
    const imDienst = await liste(db,
      `SELECT s.name, sh.start_at FROM shifts sh
         JOIN staff s ON s.id = sh.staff_id
        WHERE sh.work_date = ? AND sh.end_at IS NULL
        ORDER BY sh.start_at`, now.date);
    const geplant = await zahl(db,
      `SELECT COUNT(*) n FROM shift_plan
        WHERE work_date = ? AND art = 'schicht' AND published = 1`, now.date);
    const namen = imDienst.map(r => `${r.name} (seit ${r.start_at})`).join(' · ');
    kacheln.push(kachel({
      titel: 'Team heute',
      wert: imDienst.length
        ? `${imDienst.length} im Dienst`
        : '<span class="leer">niemand eingestempelt</span>',
      zusatz: esc(namen || (geplant ? `${geplant} für heute eingeplant` : 'für heute nichts eingeplant')),
      href: '/admin/dienstplan',
    }));
  }

  /* --- Wareneingang: kam heute was, gab es Abweichungen? ---------- */
  if (darf('/admin/ware')) {
    const letzte = await zeile(db, `SELECT day FROM deliveries ORDER BY day DESC LIMIT 1`);
    const imMonat = await zahl(db, `SELECT COUNT(*) n FROM deliveries WHERE day LIKE ?`, monat + '%');
    const abweich = await zahl(db,
      `SELECT COUNT(*) n FROM deliveries
        WHERE day LIKE ? AND (temp_ok = 0 OR mhd_ok = 0 OR ware_ok = 0)`, monat + '%');
    if (imMonat !== null) {
      kacheln.push(kachel({
        titel: 'Wareneingang',
        wert: abweich
          ? `${abweich} mit Abweichung`
          : `${imMonat} ${imMonat === 1 ? 'Lieferung' : 'Lieferungen'}`,
        zusatz: letzte
          ? `${abweich ? `von ${imMonat} diesen Monat · ` : 'diesen Monat · '}zuletzt ${esc(tagKurz(letzte.day))}`
          : 'diesen Monat noch nichts erfasst',
        href: '/admin/ware',
        stand: abweich ? 'warn' : '',
      }));
    }
  }

  /* --- Hygiene: was fehlt heute noch? ----------------------------- */
  if (darf('/admin/hygiene')) {
    const offen = await zahl(db,
      `SELECT COUNT(*) n FROM hygiene_punkte p
        WHERE p.active = 1 AND p.takt = 'taeglich'
          AND NOT EXISTS (SELECT 1 FROM hygiene_log l WHERE l.punkt_id = p.id AND l.tag = ?)`,
      now.date);
    const schlecht = await zahl(db,
      `SELECT COUNT(*) n FROM hygiene_log WHERE tag = ? AND ok = 0`, now.date);
    if (offen !== null) {
      kacheln.push(kachel({
        titel: 'Hygiene heute',
        wert: offen ? `${offen} offen` : 'erledigt',
        zusatz: schlecht
          ? `${schlecht} ${schlecht === 1 ? 'Abweichung' : 'Abweichungen'} heute`
          : 'tägliche Kontrollpunkte',
        href: '/admin/hygiene',
        stand: schlecht ? 'warn' : (offen ? 'warn' : 'gut'),
      }));
    }
  }

  /* --- Artikel & Inventur ----------------------------------------- */
  if (darf('/admin/lager')) {
    const aktiv = await zahl(db, `SELECT COUNT(*) n FROM articles WHERE active = 1`);
    const letzteZaehlung = await zeile(db, `SELECT day FROM stock_counts ORDER BY day DESC LIMIT 1`);
    if (aktiv !== null) {
      kacheln.push(kachel({
        titel: 'Artikel & Inventur',
        wert: `${aktiv} Artikel`,
        zusatz: letzteZaehlung
          ? `letzte Zählung ${esc(tagKurz(letzteZaehlung.day))}`
          : 'noch nie gezählt',
        href: '/admin/lager',
        stand: letzteZaehlung ? '' : 'warn',
      }));
    }
  }

  /* --- Speisekarte -------------------------------------------------- */
  if (darf('/admin/karte')) {
    const gerichte = await zahl(db, `SELECT COUNT(*) n FROM menu_items`);
    const aus = await zahl(db, `SELECT COUNT(*) n FROM menu_items WHERE active = 0`);
    if (gerichte !== null) {
      kacheln.push(kachel({
        titel: 'Speisekarte',
        wert: `${gerichte - (aus || 0)} auf der Karte`,
        zusatz: aus ? `${aus} heute ausgeblendet` : 'nichts ausgeblendet',
        href: '/admin/karte',
      }));
    }
  }

  /* --- Warteliste --------------------------------------------------- */
  if (darf('/admin/warteliste')) {
    const offen = await zahl(db,
      `SELECT COUNT(*) n FROM waitlist WHERE status = 'offen' AND res_date >= ?`, now.date);
    if (offen !== null) {
      kacheln.push(kachel({
        titel: 'Warteliste',
        wert: offen ? `${offen} ${offen === 1 ? 'Anfrage' : 'Anfragen'}` : 'leer',
        zusatz: offen ? 'wartet auf Rückmeldung' : 'niemand wartet',
        href: '/admin/warteliste',
        stand: offen ? 'warn' : '',
      }));
    }
  }

  /* ---------------------------------------------------------------- */

  const tischWarn = kap.source === 'tische' ? '' : `<div class="msg warn">
    <b>Es sind noch keine Tische angelegt.</b> Das System rechnet solange mit ${cap} Plätzen
    je Zeitfenster. Unter <a href="/admin/tische">Tische</a> eintragen, wie viele Tische es gibt
    und für wie viele Personen jeder ist — dann stimmt die Auslastung.</div>`;

  const mailWarn = mailReady(env) ? '' : `<div class="msg warn">
    <b>E-Mail-Versand ist noch nicht aktiv.</b> Gäste bekommen keine Bestätigung und die Küche
    keine Benachrichtigung — alle Reservierungen stehen aber hier im Panel.
    Es fehlt die Einrichtung von <b>Cloudflare Email Sending</b>
    (Absenderdomain onboarden und <code>CF_EMAIL_TOKEN</code> hinterlegen).</div>`;

  const upcoming = Object.keys(byDay).length
    ? Object.entries(byDay).slice(0, 8).map(([day, rs]) =>
        `<div class="card">${dayHeading(day, sum(rs), rs.length)}${table(rs, { notes, user: data?.user })}</div>`).join('')
    : '<div class="card"><div class="empty">Für die nächsten Tage liegen noch keine Reservierungen vor.</div></div>';

  const body = `
    <h1>Übersicht</h1>
    <p class="sub">${esc(formatDateDE(now.date))} · ${esc(now.time)} Uhr${ruhetag ? ' · heute Ruhetag' : ''}
       · ${cap} Plätze je Zeitfenster</p>
    ${flash(url)}
    ${tischWarn}
    ${mailWarn}

    <h2 class="abschnitt">Reservierungen</h2>
    <div class="stats">
      <div class="stat hot"><b>${today.length}</b><span>Heute · Tische</span></div>
      <div class="stat hot"><b>${sum(today)}</b><span>Heute · Gäste</span></div>
      <div class="stat"><b>${sum(tomo)}</b><span>Morgen · Gäste</span></div>
      <div class="stat"><b>${sum(week)}</b><span>Nächste 7 Tage</span></div>
      <div class="stat"><b>${openTotal.n}</b><span>Offen gesamt</span></div>
    </div>

    ${kacheln.length ? `
    <h2 class="abschnitt">Betrieb heute</h2>
    <div class="mods">${kacheln.join('')}</div>` : ''}

    <div class="row" style="margin-bottom:1.4rem">
      ${[['/admin/neu', '+ Neue Reservierung', ''],
         ['/admin/tag?d=' + now.date, 'Tagesansicht heute', ' ghost'],
         ['/admin/kalender', 'Kalender', ' ghost'],
         ['/admin/zettel?d=' + now.date, 'Küchenzettel drucken', ' ghost']]
        .filter(([h]) => darf(h.split('?')[0]))
        .map(([h, t, k]) => `<a class="btn${k}" href="${h}">${t}</a>`).join('')}
    </div>

    <div class="card">
      ${dayHeading(now.date, sum(today), today.length)}
      ${ruhetag && !today.length
        ? '<div class="empty">Heute ist Ruhetag.</div>'
        : table(today, { notes, user: data?.user })}
    </div>

    <h2 class="abschnitt">Nächste Tage</h2>
    ${upcoming}

    <p class="hint" style="margin:2.2rem 0 0;text-align:center">
      Bucht ein Gast online, meldet sich diese Seite von selbst.
      <button type="button" class="btn sm ghost" data-probe
              style="margin-left:.5rem">Meldung testen</button>
    </p>
  `;

  return layout({ user: data?.user, title: 'Übersicht', active: '/admin', body });
}
