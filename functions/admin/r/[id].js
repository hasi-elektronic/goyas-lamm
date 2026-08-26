import {
  formatDateDE, slotsForDate, isValidDate, clean, isEmail, isPhone, esc, nowBerlin, HOUSE,
} from '../../_lib/core.js';
import { layout, flash, redirect, sourcePill } from '../../_lib/ui.js';
import { cancelMailGuest, guestMail, send } from '../../_lib/mail.js';

async function load(env, id) {
  if (!env.DB || !/^[0-9a-f-]{8,36}$/i.test(id)) return null;
  return env.DB.prepare(`SELECT * FROM reservations WHERE id=?`).bind(id).first();
}

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const r = await load(env, params.id);
  if (!r) return layout({ title: 'Nicht gefunden', active: '', status: 404,
    body: '<div class="msg err">Diese Reservierung gibt es nicht (mehr).</div><a class="btn ghost" href="/admin">Zur Übersicht</a>' });

  const slots = slotsForDate(r.res_date);
  const timeOpts = (slots.length ? slots : [r.res_time])
    .map(t => `<option value="${t}" ${t === r.res_time ? 'selected' : ''}>${t} Uhr</option>`).join('');

  const cancelled = r.status === 'cancelled';

  const body = `
    <h1>${esc(r.name)}</h1>
    <p class="sub">${esc(formatDateDE(r.res_date))} · ${esc(r.res_time)} Uhr ·
       ${r.guests} ${r.guests === 1 ? 'Person' : 'Personen'} ${sourcePill(r.source)}
       ${cancelled ? ' · <b style="color:var(--wine)">storniert</b>' : ''}</p>
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="/admin/tag?d=${esc(r.res_date)}">&larr; Tagesansicht</a>
      <a class="btn ghost" href="tel:${esc(r.phone)}">${esc(r.phone)} anrufen</a>
      ${r.email ? `<a class="btn ghost" href="mailto:${esc(r.email)}">E-Mail schreiben</a>` : ''}
    </div>

    <form method="post" action="/admin/r/${esc(r.id)}" class="card">
      <h2>Reservierung bearbeiten</h2>
      <div class="body">
        <input type="hidden" name="do" value="save">
        <div class="grid">
          <div class="f"><label for="d">Datum</label>
            <input id="d" name="date" type="date" value="${esc(r.res_date)}" required></div>
          <div class="f"><label for="t">Uhrzeit</label>
            <select id="t" name="time" required>${timeOpts}</select></div>
          <div class="f"><label for="g">Personen</label>
            <input id="g" name="guests" type="number" min="1" max="60" value="${esc(String(r.guests))}" required></div>
          <div class="f"><label for="n">Name</label>
            <input id="n" name="name" value="${esc(r.name)}" required maxlength="80"></div>
          <div class="f"><label for="p">Telefon</label>
            <input id="p" name="phone" type="tel" value="${esc(r.phone)}" required maxlength="40"></div>
          <div class="f"><label for="e">E-Mail</label>
            <input id="e" name="email" type="email" value="${esc(r.email || '')}" maxlength="254"></div>
          <div class="f full"><label for="note">Anmerkung</label>
            <textarea id="note" name="note" maxlength="500">${esc(r.note || '')}</textarea></div>
        </div>
        <div class="row end" style="margin-top:1.3rem">
          <button class="btn" type="submit">Änderungen speichern</button>
        </div>
      </div>
    </form>

    <div class="card">
      <h2>Status</h2>
      <div class="body">
        <p class="meta" style="margin-top:0">Eingegangen am
          ${esc(new Date(r.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))} ·
          Nummer ${esc(r.id.slice(0, 8))} ·
          Bestätigungsmail ${r.mail_guest ? 'verschickt' : 'nicht verschickt'}</p>
        <div class="row">
          ${cancelled
            ? `<form method="post" action="/admin/r/${esc(r.id)}"><input type="hidden" name="do" value="restore">
                 <button class="btn" type="submit">Wieder aktivieren</button></form>`
            : `<form method="post" action="/admin/r/${esc(r.id)}"
                     onsubmit="return confirm('Reservierung stornieren?')">
                 <input type="hidden" name="do" value="cancel">
                 <label class="check" style="margin:0 0 .8rem">
                   <input type="checkbox" name="tell" value="1"><span>Gast per E-Mail informieren</span></label>
                 <div><button class="btn danger" type="submit">Stornieren</button></div>
               </form>`}
        </div>
      </div>
    </div>

    ${r.email ? `<div class="card">
      <h2>Bestätigung erneut senden</h2>
      <div class="body">
        <p class="meta" style="margin-top:0">Schickt dem Gast die Bestätigung mit Stornolink noch einmal an
           ${esc(r.email)}.</p>
        <form method="post" action="/admin/r/${esc(r.id)}">
          <input type="hidden" name="do" value="resend">
          <button class="btn ghost" type="submit" ${cancelled ? 'disabled' : ''}>Erneut senden</button>
        </form>
      </div></div>` : ''}`;

  return layout({ title: r.name, active: '', body });
}

export async function onRequestPost({ request, env, params }) {
  const url = new URL(request.url);
  const r = await load(env, params.id);
  if (!r) return redirect('/admin');

  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const back = `/admin/r/${r.id}`;
  const site = env.SITE_URL || url.origin;

  if (d.do === 'cancel') {
    await env.DB.prepare(`UPDATE reservations SET status='cancelled', cancelled_at=? WHERE id=?`)
      .bind(new Date().toISOString(), r.id).run();
    let note = '';
    if (d.tell === '1' && r.email) {
      const m = cancelMailGuest(r);
      const ok = await send(env, r.email, m.subject, m.html);
      note = ok ? ' Der Gast wurde informiert.' : ' Die E-Mail konnte nicht verschickt werden.';
    }
    return redirect(back, 'Reservierung storniert.' + note);
  }

  if (d.do === 'restore') {
    await env.DB.prepare(`UPDATE reservations SET status='confirmed', cancelled_at=NULL WHERE id=?`)
      .bind(r.id).run();
    return redirect(back, 'Reservierung ist wieder aktiv.');
  }

  if (d.do === 'resend') {
    if (!r.email) return redirect(back + '?err=' + encodeURIComponent('Keine E-Mail-Adresse hinterlegt.'));
    const g = guestMail(r, site);
    const ok = await send(env, r.email, g.subject, g.html, env.RES_HOUSE_EMAIL || HOUSE.mail);
    if (ok) await env.DB.prepare(`UPDATE reservations SET mail_guest=1 WHERE id=?`).bind(r.id).run();
    return redirect(back, ok ? 'Bestätigung wurde erneut verschickt.'
      : 'Versand nicht möglich — RESEND_API_KEY fehlt oder wurde abgelehnt.');
  }

  if (d.do === 'save') {
    const date = clean(d.date, 10);
    const time = clean(d.time, 5);
    const guests = parseInt(d.guests, 10);
    const name = clean(d.name, 80);
    const email = clean(d.email, 254).toLowerCase();
    const phone = clean(d.phone, 40);
    const note = clean(d.note, 500);

    if (!isValidDate(date) || !/^\d{1,2}:\d{2}$/.test(time)) {
      return redirect(back + '?err=' + encodeURIComponent('Datum oder Uhrzeit ist ungültig.'));
    }
    if (!Number.isFinite(guests) || guests < 1 || guests > 60) {
      return redirect(back + '?err=' + encodeURIComponent('Personenzahl zwischen 1 und 60 angeben.'));
    }
    if (name.length < 2 || !isPhone(phone)) {
      return redirect(back + '?err=' + encodeURIComponent('Name und Telefonnummer werden benötigt.'));
    }
    if (email && !isEmail(email)) {
      return redirect(back + '?err=' + encodeURIComponent('Die E-Mail-Adresse sieht nicht richtig aus.'));
    }

    await env.DB.prepare(
      `UPDATE reservations SET res_date=?, res_time=?, guests=?, name=?, email=?, phone=?, note=? WHERE id=?`
    ).bind(date, time, guests, name, email, phone, note || null, r.id).run();
    return redirect(back, 'Änderungen gespeichert.');
  }

  return redirect(back);
}
