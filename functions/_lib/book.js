/**
 * Gemeinsame Buchungslogik — wird von der öffentlichen API und vom Admin genutzt.
 * Der Admin darf mehr: keine Vorlaufzeit, keine Personengrenze, E-Mail optional,
 * und auf Wunsch auch über die Kapazität hinaus (Zusatztisch).
 */
import {
  availability, isValidDate, nowBerlin, diffDays, clean, isEmail, isPhone,
  token, formatDateDE, capacityFor, phoneKey,
  MAX_DAYS_AHEAD, MAX_GUESTS_ONLINE, HOUSE,
} from './core.js';
import { guestMail, houseMail, send } from './mail.js';

export class BookError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

/**
 * @param {object} input  date,time,guests,name,email,phone,note
 * @param {object} opts   { admin:boolean, source:'web'|'telefon'|'walk', override:boolean,
 *                          ipHash:string, notifyGuest:boolean, notifyHouse:boolean, site:string }
 */
export async function createReservation(db, env, input, opts = {}) {
  const admin = !!opts.admin;

  const date   = clean(input.date, 10);
  const time   = clean(input.time, 5);
  const guests = parseInt(input.guests, 10);
  const name   = clean(input.name, 80);
  const email  = clean(input.email, 254).toLowerCase();
  const phone  = clean(input.phone, 40);
  const note   = clean(input.note, 500);

  if (!isValidDate(date)) throw new BookError('bad_date', 'Bitte ein gültiges Datum wählen.');
  if (!/^\d{1,2}:\d{2}$/.test(time)) throw new BookError('bad_time', 'Bitte eine Uhrzeit wählen.');
  if (!Number.isFinite(guests) || guests < 1 || guests > (admin ? 60 : MAX_GUESTS_ONLINE)) {
    throw new BookError('bad_guests', admin
      ? 'Bitte eine Personenzahl zwischen 1 und 60 angeben.'
      : `Für mehr als ${MAX_GUESTS_ONLINE} Personen bitte telefonisch reservieren: ${HOUSE.phone}`);
  }
  if (name.length < 2) throw new BookError('bad_name', 'Bitte den Namen angeben.');
  if (!admin && !isEmail(email)) throw new BookError('bad_email', 'Bitte eine gültige E-Mail-Adresse angeben.');
  if (admin && email && !isEmail(email)) throw new BookError('bad_email', 'Die E-Mail-Adresse sieht nicht richtig aus.');
  if (!isPhone(phone)) throw new BookError('bad_phone', 'Bitte eine Telefonnummer angeben.');

  const now = nowBerlin();
  const dd = diffDays(now.date, date);
  if (!admin) {
    if (dd < 0) throw new BookError('past', 'Dieses Datum liegt in der Vergangenheit.');
    if (dd > MAX_DAYS_AHEAD) throw new BookError('too_far', `Online sind ${MAX_DAYS_AHEAD} Tage im Voraus möglich.`);
  }

  if (!admin) {
    const dupe = await db.prepare(
      `SELECT id FROM reservations WHERE email = ? AND res_date = ? AND res_time = ? AND status='confirmed'`
    ).bind(email, date, time).first();
    if (dupe) throw new BookError('duplicate', 'Für diese Zeit liegt bereits eine Reservierung unter dieser E-Mail-Adresse vor.');
  }

  if (!opts.override) {
    const avail = await availability(db, env, date, guests);
    if (avail.closed) throw new BookError('closed', `An diesem Tag ist geschlossen (${avail.reason}).`);
    if (!avail.slots.some(s => s.time === time)) {
      throw new BookError('slot_taken', admin
        ? 'In diesem Zeitfenster ist rechnerisch kein Platz mehr. Mit „Über Kapazität hinaus" trotzdem eintragen.'
        : 'Diese Zeit ist inzwischen vergeben. Bitte eine andere wählen.');
    }
  }
  // Mit „über Kapazität hinaus" sind auch Ruhetage und Schließtage möglich
  // (geschlossene Gesellschaften, Sonderöffnungen).

  const rec = {
    id: crypto.randomUUID(),
    token: token(),
    created_at: new Date().toISOString(),
    res_date: date, res_time: time, guests,
    name, email: email || '', phone, note: note || null,
    source: opts.source || 'web',
  };

  try {
    await db.prepare(
      `INSERT INTO reservations
        (id, token, created_at, res_date, res_time, guests, name, email, phone, phone_key, note, status, source, ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)`
    ).bind(rec.id, rec.token, rec.created_at, date, time, guests, name, rec.email, phone,
           phoneKey(phone), rec.note, rec.source, opts.ipHash || null).run();
  } catch {
    /* Migration 0004 noch nicht eingespielt — ohne phone_key eintragen */
    await db.prepare(
      `INSERT INTO reservations
        (id, token, created_at, res_date, res_time, guests, name, email, phone, note, status, source, ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)`
    ).bind(rec.id, rec.token, rec.created_at, date, time, guests, name, rec.email, phone, rec.note,
           rec.source, opts.ipHash || null).run();
  }

  /* Kapazität gegen gleichzeitige Buchungen nachprüfen */
  if (!opts.override) {
    const after = await db.prepare(
      `SELECT SUM(guests) AS taken FROM reservations WHERE res_date=? AND res_time=? AND status='confirmed'`
    ).bind(date, time).first();
    const cap = (await capacityFor(db, env, date)).seats;
    if ((after?.taken || 0) > cap) {
      await db.prepare(`UPDATE reservations SET status='cancelled', cancelled_at=? WHERE id=?`)
        .bind(new Date().toISOString(), rec.id).run();
      throw new BookError('slot_taken', 'Diese Zeit wurde soeben vergeben. Bitte eine andere Uhrzeit wählen.', 409);
    }
  }

  /* Benachrichtigungen */
  const site = opts.site || HOUSE.site;
  let okGuest = false, okHouse = false;
  if (opts.notifyGuest !== false && rec.email) {
    const g = guestMail(rec, site);
    okGuest = await send(env, rec.email, g.subject, g.html, env.RES_HOUSE_EMAIL || HOUSE.mail, g.text);
  }
  if (opts.notifyHouse !== false) {
    const h = houseMail(rec);
    okHouse = await send(env, env.RES_HOUSE_EMAIL || HOUSE.mail, h.subject, h.html, rec.email || undefined, h.text);
  }
  if (okGuest || okHouse) {
    await db.prepare(`UPDATE reservations SET mail_guest=?, mail_house=? WHERE id=?`)
      .bind(okGuest ? 1 : 0, okHouse ? 1 : 0, rec.id).run();
  }

  return { ...rec, dateLabel: formatDateDE(date), mailed: okGuest, mailedHouse: okHouse };
}

/**
 * Aufräumen — die Datenschutzerklärung verspricht sechs Monate, also muss auch
 * wirklich alles weg, was dann noch an einem Gast hängt.
 *
 *  1. Reservierungen älter als `beforeDate`
 *  2. Gästenotizen, zu denen es danach keine Reservierung mehr gibt. Ohne diesen
 *     Schritt bliebe der Name samt Notiz für immer stehen, obwohl der Anlass gelöscht ist.
 *  3. Fehlversuchszähler der Anmeldung, sobald die Sperrfrist lange vorbei ist.
 *
 * Läuft beiläufig bei jeder Online-Reservierung — Pages Functions kennen keine
 * Zeitpläne, und ein eigener Cron-Worker wäre für diese Menge übertrieben.
 */
export async function purgeOld(db, beforeDate) {
  try {
    await db.prepare(`DELETE FROM reservations WHERE res_date < ?`).bind(beforeDate).run();
  } catch { /* nicht kritisch */ }

  try {
    await db.prepare(
      `DELETE FROM guests WHERE phone_key NOT IN (SELECT phone_key FROM reservations
        WHERE phone_key IS NOT NULL)`).run();
  } catch { /* Tabelle fehlt noch */ }

  try {
    const grenze = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(`DELETE FROM login_attempts WHERE last_at < ?`).bind(grenze).run();
  } catch { /* nicht kritisch */ }
}
