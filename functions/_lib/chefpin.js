/**
 * Chef-PIN — eine zweite Tür vor den Seiten, auf denen Geld steht.
 *
 * Warum das nötig ist: Damit die Stempeluhr läuft, bleibt das Küchentablet
 * dauerhaft als Chef angemeldet. Damit kann dort **jeder**, der kurz allein am
 * Tablet steht, über das Menü auf „Personal" tippen und die Stundenlöhne aller
 * Kollegen lesen. Die Rollen helfen hier nicht — es ist ja dieselbe Anmeldung.
 *
 * Also eine PIN, die nur Gökhan kennt, vor Personal, Arbeitszeit, Zeitzettel,
 * Trinkgeld und Benutzer — und aus demselben Grund vor dem Preis-Radar und der
 * Inventur, wo Einkaufspreise und Monatsausgaben stehen. Die Stempeluhr selbst
 * bleibt frei; sonst könnte das Team nicht mehr stempeln, und genau dafür steht
 * das Tablet da. Ware annehmen bleibt ebenfalls frei — das muss jeder können,
 * der die Tür aufmacht.
 *
 * Freigeschaltet wird für 20 Minuten, in einem eigenen Cookie. Das reicht, um
 * einen Monat durchzusehen, und ist kurz genug, dass ein vergessenes Tablet
 * nicht den ganzen Abend offen steht.
 *
 * Solange **keine** PIN hinterlegt ist, ist die Sperre aus — sonst wäre die
 * Erweiterung eine Falle für jeden, der sie nicht kennt.
 */

const COOKIE = 'gl_chef';
const DAUER_MIN = 20;

/** Diese Pfade liegen hinter der PIN. Präfix-Vergleich wie bei den Rollen. */
export const PIN_PFADE = [
  '/admin/personal',
  '/admin/arbeitszeit',
  '/admin/zeitzettel',
  '/admin/trinkgeld',
  '/admin/benutzer',
  /* Dieselbe Trennung wie bei den Löhnen: Ware annehmen darf jeder, die
     Einkaufspreise und die Monatsausgaben sieht nur der Chef. */
  '/admin/preise',
  '/admin/inventur',
  /* Rechnungen enthalten Kundenanschriften und Beträge. */
  '/admin/rechnung',
  /* Die Privatkasse ist das Haushaltsbuch des Inhabers. Niemand sonst im Haus
     hat einen Grund, sie zu öffnen — auch kein anderer Chef-Zugang, der aus
     Versehen offen stehen bleibt. */
  '/admin/privat',
];

export const brauchtPin = pfad =>
  PIN_PFADE.some(p => pfad === p || pfad.startsWith(p + '/'));

/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

async function hmac(text, key) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Konstante Laufzeit — verrät nicht über die Dauer, wie weit man daneben lag. */
function safeEqual(a, b) {
  const x = String(a ?? ''), y = String(b ?? '');
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

const schluessel = env =>
  `${env.ADMIN_USER || ''}:${env.ADMIN_PASS || ''}:${env.IP_SALT || 'goyas'}:chef`;

/** PIN wird nur als Hash abgelegt — im Klartext steht sie nirgends. */
export async function pinHashChef(pin, env) {
  return hmac(`chefpin|${String(pin)}`, schluessel(env));
}

/* ------------------------------------------------------------------ */
/* Hinterlegte PIN                                                     */
/* ------------------------------------------------------------------ */

/** @returns {Promise<string|null>} der gespeicherte Hash, oder null */
export async function gespeicherterPin(db) {
  if (!db) return null;
  try {
    const r = await db.prepare(`SELECT v FROM settings WHERE k = 'chef_pin'`).first();
    return r?.v || null;
  } catch {
    return null;     // settings-Tabelle fehlt: Sperre bleibt aus
  }
}

export async function setzePin(db, pin, env) {
  const hash = await pinHashChef(pin, env);
  await db.prepare(
    `INSERT INTO settings (k, v) VALUES ('chef_pin', ?)
     ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(hash).run();
}

export async function loeschePin(db) {
  await db.prepare(`DELETE FROM settings WHERE k = 'chef_pin'`).run();
}

/* ------------------------------------------------------------------ */
/* Freischaltung                                                       */
/* ------------------------------------------------------------------ */

/** Ist dieses Gerät gerade freigeschaltet? */
export async function freigeschaltet(request, env) {
  const roh = request.headers.get('cookie') || '';
  const m = roh.match(/(?:^|;\s*)gl_chef=([^;]+)/);
  if (!m) return false;
  let wert;
  try { wert = decodeURIComponent(m[1]); } catch { return false; }
  const teile = wert.split('.');
  if (teile.length !== 2) return false;
  const [exp, sig] = teile;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp, schluessel(env)));
}

/** Cookie, das 20 Minuten lang freischaltet. */
export async function freigabeCookie(env) {
  const exp = Date.now() + DAUER_MIN * 60000;
  const sig = await hmac(String(exp), schluessel(env));
  return `${COOKIE}=${encodeURIComponent(`${exp}.${sig}`)}; Path=/admin; `
       + `Max-Age=${DAUER_MIN * 60}; HttpOnly; Secure; SameSite=Lax`;
}

/** Sofort wieder zusperren. */
export const sperrCookie = () =>
  `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export { DAUER_MIN };
