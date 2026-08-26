import {
  availability, isValidDate, nowBerlin, diffDays, clean, isEmail, isPhone,
  hashIp, token, json, formatDateDE, seatsPerSlot, addDays,
  MAX_DAYS_AHEAD, MAX_GUESTS_ONLINE, RATE_LIMIT_PER_DAY, HOUSE,
} from '../_lib/core.js';
import { guestMail, houseMail, send } from '../_lib/mail.js';

const err = (code, msg, status = 400) => json({ ok: false, error: code, message: msg }, status);

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return err('db_unavailable', 'Die Reservierung ist gerade nicht möglich. Bitte rufen Sie uns an.', 503);

  let body;
  try {
    const ct = request.headers.get('content-type') || '';
    body = ct.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return err('bad_body', 'Die Anfrage konnte nicht gelesen werden.');
  }

  /* --- Spam-Abwehr: Honeypot + Mindestzeit im Formular --- */
  if (clean(body.website)) return json({ ok: true, spam: true });
  const ts = parseInt(body.ts, 10);
  if (Number.isFinite(ts) && Date.now() - ts < 2500) {
    return err('too_fast', 'Bitte versuchen Sie es noch einmal.');
  }

  /* --- Felder --- */
  const date   = clean(body.date, 10);
  const time   = clean(body.time, 5);
  const guests = parseInt(body.guests, 10);
  const name   = clean(body.name, 80);
  const email  = clean(body.email, 254).toLowerCase();
  const phone  = clean(body.phone, 40);
  const note   = clean(body.note, 500);

  if (!isValidDate(date)) return err('bad_date', 'Bitte wählen Sie ein gültiges Datum.');
  if (!/^\d{2}:\d{2}$/.test(time)) return err('bad_time', 'Bitte wählen Sie eine Uhrzeit.');
  if (!Number.isFinite(guests) || guests < 1 || guests > MAX_GUESTS_ONLINE) {
    return err('bad_guests', `Für mehr als ${MAX_GUESTS_ONLINE} Personen reservieren Sie bitte telefonisch unter ${HOUSE.phone}.`);
  }
  if (name.length < 2)   return err('bad_name',  'Bitte geben Sie Ihren Namen an.');
  if (!isEmail(email))   return err('bad_email', 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
  if (!isPhone(phone))   return err('bad_phone', 'Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.');

  const now = nowBerlin();
  const dd = diffDays(now.date, date);
  if (dd < 0) return err('past', 'Dieses Datum liegt in der Vergangenheit.');
  if (dd > MAX_DAYS_AHEAD) return err('too_far', `Online reservieren können Sie bis ${MAX_DAYS_AHEAD} Tage im Voraus.`);

  /* --- Rate Limit je IP --- */
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ipHash = await hashIp(ip, env.IP_SALT);
  const since = new Date(Date.now() - 86400000).toISOString();
  const cnt = await db.prepare(
    `SELECT COUNT(*) AS n FROM reservations WHERE ip_hash = ? AND created_at > ?`
  ).bind(ipHash, since).first();
  if ((cnt?.n || 0) >= RATE_LIMIT_PER_DAY) {
    return err('rate_limited', `Es liegen bereits mehrere Reservierungen von Ihrem Anschluss vor. Bitte rufen Sie uns an: ${HOUSE.phone}`, 429);
  }

  /* --- Doppelbuchung desselben Gastes abfangen --- */
  const dupe = await db.prepare(
    `SELECT id FROM reservations WHERE email = ? AND res_date = ? AND res_time = ? AND status = 'confirmed'`
  ).bind(email, date, time).first();
  if (dupe) {
    return err('duplicate', 'Für diese Zeit liegt bereits eine Reservierung unter Ihrer E-Mail-Adresse vor.');
  }

  /* --- Verfügbarkeit --- */
  const avail = await availability(db, env, date, guests);
  if (avail.closed) return err('closed', `An diesem Tag haben wir geschlossen (${avail.reason}).`);
  if (!avail.slots.some(s => s.time === time)) {
    return err('slot_taken', 'Diese Zeit ist inzwischen leider vergeben. Bitte wählen Sie eine andere.');
  }

  /* --- Speichern --- */
  const rec = {
    id: crypto.randomUUID(),
    token: token(),
    created_at: new Date().toISOString(),
    res_date: date, res_time: time, guests,
    name, email, phone, note: note || null,
  };

  try {
    await db.prepare(
      `INSERT INTO reservations
        (id, token, created_at, res_date, res_time, guests, name, email, phone, note, status, source, ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed','web',?)`
    ).bind(rec.id, rec.token, rec.created_at, date, time, guests, name, email, phone, rec.note, ipHash).run();
  } catch {
    return err('save_failed', `Die Reservierung konnte nicht gespeichert werden. Bitte rufen Sie uns an: ${HOUSE.phone}`, 500);
  }

  /* --- Kapazität nachprüfen (Race zwischen zwei gleichzeitigen Buchungen) --- */
  const after = await db.prepare(
    `SELECT SUM(guests) AS taken FROM reservations WHERE res_date = ? AND res_time = ? AND status = 'confirmed'`
  ).bind(date, time).first();
  const ovr = await db.prepare('SELECT seats_slot FROM capacity_overrides WHERE day = ?').bind(date).first();
  const cap = ovr?.seats_slot ?? seatsPerSlot(env);
  if ((after?.taken || 0) > cap) {
    await db.prepare(`UPDATE reservations SET status='cancelled', cancelled_at=? WHERE id=?`)
      .bind(new Date().toISOString(), rec.id).run();
    return err('slot_taken', 'Diese Zeit wurde soeben vergeben. Bitte wählen Sie eine andere Uhrzeit.', 409);
  }

  /* --- Aufräumen: Reservierungen älter als 6 Monate löschen (Speicherbegrenzung) --- */
  try {
    await db.prepare(`DELETE FROM reservations WHERE res_date < ?`)
      .bind(addDays(now.date, -183)).run();
  } catch { /* nicht kritisch */ }

  /* --- Mails (blockieren die Antwort nicht bei Fehlern) --- */
  const site = env.SITE_URL || new URL(request.url).origin;
  const g = guestMail(rec, site);
  const h = houseMail(rec);
  const [okGuest, okHouse] = await Promise.all([
    send(env, email, g.subject, g.html, env.RES_HOUSE_EMAIL || HOUSE.mail),
    send(env, env.RES_HOUSE_EMAIL || HOUSE.mail, h.subject, h.html, email),
  ]);
  if (okGuest || okHouse) {
    await db.prepare(`UPDATE reservations SET mail_guest=?, mail_house=? WHERE id=?`)
      .bind(okGuest ? 1 : 0, okHouse ? 1 : 0, rec.id).run();
  }

  return json({
    ok: true,
    id: rec.id.slice(0, 8),
    date, time, guests, name,
    dateLabel: formatDateDE(date),
    mailed: okGuest,
    stornoUrl: `${site}/storno?token=${rec.token}`,
  });
}

export const onRequestGet = () => json({ ok: false, error: 'method_not_allowed' }, 405);
