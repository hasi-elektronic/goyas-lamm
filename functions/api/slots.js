import {
  availability, isValidDate, nowBerlin, addDays, diffDays,
  MAX_DAYS_AHEAD, MAX_GUESTS_ONLINE, json, slotsForDate,
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

    const closures = await db.prepare(
      `SELECT day, reason FROM closures WHERE day >= ? AND day <= ?`
    ).bind(`${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`).all();
    const closedMap = Object.fromEntries((closures.results || []).map(r => [r.day, r.reason || 'Geschlossen']));

    const days = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`;
      if (diffDays(now.date, day) < 0 || diffDays(now.date, day) > MAX_DAYS_AHEAD) { days[day] = 'past'; continue; }
      if (!slotsForDate(day).length) { days[day] = 'ruhetag'; continue; }
      if (closedMap[day]) { days[day] = 'closed'; continue; }
      days[day] = 'open';
    }
    // Für heute prüfen, ob überhaupt noch etwas frei ist
    if (days[now.date] === 'open') {
      const a = await availability(db, env, now.date, guests);
      if (!a.slots.length) days[now.date] = 'full';
    }
    return json({ month, days, today: now.date, max: maxDate });
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
