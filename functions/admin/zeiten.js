import { nowBerlin, formatDateDE, isValidDate, clean, esc, capacityFor, HOURS, WEEKDAY_DE } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const now = nowBerlin();
  const db = env.DB;

  const closures = db ? (await db.prepare(
    `SELECT day, reason FROM closures WHERE day >= ? ORDER BY day`
  ).bind(now.date).all()).results || [] : [];

  const caps = db ? (await db.prepare(
    `SELECT day, seats_slot FROM capacity_overrides WHERE day >= ? ORDER BY day`
  ).bind(now.date).all()).results || [] : [];

  const kap = await capacityFor(db, env, null);
  const cap = kap.seats;
  const capHerkunft = kap.source === 'tische'
    ? `Summe aus ${kap.tables.count} aktiven Tischen`
    : 'Rückfallwert, es sind noch keine Tische angelegt';

  const hoursRows = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const h = HOURS[d];
    return `<tr><td>${WEEKDAY_DE[d]}</td>
      <td class="t">${h ? `${h.open} – ${h.close} Uhr` : '<span class="meta">Ruhetag</span>'}</td></tr>`;
  }).join('');

  const body = `
    <h1>Schließtage &amp; Kapazität</h1>
    <p class="sub">Urlaub, Feiertage und Tage mit abweichender Platzzahl. Online kann an
       Schließtagen nicht reserviert werden.</p>
    ${flash(url)}

    <div class="card">
      <h2>Schließtag eintragen</h2>
      <div class="body">
        <form method="post" action="/admin/zeiten">
          <input type="hidden" name="do" value="close">
          <div class="grid">
            <div class="f"><label for="cd">Datum</label>
              <input id="cd" name="day" type="date" min="${now.date}" required></div>
            <div class="f"><label for="cr">Grund</label>
              <input id="cr" name="reason" maxlength="80" placeholder="Betriebsurlaub, Feiertag, Familienfeier …"></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn" type="submit">Eintragen</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Kommende Schließtage <em>${closures.length}</em></h2>
      ${closures.length ? `<table><tbody>${closures.map(c => `<tr>
        <td class="t">${esc(formatDateDE(c.day))}</td>
        <td>${esc(c.reason || 'geschlossen')}</td>
        <td class="act">
          <form method="post" action="/admin/zeiten" style="display:inline">
            <input type="hidden" name="do" value="open"><input type="hidden" name="day" value="${esc(c.day)}">
            <button class="btn sm danger" type="submit">Wieder öffnen</button>
          </form></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Keine Schließtage eingetragen.</div>'}
    </div>

    <div class="card">
      <h2>Platzzahl für einen einzelnen Tag <em>Standard: ${cap} Plätze — ${capHerkunft}</em></h2>
      <div class="body">
        <form method="post" action="/admin/zeiten">
          <input type="hidden" name="do" value="cap">
          <div class="grid">
            <div class="f"><label for="kd">Datum</label>
              <input id="kd" name="day" type="date" min="${now.date}" required></div>
            <div class="f"><label for="ks">Plätze je Zeitfenster</label>
              <input id="ks" name="seats" type="number" min="0" max="500" value="${cap}" required>
              <p class="hint">0 = online komplett dicht, ohne Schließtag-Hinweis.
                 Ein Eintrag hier sticht die <a href="/admin/tische">Tischliste</a> für diesen einen Tag.</p></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn" type="submit">Speichern</button></div>
          </div>
        </form>
      </div>
    </div>

    ${caps.length ? `<div class="card">
      <h2>Abweichende Platzzahlen</h2>
      <table><tbody>${caps.map(c => `<tr>
        <td class="t">${esc(formatDateDE(c.day))}</td>
        <td>${esc(String(c.seats_slot))} Plätze je Zeitfenster</td>
        <td class="act"><form method="post" action="/admin/zeiten" style="display:inline">
          <input type="hidden" name="do" value="capdel"><input type="hidden" name="day" value="${esc(c.day)}">
          <button class="btn sm danger" type="submit">Zurücksetzen</button></form></td>
      </tr>`).join('')}</tbody></table></div>` : ''}

    <div class="card">
      <h2>Reguläre Öffnungszeiten <em>Änderung nur über Hasi Elektronic</em></h2>
      <table><tbody>${hoursRows}</tbody></table>
      <div class="body meta">Letzte Reservierung jeweils eine Stunde vor Küchenschluss.
        Sollen sich diese Zeiten dauerhaft ändern, kurz bei Hasi Elektronic melden —
        das steht im Programmcode, nicht in der Datenbank.</div>
    </div>`;

  return layout({ user: data?.user, title: 'Schließtage', active: '/admin/zeiten', body });
}

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const day = clean(d.day, 10);

  if (!db || !isValidDate(day)) {
    return redirect('/admin/zeiten?err=' + encodeURIComponent('Bitte ein gültiges Datum wählen.'));
  }

  if (d.do === 'close') {
    await db.prepare(`INSERT INTO closures (day, reason) VALUES (?,?)
      ON CONFLICT(day) DO UPDATE SET reason=excluded.reason`)
      .bind(day, clean(d.reason, 80) || 'geschlossen').run();
    return redirect('/admin/zeiten', `${formatDateDE(day)} ist jetzt als Schließtag hinterlegt.`);
  }

  if (d.do === 'open') {
    await db.prepare(`DELETE FROM closures WHERE day=?`).bind(day).run();
    return redirect('/admin/zeiten', `${formatDateDE(day)} ist wieder geöffnet.`);
  }

  if (d.do === 'cap') {
    const seats = parseInt(d.seats, 10);
    if (!Number.isFinite(seats) || seats < 0 || seats > 500) {
      return redirect('/admin/zeiten?err=' + encodeURIComponent('Platzzahl zwischen 0 und 500 angeben.'));
    }
    await db.prepare(`INSERT INTO capacity_overrides (day, seats_slot) VALUES (?,?)
      ON CONFLICT(day) DO UPDATE SET seats_slot=excluded.seats_slot`).bind(day, seats).run();
    return redirect('/admin/zeiten', `${formatDateDE(day)}: ${seats} Plätze je Zeitfenster.`);
  }

  if (d.do === 'capdel') {
    await db.prepare(`DELETE FROM capacity_overrides WHERE day=?`).bind(day).run();
    return redirect('/admin/zeiten', `${formatDateDE(day)} nutzt wieder die Standard-Platzzahl.`);
  }

  return redirect('/admin/zeiten');
}
