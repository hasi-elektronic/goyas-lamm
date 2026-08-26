import {
  clean, hashIp, json, nowBerlin, addDays, RATE_LIMIT_PER_DAY, HOUSE,
} from '../_lib/core.js';
import { createReservation, BookError, purgeOld } from '../_lib/book.js';

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

  /* Spam-Abwehr: Honeypot + Mindestzeit im Formular */
  if (clean(body.website)) return json({ ok: true, spam: true });
  const ts = parseInt(body.ts, 10);
  if (Number.isFinite(ts) && Date.now() - ts < 2500) {
    return err('too_fast', 'Bitte versuchen Sie es noch einmal.');
  }

  /* Rate Limit je IP */
  const ipHash = await hashIp(request.headers.get('cf-connecting-ip') || '', env.IP_SALT);
  const since = new Date(Date.now() - 86400000).toISOString();
  const cnt = await db.prepare(
    `SELECT COUNT(*) AS n FROM reservations WHERE ip_hash = ? AND created_at > ?`
  ).bind(ipHash, since).first();
  if ((cnt?.n || 0) >= RATE_LIMIT_PER_DAY) {
    return err('rate_limited',
      `Es liegen bereits mehrere Reservierungen von Ihrem Anschluss vor. Bitte rufen Sie uns an: ${HOUSE.phone}`, 429);
  }

  try {
    const rec = await createReservation(db, env, body, {
      admin: false,
      source: 'web',
      ipHash,
      site: env.SITE_URL || new URL(request.url).origin,
    });

    await purgeOld(db, addDays(nowBerlin().date, -183));

    return json({
      ok: true,
      id: rec.id.slice(0, 8),
      date: rec.res_date, time: rec.res_time, guests: rec.guests, name: rec.name,
      dateLabel: rec.dateLabel,
      mailed: rec.mailed,
    });
  } catch (e) {
    if (e instanceof BookError) return err(e.code, e.message, e.status);
    return err('save_failed',
      `Die Reservierung konnte nicht gespeichert werden. Bitte rufen Sie uns an: ${HOUSE.phone}`, 500);
  }
}

export const onRequestGet = () => json({ ok: false, error: 'method_not_allowed' }, 405);
