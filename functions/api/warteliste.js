/**
 * Warteliste — für den Fall, dass der Wunschtermin voll ist.
 *
 * Bewusst ohne Automatik: Es wird nichts zugesagt und niemand bekommt automatisch
 * einen Tisch. Das Restaurant sieht den Eintrag im Panel und ruft an. Alles andere
 * würde Erwartungen wecken, die eine Küche am Samstagabend nicht einlösen kann.
 */
import {
  clean, isEmail, isPhone, isValidDate, json, nowBerlin, diffDays, hashIp, phoneKey,
  MAX_DAYS_AHEAD, MAX_GUESTS_ONLINE, HOUSE,
} from '../_lib/core.js';

const err = (code, msg, status = 400) => json({ ok: false, error: code, message: msg }, status);

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return err('db_unavailable', `Bitte rufen Sie uns kurz an: ${HOUSE.phone}`, 503);

  let body;
  try {
    const ct = request.headers.get('content-type') || '';
    body = ct.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return err('bad_body', 'Die Anfrage konnte nicht gelesen werden.');
  }

  if (clean(body.website)) return json({ ok: true, spam: true });   // Honigtopf

  const date   = clean(body.date, 10);
  const time   = clean(body.time, 5);
  const guests = parseInt(body.guests, 10);
  const name   = clean(body.name, 80);
  const phone  = clean(body.phone, 40);
  const email  = clean(body.email, 254).toLowerCase();
  const note   = clean(body.note, 300);

  if (!isValidDate(date)) return err('bad_date', 'Bitte ein gültiges Datum wählen.');
  const now = nowBerlin();
  const dd = diffDays(now.date, date);
  if (dd < 0) return err('past', 'Dieses Datum liegt in der Vergangenheit.');
  if (dd > MAX_DAYS_AHEAD) return err('too_far', `Möglich sind ${MAX_DAYS_AHEAD} Tage im Voraus.`);
  if (!Number.isFinite(guests) || guests < 1 || guests > MAX_GUESTS_ONLINE) {
    return err('bad_guests', `Für mehr als ${MAX_GUESTS_ONLINE} Personen bitte anrufen: ${HOUSE.phone}`);
  }
  if (name.length < 2) return err('bad_name', 'Bitte den Namen angeben.');
  if (!isPhone(phone)) return err('bad_phone', 'Bitte eine Telefonnummer angeben — wir melden uns telefonisch.');
  if (email && !isEmail(email)) return err('bad_email', 'Die E-Mail-Adresse sieht nicht richtig aus.');

  const ipHash = await hashIp(request.headers.get('cf-connecting-ip') || '', env.IP_SALT);

  try {
    /* Nicht zweimal für denselben Abend */
    const dupe = await db.prepare(
      `SELECT id FROM waitlist WHERE res_date=? AND phone_key=? AND status='offen'`
    ).bind(date, phoneKey(phone)).first();
    if (dupe) {
      return json({ ok: true, doppelt: true,
        message: 'Sie stehen für diesen Abend bereits auf der Liste. Wir melden uns, sobald etwas frei wird.' });
    }

    await db.prepare(
      `INSERT INTO waitlist (id,created_at,res_date,res_time,guests,name,phone,phone_key,email,note,status,ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,'offen',?)`
    ).bind(crypto.randomUUID(), new Date().toISOString(), date,
           /^\d{1,2}:\d{2}$/.test(time) ? time : null,
           guests, name, phone, phoneKey(phone), email || null, note || null, ipHash).run();

    return json({ ok: true });
  } catch (e) {
    return err('save_failed', `Das hat nicht geklappt. Bitte rufen Sie uns an: ${HOUSE.phone}`, 500);
  }
}

export const onRequestGet = () => json({ ok: false, error: 'method_not_allowed' }, 405);
