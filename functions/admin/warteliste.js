/**
 * Warteliste im Panel.
 * Zeigt je Eintrag, ob inzwischen wieder Platz ist — damit klar ist, wen man
 * zuerst anruft. Zusagen macht immer ein Mensch am Telefon.
 */
import {
  clean, esc, nowBerlin, formatDateDE, diffDays, availability,
} from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();
  const zeigeAlte = url.searchParams.get('alle') === '1';

  let rows = [];
  let fehler = '';
  try {
    rows = (await db.prepare(
      `SELECT id,created_at,res_date,res_time,guests,name,phone,email,note,status,closed_at
         FROM waitlist
        WHERE ${zeigeAlte ? '1=1' : `status='offen' AND res_date >= ?`}
        ORDER BY res_date, res_time, created_at
        LIMIT 200`
    ).bind(...(zeigeAlte ? [] : [now.date])).all()).results || [];
  } catch {
    fehler = 'Die Tabelle „waitlist" fehlt noch — bitte Migration 0009_warteliste.sql einspielen.';
  }

  const offen = rows.filter(r => r.status === 'offen' && diffDays(now.date, r.res_date) >= 0);

  /* Für jeden offenen Wunschtag einmal nachsehen, ob wieder Platz ist. */
  const frei = {};
  for (const tag of [...new Set(offen.map(r => r.res_date))]) {
    try {
      const a = await availability(db, env, tag, 1);
      frei[tag] = a.closed ? null : a.slots;
    } catch { frei[tag] = null; }
  }

  const platzFuer = r => {
    const s = frei[r.res_date];
    if (!s) return null;
    const passend = r.res_time
      ? s.filter(x => x.time === r.res_time && x.free >= r.guests)
      : s.filter(x => x.free >= r.guests);
    return passend.length ? passend : null;
  };

  const zeile = r => {
    const p = r.status === 'offen' ? platzFuer(r) : null;
    const vergangen = diffDays(now.date, r.res_date) < 0;
    return `<tr class="${r.status === 'offen' ? '' : 'cancelled'}">
      <td class="t">${esc(r.res_time || '—')}
        <div class="meta">${esc(formatDateDE(r.res_date).replace(/^(\w{2})\w+,/, '$1.'))}</div></td>
      <td class="nm"><b>${esc(r.name)}</b>
        ${r.note ? `<div class="meta">${esc(r.note)}</div>` : ''}
        ${r.status !== 'offen' ? `<div class="meta">${r.status === 'erledigt' ? 'erledigt' : 'abgesagt'}</div>` : ''}
        ${p ? `<div class="meta" style="color:var(--ok);font-weight:700">
            ${p.length === 1 ? `${esc(p[0].time)} Uhr wäre frei` : `${p.length} Zeiten wären frei`}
            — ${Math.max(...p.map(x => x.free))} Plätze</div>` : ''}</td>
      <td class="g">${esc(String(r.guests))}</td>
      <td class="hide-s"><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>
        ${r.email ? `<div class="meta">${esc(r.email)}</div>` : ''}</td>
      <td class="det meta show-s"><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td>
      <td class="act">
        ${r.status === 'offen' ? `
          <a class="btn sm" href="/admin/neu?d=${esc(r.res_date)}${r.res_time ? '&t=' + encodeURIComponent(r.res_time) : ''}">Eintragen</a>
          <form method="post" action="/admin/warteliste" style="display:inline">
            <input type="hidden" name="do" value="erledigt">
            <input type="hidden" name="id" value="${esc(r.id)}">
            <button class="btn sm ghost" type="submit">Erledigt</button></form>
          <form method="post" action="/admin/warteliste" style="display:inline">
            <input type="hidden" name="do" value="abgesagt">
            <input type="hidden" name="id" value="${esc(r.id)}">
            <button class="btn sm danger" type="submit">${vergangen ? 'Weg' : 'Abgesagt'}</button></form>`
        : `<form method="post" action="/admin/warteliste" style="display:inline">
            <input type="hidden" name="do" value="zurueck">
            <input type="hidden" name="id" value="${esc(r.id)}">
            <button class="btn sm ghost" type="submit">Wieder öffnen</button></form>`}
      </td></tr>`;
  };

  const mitPlatz = offen.filter(r => platzFuer(r)).length;

  const body = `
    <h1>Warteliste</h1>
    <p class="sub">Gäste, deren Wunschzeit ausgebucht war. Wer angerufen und einen Tisch
       bekommen hat, wird hier auf „erledigt" gesetzt.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="stats">
      <div class="stat hot"><b>${offen.length}</b><span>offen</span></div>
      <div class="stat ${mitPlatz ? 'hot' : ''}"><b>${mitPlatz}</b><span>Platz wäre frei</span></div>
      <div class="stat"><b>${offen.filter(r => r.res_date === now.date).length}</b><span>für heute</span></div>
    </div>

    ${mitPlatz ? `<div class="msg">Bei ${mitPlatz === 1 ? 'einem Eintrag' : `${mitPlatz} Einträgen`}
       ist inzwischen wieder Platz — ein Anruf lohnt sich.</div>` : ''}

    <div class="row" style="margin-bottom:1.2rem">
      <a class="btn ghost" href="/admin/warteliste${zeigeAlte ? '' : '?alle=1'}">
        ${zeigeAlte ? 'Nur offene zeigen' : 'Auch erledigte zeigen'}</a>
    </div>

    <div class="card">
      <h2>Einträge <em>${rows.length}</em></h2>
      ${rows.length ? `<table class="stack"><thead><tr>
          <th>Wunsch</th><th>Name</th><th>P.</th><th class="hide-s">Kontakt</th><th></th>
        </tr></thead><tbody>${rows.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">Niemand auf der Warteliste.</div>'}
    </div>

    <div class="card">
      <h2>Wie das gedacht ist</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem">Ist ein Abend online ausgebucht, bietet die Website statt
           einer Absage an, sich auf die Warteliste zu setzen — mit Name, Telefonnummer und
           Personenzahl. <b>Es wird nichts zugesagt.</b> Der Gast bekommt keinen Tisch und keine
           automatische Nachricht.</p>
        <p style="margin:0 0 .6rem">Wird durch eine Stornierung wieder Platz, steht das hier
           grün am Eintrag. Dann anrufen, und wenn es passt, über „Eintragen" gleich die
           Reservierung anlegen.</p>
        <p style="margin:0">Das ist der Unterschied zu einer Absage: aus „heute leider voll"
           wird ein Gast, den man zurückholen kann. Erfahrungsgemäß fällt an einem vollen
           Samstag fast immer noch ein Tisch aus.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Warteliste', active: '/admin/warteliste', body });
}

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const id = clean(d.id, 40);
  const fehler = m => redirect('/admin/warteliste?err=' + encodeURIComponent(m));
  if (!db || !id) return fehler('Eintrag nicht gefunden.');

  const status = { erledigt: 'erledigt', abgesagt: 'abgesagt', zurueck: 'offen' }[d.do];
  if (!status) return redirect('/admin/warteliste');

  try {
    await db.prepare(`UPDATE waitlist SET status=?, closed_at=? WHERE id=?`)
      .bind(status, status === 'offen' ? null : new Date().toISOString(), id).run();
  } catch {
    return fehler('Das hat nicht geklappt.');
  }
  return redirect('/admin/warteliste',
    status === 'offen' ? 'Eintrag wieder offen.'
    : status === 'erledigt' ? 'Als erledigt vermerkt.' : 'Vom Zettel genommen.');
}
