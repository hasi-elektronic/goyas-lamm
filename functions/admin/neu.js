import {
  nowBerlin, addDays, formatDateDE, slotsForDate, availability, esc, isValidDate, seatsPerSlot,
} from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { createReservation, BookError } from '../_lib/book.js';

async function form({ env, url, values = {}, error = null }) {
  const now = nowBerlin();
  const date = isValidDate(values.date || '') ? values.date : (url.searchParams.get('d') || now.date);
  const slots = slotsForDate(date);

  let load = {};
  if (env.DB && slots.length) {
    const rows = (await env.DB.prepare(
      `SELECT res_time, SUM(guests) t FROM reservations
        WHERE res_date=? AND status='confirmed' GROUP BY res_time`
    ).bind(date).all()).results || [];
    load = Object.fromEntries(rows.map(r => [r.res_time, Number(r.t) || 0]));
  }
  const cap = seatsPerSlot(env);
  const closed = env.DB ? await env.DB.prepare('SELECT reason FROM closures WHERE day=?').bind(date).first() : null;

  const preTime = values.time || url.searchParams.get('t') || '';

  const timeField = slots.length
    ? `<select id="t" name="time" required>${slots.map(t => {
        const used = load[t] || 0;
        const free = Math.max(0, cap - used);
        return `<option value="${t}" ${preTime === t ? 'selected' : ''}>${t} Uhr — ${free} von ${cap} frei</option>`;
      }).join('')}</select>
      <p class="hint">Freie Plätze je Zeitfenster in der Auswahl.</p>`
    : `<input id="t" name="time" type="time" step="900" value="${esc(preTime || '19:00')}" required>
      <p class="hint">An diesem Wochentag ist Ruhetag. Eintragen geht nur mit
         „Über Kapazität hinaus" — für geschlossene Gesellschaften und Sonderöffnungen.</p>`;

  const body = `
    <h1>Neue Reservierung</h1>
    <p class="sub">Für Anrufe und Gäste, die vor der Tür stehen. Die Bestätigungsmail ist optional.</p>
    ${flash(url)}
    ${error ? `<div class="msg err">${esc(error)}</div>` : ''}
    ${closed ? `<div class="msg warn">Für den ${esc(formatDateDE(date))} ist ein Schließtag hinterlegt
       (${esc(closed.reason || 'geschlossen')}). Eintragen geht nur mit „Über Kapazität hinaus".</div>` : ''}

    <form method="post" action="/admin/neu" class="card">
      <div class="body">
        <div class="grid">
          <div class="f">
            <label for="d">Datum</label>
            <input id="d" name="date" type="date" value="${esc(date)}" required
                   onchange="location.search='?d='+this.value">
            <p class="hint">${esc(formatDateDE(date))}</p>
          </div>
          <div class="f">
            <label for="t">Uhrzeit</label>
            ${timeField}
          </div>
          <div class="f">
            <label for="g">Personen</label>
            <input id="g" name="guests" type="number" min="1" max="60" step="1"
                   value="${esc(values.guests || '2')}" required>
          </div>
          <div class="f">
            <label for="src">Eingang</label>
            <select id="src" name="source">
              <option value="telefon" ${values.source === 'telefon' ? 'selected' : ''}>Telefon</option>
              <option value="walk" ${values.source === 'walk' ? 'selected' : ''}>Vor Ort</option>
              <option value="web" ${values.source === 'web' ? 'selected' : ''}>Online</option>
            </select>
          </div>
          <div class="f">
            <label for="n">Name</label>
            <input id="n" name="name" value="${esc(values.name || '')}" required maxlength="80">
          </div>
          <div class="f">
            <label for="p">Telefon</label>
            <input id="p" name="phone" type="tel" value="${esc(values.phone || '')}" required maxlength="40">
          </div>
          <div class="f full">
            <label for="e">E-Mail <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
            <input id="e" name="email" type="email" value="${esc(values.email || '')}" maxlength="254">
          </div>
          <div class="f full">
            <label for="note">Anmerkung</label>
            <textarea id="note" name="note" maxlength="500"
              placeholder="Kinderstuhl, Allergie, Geburtstag, Tischwunsch …">${esc(values.note || '')}</textarea>
          </div>
          <div class="f full">
            <label class="check"><input type="checkbox" name="mail" value="1" checked>
              <span>Bestätigungsmail an den Gast senden (nur wenn eine E-Mail-Adresse eingetragen ist)</span></label>
            <label class="check"><input type="checkbox" name="override" value="1">
              <span>Über die Kapazität hinaus eintragen — für Zusatztische, Schließtage und Sonderfälle</span></label>
          </div>
        </div>
        <div class="row end" style="margin-top:1.4rem">
          <a class="btn ghost" href="/admin">Abbrechen</a>
          <button class="btn" type="submit">Reservierung eintragen</button>
        </div>
      </div>
    </form>`;

  return layout({ title: 'Neue Reservierung', active: '/admin/neu', body, status: error ? 400 : 200 });
}

export const onRequestGet = ({ request, env }) =>
  form({ env, url: new URL(request.url) });

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }

  try {
    const rec = await createReservation(env.DB, env, d, {
      admin: true,
      source: ['telefon', 'walk', 'web'].includes(d.source) ? d.source : 'telefon',
      override: d.override === '1',
      notifyGuest: d.mail === '1',
      notifyHouse: false,
      site: env.SITE_URL || url.origin,
    });
    const mailNote = rec.mailed ? ' Bestätigung wurde verschickt.' : '';
    return redirect(`/admin/tag?d=${rec.res_date}`,
      `${rec.name}, ${rec.res_time} Uhr, ${rec.guests} ${rec.guests === 1 ? 'Person' : 'Personen'} eingetragen.${mailNote}`);
  } catch (e) {
    const msg = e instanceof BookError ? e.message : 'Die Reservierung konnte nicht gespeichert werden.';
    return form({ env, url, values: d, error: msg });
  }
}
