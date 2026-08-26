import {
  availability, isValidDate, nowBerlin, addDays, diffDays, capacityFor,
  MAX_DAYS_AHEAD, MAX_GUESTS_ONLINE, LEAD_MINUTES, json, slotsForDate,
} from '../_lib/core.js';

/** GET /api/slots?date=YYYY-MM-DD&guests=2  → freie Zeiten
 *  GET /api/slots?month=YYYY-MM&guests=2    → welche Tage im Monat buchbar sind */
export async function onRequestGet({ request, env }) {
  const db = env.DB;
  if (!db) return json({ error: 'db_unavailable' }, 503);

  const url = new URL(request.url);
  const guests = Math.min(MAX_GUESTS_ONLINE, Math.max(1, parseInt(url.searchParams.get('guests') || '2', 10) || 2));
  const now = nowBerlin();
  const maxDate = addDays(now.date, MAX_DAYS_AHEAD);

  const month = url.searchParams.get('month');
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'bad_month' }, 400);
    const [y, m] = month.split('-').map(Number);
    if (m < 1 || m > 12) return json({ error: 'bad_month' }, 400);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const von = `${month}-01`;
    const bis = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    /* Drei Abfragen für den ganzen Monat statt einer je Tag — sonst wären es
       bis zu 31 Datenbankrunden für ein einziges Kalenderblatt. */
    const closures = await db.prepare(
      `SELECT day, reason FROM closures WHERE day >= ? AND day <= ?`).bind(von, bis).all();
    const closedMap = Object.fromEntries((closures.results || []).map(r => [r.day, r.reason || 'Geschlossen']));

    const ovr = await db.prepare(
      `SELECT day, seats_slot FROM capacity_overrides WHERE day >= ? AND day <= ?`)
      .bind(von, bis).all();
    const ovrMap = Object.fromEntries((ovr.results || []).map(r => [r.day, Number(r.seats_slot)]));

    const belegt = await db.prepare(
      `SELECT res_date, res_time, SUM(guests) AS n FROM reservations
        WHERE res_date >= ? AND res_date <= ? AND status = 'confirmed'
        GROUP BY res_date, res_time`).bind(von, bis).all();
    const belegtMap = {};
    for (const r of belegt.results || []) {
      (belegtMap[r.res_date] ||= {})[r.res_time] = Number(r.n) || 0;
    }

    const standard = (await capacityFor(db, env, null)).seats;
    const minute = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const frueheste = minute(now.time) + LEAD_MINUTES;

    const days = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`;
      const abstand = diffDays(now.date, day);
      if (abstand < 0 || abstand > MAX_DAYS_AHEAD) { days[day] = 'past'; continue; }

      const zeiten = slotsForDate(day);
      if (!zeiten.length) { days[day] = 'ruhetag'; continue; }
      if (closedMap[day]) { days[day] = 'closed'; continue; }

      const cap = ovrMap[day] ?? standard;
      const heute = day === now.date;
      const frei = zeiten.some(t =>
        (!heute || minute(t) >= frueheste) && cap - ((belegtMap[day] || {})[t] || 0) >= guests);
      days[day] = frei ? 'open' : 'full';
    }
    return json({ month, days, today: now.date, max: maxDate, guests });
  }

  const date = url.searchParams.get('date') || now.date;
  if (!isValidDate(date)) return json({ error: 'bad_date' }, 400);
  if (diffDays(now.date, date) < 0) return json({ date, closed: true, reason: 'Datum liegt in der Vergangenheit', slots: [] });
  if (diffDays(now.date, date) > MAX_DAYS_AHEAD) {
    return json({ date, closed: true, reason: `Online buchbar bis ${maxDate}`, slots: [] });
  }

  const a = await availability(db, env, date, guests);
  return json({ ...a, today: now.date, max: maxDate });
}
