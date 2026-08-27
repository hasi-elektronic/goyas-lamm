/**
 * Anmeldung und Sitzung für den Admin-Bereich.
 *
 * Zwei Wege hinein:
 *   1. Benutzer aus der Tabelle `users` (mehrere Personen, Rollen, eigene Passwörter)
 *   2. Notzugang über ADMIN_USER / ADMIN_PASS aus den Umgebungsvariablen
 *
 * Der Notzugang ist Absicht: Wenn die Datenbank leer, kaputt oder nicht migriert ist,
 * darf niemand ausgesperrt sein. Er hat immer die Rolle „chef".
 */
export const loginPath = '/admin/login';
const COOKIE = 'gl_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage
const ITER = 100000;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Räumt Eingaben auf, ohne die Sicherheit zu senken:
 * geschützte Leerzeichen, Rand-Leerzeichen und „schöne" Striche, die
 * Tastaturen und Messenger gern aus einem normalen Bindestrich machen.
 */
function normalize(v) {
  return String(v ?? '')
    .replace(/[   ]/g, ' ')                     // geschützte Leerzeichen
    .replace(/[‐-―−﹘﹣－]/g, '-')  // Gedankenstriche → Bindestrich
    .trim();
}

/* ------------------------------------------------------------------ */
/* Passwörter                                                          */
/* ------------------------------------------------------------------ */

async function pbkdf2(pass, saltHex, iter = ITER) {
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

/** @returns {Promise<string>} `pbkdf2$<iterationen>$<salt>$<hash>` */
export async function passwortHash(pass) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2$${ITER}$${salt}$${await pbkdf2(normalize(pass), salt)}`;
}

export async function passwortPasst(pass, gespeichert) {
  const t = String(gespeichert || '').split('$');
  if (t.length !== 4 || t[0] !== 'pbkdf2') return false;
  const iter = parseInt(t[1], 10);
  if (!Number.isFinite(iter) || iter < 1000 || iter > 1000000) return false;
  if (!/^[0-9a-f]+$/.test(t[2])) return false;
  return safeEqual(await pbkdf2(normalize(pass), t[2], iter), t[3]);
}

/* ------------------------------------------------------------------ */
/* Sitzung                                                             */
/* ------------------------------------------------------------------ */

async function hmac(env, data) {
  const secret = `${env.ADMIN_USER || ''}:${env.ADMIN_PASS || ''}:${env.IP_SALT || 'goyas'}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** uid = Benutzerkennung aus `users`, oder 'env' für den Notzugang. */
export async function createSession(env, uid = 'env') {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const wert = `${exp}.${uid}.${await hmac(env, `${exp}.${uid}`)}`;
  return `${COOKIE}=${wert}; Path=/admin; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearSession = () =>
  `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/** @returns {Promise<string|null>} die Benutzerkennung, oder null */
async function sessionUid(request, env) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  let roh;
  try { roh = decodeURIComponent(m[1]); } catch { return null; }   // kaputtes Cookie ≠ 500er
  const teile = roh.split('.');

  /* Sitzungen von vor der Mehrbenutzer-Umstellung: exp.sig */
  if (teile.length === 2) {
    const [exp, sig] = teile;
    if (!exp || !Number.isFinite(+exp) || +exp < Date.now()) return null;
    return safeEqual(sig, await hmac(env, exp)) ? 'env' : null;
  }

  if (teile.length !== 3) return null;
  const [exp, uid, sig] = teile;
  if (!exp || !uid || !Number.isFinite(+exp) || +exp < Date.now()) return null;
  return safeEqual(sig, await hmac(env, `${exp}.${uid}`)) ? uid : null;
}

/**
 * Wer ist angemeldet?
 * @returns {Promise<{id,username,name,role,notzugang}|null>}
 */
export async function currentUser(request, env) {
  const uid = await sessionUid(request, env);
  if (!uid) return null;

  if (uid === 'env') {
    return {
      id: 'env',
      username: String(env.ADMIN_USER || 'admin'),
      name: 'Goya´s Lamm',
      role: 'chef',
      notzugang: true,
    };
  }

  try {
    const u = await env.DB.prepare(
      `SELECT id,username,name,role,active FROM users WHERE id=?`).bind(uid).first();
    if (!u || !u.active) return null;
    return { ...u, notzugang: false };
  } catch {
    return null;   // Tabelle fehlt — dann gilt nur der Notzugang
  }
}

export const verifySession = async (request, env) => !!(await currentUser(request, env));

/* ------------------------------------------------------------------ */
/* Anmeldedaten prüfen                                                 */
/* ------------------------------------------------------------------ */

/** Notzugang aus den Umgebungsvariablen. */
export function checkCredentials(env, user, pass) {
  const sollUser = normalize(env.ADMIN_USER || '');
  const sollPass = normalize(env.ADMIN_PASS || '');
  if (!sollUser || !sollPass) return false;     // ohne gesetzten Notzugang gibt es keinen
  const u = normalize(user).toLowerCase();      // Benutzername ist kein Geheimnis
  return safeEqual(u, sollUser.toLowerCase()) && safeEqual(normalize(pass), sollPass);
}

/**
 * Prüft gegen die Tabelle `users`, dann gegen den Notzugang.
 * @returns {Promise<{uid:string, name:string, role:string}|null>}
 */
export async function anmelden(env, user, pass) {
  const u = normalize(user).toLowerCase();
  const p = normalize(pass);

  try {
    const row = await env.DB.prepare(
      `SELECT id,username,name,pass_hash,role,active FROM users WHERE username=?`).bind(u).first();
    if (row && row.active && await passwortPasst(p, row.pass_hash)) {
      try {
        await env.DB.prepare(`UPDATE users SET last_login=? WHERE id=?`)
          .bind(new Date().toISOString(), row.id).run();
      } catch { /* nicht kritisch */ }
      return { uid: row.id, name: row.name, role: row.role };
    }
  } catch { /* Tabelle fehlt — weiter zum Notzugang */ }

  if (checkCredentials(env, user, pass)) {
    return { uid: 'env', name: 'Goya´s Lamm', role: 'chef' };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Rechte                                                              */
/* ------------------------------------------------------------------ */

export const ROLLEN = {
  chef: {
    label: 'Chef',
    text: 'Alles — Reservierungen, Speisekarte, Tische, Personal, Arbeitszeit, Benutzer.',
  },
  service: {
    label: 'Service',
    text: 'Reservierungen ansehen und pflegen, Tagesliste, Küchenzettel, Wareneingang '
        + 'annehmen. Keine Speisekarte, keine Tische, kein Personal, keine Arbeitszeit, '
        + 'keine Einkaufsauswertung.',
  },
  demo: {
    label: 'Demo',
    text: 'Nur ansehen. Gastnamen abgekürzt, keine Telefonnummern oder E-Mail-Adressen, '
        + 'keine personenbezogenen Listen, kein Personal. Kann nichts ändern.',
  },
};

/** Seiten, die eine Rolle NICHT öffnen darf. */
const GESPERRT = {
  chef: [],
  /* Service nimmt Ware an und pflegt dafür auch die Stammdaten — aber die
     Auswertung, in der Einkaufspreise und Monatsausgaben stehen, bleibt zu. */
  service: ['/admin/karte', '/admin/gericht', '/admin/tische', '/admin/zeiten', '/admin/personal',
            '/admin/arbeitszeit', '/admin/zeitzettel', '/admin/stempel', '/admin/benutzer',
            '/admin/preise', '/admin/inventur'],
  demo: ['/admin/karte', '/admin/gericht', '/admin/suche', '/admin/zettel', '/admin/neu', '/admin/r', '/admin/warteliste',
         '/admin/personal', '/admin/arbeitszeit', '/admin/zeitzettel', '/admin/stempel',
         '/admin/benutzer', '/admin/preise', '/admin/inventur',
         /* Der Demo-Zugang zeigt das Reservierungssystem. Einkaufspreise und
            Lieferantenkonditionen des Hauses gehören nicht dazu. */
         '/admin/ware', '/admin/lager', '/admin/warenblatt', '/admin/aufsteller'],
};

export const darfSeite = (role, pfad) =>
  !(GESPERRT[role] || []).some(p => pfad === p || pfad.startsWith(p + '/'));

/** Die Demo-Rolle darf grundsätzlich nichts speichern. */
export const darfSchreiben = role => role !== 'demo';

/** Dürfen Namen, Telefonnummern und E-Mail-Adressen im Klartext erscheinen? */
export const darfPersonendaten = role => role !== 'demo';

/** „Petra Schmidt" → „Petra S." */
export function kuerzeName(n) {
  const teile = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return '—';
  if (teile.length === 1) return teile[0];
  return `${teile[0]} ${teile[teile.length - 1][0]}.`;
}
