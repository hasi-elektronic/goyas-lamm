/**
 * Goya´s Lamm — gemeinsame Logik für das Reservierungssystem.
 * Läuft als Cloudflare Pages Function (Workers-Runtime).
 */

export const TZ = 'Europe/Berlin';

/** Öffnungszeiten je Wochentag (0 = Sonntag … 6 = Samstag). null = Ruhetag. */
export const HOURS = {
  0: { open: '12:00', close: '20:00' },   // Sonntag, Küche durchgehend
  1: { open: '17:00', close: '22:00' },
  2: { open: '17:00', close: '22:00' },
  3: null,                                 // Mittwoch Ruhetag
  4: { open: '17:00', close: '22:00' },
  5: { open: '17:00', close: '22:00' },
  6: { open: '17:00', close: '22:00' },
};

export const SLOT_MINUTES      = 30;   // Raster
export const LAST_SLOT_BEFORE  = 60;   // letzte Reservierung X Min. vor Küchenschluss
export const LEAD_MINUTES      = 120;  // Mindestvorlauf für Reservierungen am selben Tag
export const MAX_DAYS_AHEAD    = 90;
export const MAX_GUESTS_ONLINE = 10;   // darüber: telefonisch
export const DEFAULT_SEATS_SLOT= 24;   // Plätze je Zeitfenster
export const RATE_LIMIT_PER_DAY= 5;    // Reservierungen je IP / 24 h

export const HOUSE = {
  name:  'Goya´s Lamm',
  phone: '07042 83 22 82',
  tel:   '+497042832282',
  mail:  'hallo@lammm.de',
  addr:  'Klosterbergstraße 45, 71665 Vaihingen an der Enz — Horrheim',
  site:  'https://lammm.de',
};

/* ------------------------------------------------------------------ */
/* Zeit-Helfer — alles in Europe/Berlin, unabhängig von der Serverzeit  */
/* ------------------------------------------------------------------ */

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** { date:'YYYY-MM-DD', time:'HH:MM' } für „jetzt" in Berlin. */
export function nowBerlin() {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Wochentag (0–6) eines YYYY-MM-DD, kalendarisch, ohne Zeitzonendrift. */
export function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toStr = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const WEEKDAY_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTH_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export function formatDateDE(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${WEEKDAY_DE[weekday(dateStr)]}, ${d}. ${MONTH_DE[m - 1]} ${y}`;
}

/** Alle theoretisch möglichen Zeiten eines Tages. */
export function slotsForDate(dateStr) {
  const h = HOURS[weekday(dateStr)];
  if (!h) return [];
  const out = [];
  const last = toMin(h.close) - LAST_SLOT_BEFORE;
  for (let t = toMin(h.open); t <= last; t += SLOT_MINUTES) out.push(toStr(t));
  return out;
}

/* ------------------------------------------------------------------ */
/* Validierung                                                         */
/* ------------------------------------------------------------------ */

export const clean = (v, max = 200) =>
  String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const isEmail = v =>
  /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v) && v.length <= 254;

export const isPhone = v => {
  const digits = String(v).replace(/[^\d]/g, '');
  return digits.length >= 6 && digits.length <= 20;
};

/** SHA-256 der IP + Salt → wir speichern nie die Klartext-IP. */
export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt || 'goyas'}|${ip || ''}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export function token() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ------------------------------------------------------------------ */
/* Kapazität                                                           */
/* ------------------------------------------------------------------ */

export function seatsPerSlot(env) {
  const n = parseInt(env?.RES_SEATS_PER_SLOT ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SEATS_SLOT;
}

/**
 * Freie Zeiten für ein Datum.
 * @returns {Promise<{date:string, closed:boolean, reason?:string, slots:Array<{time:string,free:number}>}>}
 */
export async function availability(db, env, dateStr, guests = 2) {
  const all = slotsForDate(dateStr);
  if (!all.length) {
    return { date: dateStr, closed: true, reason: 'Ruhetag', slots: [] };
  }

  const closed = await db.prepare('SELECT reason FROM closures WHERE day = ?')
    .bind(dateStr).first();
  if (closed) {
    return { date: dateStr, closed: true, reason: closed.reason || 'Geschlossen', slots: [] };
  }

  const ovr = await db.prepare('SELECT seats_slot FROM capacity_overrides WHERE day = ?')
    .bind(dateStr).first();
  const cap = ovr?.seats_slot ?? seatsPerSlot(env);

  const rows = await db.prepare(
    `SELECT res_time, SUM(guests) AS taken FROM reservations
      WHERE res_date = ? AND status = 'confirmed' GROUP BY res_time`
  ).bind(dateStr).all();
  const taken = Object.fromEntries((rows.results || []).map(r => [r.res_time, Number(r.taken) || 0]));

  const now = nowBerlin();
  const isToday = dateStr === now.date;
  const earliest = toMin(now.time) + LEAD_MINUTES;

  const slots = all.map(t => {
    let free = cap - (taken[t] || 0);
    if (isToday && toMin(t) < earliest) free = 0;
    return { time: t, free: Math.max(0, free) };
  }).filter(s => s.free >= Math.max(1, guests));

  return { date: dateStr, closed: false, slots };
}
