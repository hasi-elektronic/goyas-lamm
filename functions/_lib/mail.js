/**
 * E-Mail-Versand über den **Cloudflare Email Service** (Email Sending).
 *
 * Zwei Wege, in dieser Reihenfolge:
 *   1. Workers-Binding  env.EMAIL.send({...})        — falls ein send_email-Binding existiert
 *   2. REST-API         POST /accounts/{id}/email/sending/send
 *
 * Ist keiner davon eingerichtet, wird still übersprungen: die Reservierung liegt
 * trotzdem in der Datenbank und im Admin-Bereich.
 *
 * Kein Drittanbieter — derselbe Auftragsverarbeiter wie das Hosting.
 */
import { HOUSE, formatDateDE, esc } from './core.js';

const WINE = '#6D1826';
const INK  = '#14120F';
const SAND = '#E8E2D2';

/* ------------------------------------------------------------------ */
/* Vorlagen                                                            */
/* ------------------------------------------------------------------ */

function shell(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f7ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ea;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbfaf3;border:1px solid ${SAND};">
    <tr><td style="background:${INK};padding:22px 28px;">
      <div style="font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#c0a062;font-weight:700;">Goya´s Lamm</div>
      <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,247,234,.62);margin-top:5px;">Horrheim</div>
    </td></tr>
    <tr><td style="padding:30px 28px;font-size:15px;line-height:1.65;">${bodyHtml}</td></tr>
    <tr><td style="border-top:1px solid ${SAND};padding:18px 28px;font-size:12px;line-height:1.6;color:#6e675a;">
      ${esc(HOUSE.name)} · ${esc(HOUSE.addr)}<br>
      Telefon <a href="tel:${HOUSE.tel}" style="color:${WINE};text-decoration:none;">${esc(HOUSE.phone)}</a> ·
      <a href="mailto:${HOUSE.mail}" style="color:${WINE};text-decoration:none;">${esc(HOUSE.mail)}</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function details(r) {
  const row = (k, v) => `<tr>
    <td style="padding:7px 0;color:#6e675a;font-size:12px;letter-spacing:.14em;text-transform:uppercase;width:130px;vertical-align:top;">${esc(k)}</td>
    <td style="padding:7px 0;font-weight:600;">${v}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="margin:20px 0;border-top:1px solid ${SAND};border-bottom:1px solid ${SAND};">
    ${row('Datum', esc(formatDateDE(r.res_date)))}
    ${row('Uhrzeit', esc(r.res_time) + ' Uhr')}
    ${row('Personen', esc(String(r.guests)))}
    ${row('Name', esc(r.name))}
    ${r.note ? row('Anmerkung', esc(r.note)) : ''}
  </table>`;
}

const detailsText = r =>
  `Datum:    ${formatDateDE(r.res_date)}\n` +
  `Uhrzeit:  ${r.res_time} Uhr\n` +
  `Personen: ${r.guests}\n` +
  `Name:     ${r.name}\n` +
  (r.note ? `Hinweis:  ${r.note}\n` : '');

const foot = `\n--\n${HOUSE.name} · ${HOUSE.addr}\nTelefon ${HOUSE.phone} · ${HOUSE.mail}\n`;
const TITLES = ['familie', 'fam.', 'fam', 'herr', 'frau', 'dr.', 'prof.'];
/** „Familie Bauer" → „Familie Bauer", „Petra Schmidt" → „Petra". */
const firstName = n => {
  const parts = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return String(n || '');
  return TITLES.includes(parts[0].toLowerCase()) ? parts.slice(0, 2).join(' ') : parts[0];
};

export function guestMail(r, site) {
  const stornoUrl = `${site}/storno?token=${encodeURIComponent(r.token)}`;
  const html = shell('Reservierungsbestätigung', `
    <p style="margin:0 0 14px;">Guten Tag ${esc(firstName(r.name))},</p>
    <p style="margin:0 0 4px;">Ihr Tisch ist reserviert. Wir freuen uns auf Ihren Besuch.</p>
    ${details(r)}
    <p style="margin:0 0 20px;">Sollten sich Ihre Pläne ändern, sagen Sie uns bitte kurz Bescheid —
       telefonisch unter <a href="tel:${HOUSE.tel}" style="color:${WINE};">${esc(HOUSE.phone)}</a>
       oder über den folgenden Link.</p>
    <p style="margin:0 0 22px;">
      <a href="${esc(stornoUrl)}" style="display:inline-block;background:${WINE};color:#fff;
         text-decoration:none;padding:13px 26px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">
         Reservierung stornieren</a>
    </p>
    <p style="margin:0;color:#6e675a;font-size:13px;">Bis bald in Horrheim.<br>Goya und Team</p>`);
  const text =
    `Guten Tag ${firstName(r.name)},\n\nIhr Tisch ist reserviert. Wir freuen uns auf Ihren Besuch.\n\n` +
    detailsText(r) +
    `\nStornieren: ${stornoUrl}\nOder rufen Sie uns an: ${HOUSE.phone}\n\nBis bald in Horrheim.\nGoya und Team\n` + foot;
  return { subject: `Ihre Reservierung am ${formatDateDE(r.res_date)}, ${r.res_time} Uhr`, html, text };
}

export function houseMail(r) {
  const html = shell('Neue Reservierung', `
    <p style="margin:0 0 4px;font-size:17px;font-weight:700;">Neue Online-Reservierung</p>
    ${details(r)}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
      <tr><td style="padding:6px 0;color:#6e675a;font-size:12px;letter-spacing:.14em;text-transform:uppercase;width:130px;">Telefon</td>
          <td style="padding:6px 0;font-weight:600;"><a href="tel:${esc(r.phone)}" style="color:${WINE};text-decoration:none;">${esc(r.phone)}</a></td></tr>
      ${r.email ? `<tr><td style="padding:6px 0;color:#6e675a;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">E-Mail</td>
          <td style="padding:6px 0;font-weight:600;"><a href="mailto:${esc(r.email)}" style="color:${WINE};text-decoration:none;">${esc(r.email)}</a></td></tr>` : ''}
    </table>
    <p style="margin:0;color:#6e675a;font-size:13px;">Eingegangen über lammm.de · Reservierungsnummer ${esc(r.id.slice(0, 8))}</p>`);
  const text = `Neue Reservierung\n\n${detailsText(r)}Telefon:  ${r.phone}\n` +
    (r.email ? `E-Mail:   ${r.email}\n` : '') +
    `Nummer:   ${r.id.slice(0, 8)}\n` + foot;
  return { subject: `Reservierung ${formatDateDE(r.res_date)} ${r.res_time} · ${r.guests} P. · ${r.name}`, html, text };
}

export function cancelMailGuest(r) {
  const html = shell('Stornierung', `
    <p style="margin:0 0 14px;">Guten Tag ${esc(firstName(r.name))},</p>
    <p style="margin:0 0 4px;">Ihre Reservierung wurde aufgehoben:</p>
    ${details(r)}
    <p style="margin:0 0 18px;">Falls das ein Versehen war oder Sie einen neuen Termin möchten,
       rufen Sie uns einfach an: <a href="tel:${HOUSE.tel}" style="color:${WINE};">${esc(HOUSE.phone)}</a>.</p>
    <p style="margin:0;color:#6e675a;font-size:13px;">Bis zum nächsten Mal.<br>Goya und Team</p>`);
  const text = `Guten Tag ${firstName(r.name)},\n\nIhre Reservierung wurde aufgehoben:\n\n` +
    detailsText(r) + `\nNeuer Termin? Rufen Sie uns an: ${HOUSE.phone}\n` + foot;
  return { subject: `Ihre Reservierung am ${formatDateDE(r.res_date)} wurde storniert`, html, text };
}

export function cancelMailHouse(r) {
  const html = shell('Stornierung', `
    <p style="margin:0 0 4px;font-size:17px;font-weight:700;">Reservierung storniert</p>
    ${details(r)}
    <p style="margin:0;color:#6e675a;font-size:13px;">Der Gast hat online storniert · Nummer ${esc(r.id.slice(0, 8))}</p>`);
  const text = `Reservierung storniert (Gast hat online storniert)\n\n${detailsText(r)}Nummer: ${r.id.slice(0, 8)}\n` + foot;
  return { subject: `Storniert: ${formatDateDE(r.res_date)} ${r.res_time} · ${r.guests} P. · ${r.name}`, html, text };
}

/* ------------------------------------------------------------------ */
/* Versand                                                             */
/* ------------------------------------------------------------------ */

/** `Name <adresse@x.de>` oder `adresse@x.de` → { address, name } */
export function parseAddress(v) {
  const s = String(v || '').trim();
  const m = s.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { address: m[2].trim(), name: m[1].replace(/^"|"$/g, '').trim() || undefined };
  return { address: s };
}

const fromOf = env => parseAddress(
  env.MAIL_FROM || env.RES_FROM || `Goya´s Lamm <reservierung@${env.MAIL_DOMAIN || 'lammm.de'}>`
);

/** Ist der Versand überhaupt eingerichtet? */
export const mailReady = env =>
  !!(env?.EMAIL || (env?.CF_EMAIL_TOKEN && (env?.MAIL_ACCOUNT_ID || env?.CF_ACCOUNT_ID)));

/**
 * Verschickt eine Mail. Gibt true zurück, wenn Cloudflare sie angenommen hat.
 * @param {object} msg { to, subject, html, text, replyTo }
 */
export async function send(env, to, subject, html, replyTo, text) {
  if (!to) return false;
  const from = fromOf(env);

  /* 1) Workers-Binding */
  if (env?.EMAIL?.send) {
    try {
      await env.EMAIL.send({
        to,
        from: from.name ? { email: from.address, name: from.name } : from.address,
        subject, html,
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      return true;
    } catch {
      /* auf die REST-API zurückfallen */
    }
  }

  /* 2) REST-API */
  const token = env?.CF_EMAIL_TOKEN;
  const account = env?.MAIL_ACCOUNT_ID || env?.CF_ACCOUNT_ID;
  if (!token || !account) return false;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          to,
          from: from.name ? { address: from.address, name: from.name } : from.address,
          subject, html,
          ...(text ? { text } : {}),
          ...(replyTo ? { headers: { 'Reply-To': replyTo } } : {}),
        }),
      }
    );
    if (!res.ok) return false;
    const j = await res.json().catch(() => null);
    return !!j?.success;
  } catch {
    return false;
  }
}
