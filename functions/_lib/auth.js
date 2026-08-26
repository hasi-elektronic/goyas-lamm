/** Signierte Cookie-Sitzung für den Admin-Bereich. */
export const loginPath = '/admin/login';
const COOKIE = 'gl_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

const enc = new TextEncoder();

async function hmac(env, data) {
  const secret = `${env.ADMIN_USER || ''}:${env.ADMIN_PASS || ''}:${env.IP_SALT || 'goyas'}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(env) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const value = `${exp}.${await hmac(env, exp)}`;
  return `${COOKIE}=${value}; Path=/admin; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearSession = () =>
  `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export async function verifySession(request, env) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig) return false;
  if (!Number.isFinite(+exp) || +exp < Date.now()) return false;
  return safeEqual(sig, await hmac(env, exp));
}

export function checkCredentials(env, user, pass) {
  return safeEqual(String(user || ''), String(env.ADMIN_USER || ' ')) &&
         safeEqual(String(pass || ''), String(env.ADMIN_PASS || ' '));
}
