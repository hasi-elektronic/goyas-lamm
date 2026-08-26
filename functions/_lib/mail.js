/**
 * E-Mail-Versand über Resend.
 * Ohne gesetzten RESEND_API_KEY wird still übersprungen — die Reservierung
 * liegt dann trotzdem in der Datenbank und im Admin-Bereich.
 */
import { HOUSE, formatDateDE, esc } from './core.js';

const WINE = '#6D1826';
const INK  = '#14120F';
const SAND = '#E8E2D2';

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

export function guestMail(r, site) {
  const stornoUrl = `${site}/storno?token=${encodeURIComponent(r.token)}`;
  const body = `
    <p style="margin:0 0 14px;">Guten Tag ${esc(r.name.split(' ')[0] || r.name)},</p>
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
    <p style="margin:0;color:#6e675a;font-size:13px;">
      Bis bald in Horrheim.<br>Goya und Team</p>`;
  return { subject: `Ihre Reservierung am ${formatDateDE(r.res_date)}, ${r.res_time} Uhr`, html: shell('Reservierungsbestätigung', body) };
}

export function houseMail(r) {
  const body = `
    <p style="margin:0 0 4px;font-size:17px;font-weight:700;">Neue Online-Reservierung</p>
    ${details(r)}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
      <tr><td style="padding:6px 0;color:#6e675a;font-size:12px;letter-spacing:.14em;text-transform:uppercase;width:130px;">Telefon</td>
          <td style="padding:6px 0;font-weight:600;"><a href="tel:${esc(r.phone)}" style="color:${WINE};text-decoration:none;">${esc(r.phone)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#6e675a;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">E-Mail</td>
          <td style="padding:6px 0;font-weight:600;"><a href="mailto:${esc(r.email)}" style="color:${WINE};text-decoration:none;">${esc(r.email)}</a></td></tr>
    </table>
    <p style="margin:0;color:#6e675a;font-size:13px;">Eingegangen über lammm.de · Reservierungsnummer ${esc(r.id.slice(0, 8))}</p>`;
  return { subject: `Reservierung ${formatDateDE(r.res_date)} ${r.res_time} · ${r.guests} P. · ${r.name}`, html: shell('Neue Reservierung', body) };
}

export function cancelMailGuest(r) {
  const body = `
    <p style="margin:0 0 14px;">Guten Tag ${esc(r.name.split(' ')[0] || r.name)},</p>
    <p style="margin:0 0 4px;">Ihre Reservierung wurde aufgehoben:</p>
    ${details(r)}
    <p style="margin:0 0 18px;">Falls das ein Versehen war oder Sie einen neuen Termin möchten,
       rufen Sie uns einfach an: <a href="tel:${HOUSE.tel}" style="color:${WINE};">${esc(HOUSE.phone)}</a>.</p>
    <p style="margin:0;color:#6e675a;font-size:13px;">Bis zum nächsten Mal.<br>Goya und Team</p>`;
  return { subject: `Ihre Reservierung am ${formatDateDE(r.res_date)} wurde storniert`,
           html: shell('Stornierung', body) };
}

export function cancelMailHouse(r) {
  const body = `
    <p style="margin:0 0 4px;font-size:17px;font-weight:700;">Reservierung storniert</p>
    ${details(r)}
    <p style="margin:0;color:#6e675a;font-size:13px;">Der Gast hat online storniert · Nummer ${esc(r.id.slice(0, 8))}</p>`;
  return { subject: `Storniert: ${formatDateDE(r.res_date)} ${r.res_time} · ${r.guests} P. · ${r.name}`, html: shell('Stornierung', body) };
}

/** @returns {Promise<boolean>} true, wenn Resend die Mail angenommen hat. */
export async function send(env, to, subject, html, replyTo) {
  if (!env?.RESEND_API_KEY) return false;
  const from = env.RES_FROM || `Goya´s Lamm <reservierung@lammm.de>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from, to: [to], subject, html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
