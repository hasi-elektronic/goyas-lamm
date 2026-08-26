/**
 * Benutzer und Rollen. Nur für die Rolle „chef" erreichbar (siehe _middleware.js).
 *
 * Der Notzugang aus ADMIN_USER / ADMIN_PASS steht bewusst nicht in dieser Liste —
 * er lebt in den Umgebungsvariablen und ist die Rückfallebene, falls hier etwas
 * schiefgeht. Er lässt sich hier deshalb auch nicht abschalten.
 */
import { clean, esc, jsq } from '../_lib/core.js';
import { layout, flash, redirect, geheimnis } from '../_lib/ui.js';
import { passwortHash, ROLLEN } from '../_lib/auth.js';

const nutzername = v => clean(v, 40).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9._-]/g, '');

const WOERTER = ['Anis','Basilikum','Dill','Estragon','Fenchel','Ingwer','Kerbel','Lorbeer',
  'Majoran','Nelke','Oregano','Petersilie','Quelle','Rosmarin','Salbei','Thymian','Wacholder',
  'Zimt','Kapern','Kümmel','Minze','Safran'];

function passwortVorschlag() {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  const zahl = 10 + (a[2] % 90);
  return `${WOERTER[a[0] % WOERTER.length]}-${WOERTER[a[1] % WOERTER.length]}-${zahl}`;
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;

  let leute = [];
  let fehler = '';
  try {
    leute = (await db.prepare(
      `SELECT id,username,name,role,active,note,created_at,last_login FROM users
        ORDER BY active DESC, name`).all()).results || [];
  } catch {
    fehler = 'Die Tabelle „users" fehlt noch — bitte Migration 0008_users.sql einspielen.';
  }

  const rollenAuswahl = sel => Object.entries(ROLLEN)
    .map(([k, r]) => `<option value="${k}"${sel === k ? ' selected' : ''}>${esc(r.label)}</option>`)
    .join('');

  const datum = v => v
    ? new Date(v).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '—';

  const zeile = u => `<tr class="${u.active ? '' : 'cancelled'}">
    <td colspan="4" style="padding:0">
      <form method="post" action="/admin/benutzer" class="trow">
        <input type="hidden" name="do" value="save">
        <input type="hidden" name="id" value="${esc(u.id)}">
        <div class="f"><label for="n-${esc(u.id)}">Name</label>
          <input id="n-${esc(u.id)}" name="name" value="${esc(u.name)}" maxlength="60" required></div>
        <div class="f"><label for="u-${esc(u.id)}">Benutzername</label>
          <input id="u-${esc(u.id)}" name="username" value="${esc(u.username)}" maxlength="40" required></div>
        <div class="f"><label for="r-${esc(u.id)}">Rolle</label>
          <select id="r-${esc(u.id)}" name="role">${rollenAuswahl(u.role)}</select></div>
        <div class="f"><label for="p-${esc(u.id)}">Neues Passwort</label>
          <input id="p-${esc(u.id)}" name="pass" maxlength="60" placeholder="leer = unverändert"></div>
        <div class="trow-act"><button class="btn sm" type="submit">Speichern</button></div>
      </form>
      <div class="trow-sub">
        <span class="pill ${u.role === 'chef' ? 'walk' : u.role === 'demo' ? 'tel' : 'web'}">${esc(ROLLEN[u.role]?.label || u.role)}</span>
        <span class="meta">angelegt ${esc(datum(u.created_at))} ·
          zuletzt angemeldet ${esc(datum(u.last_login))}</span>
        ${u.note ? `<span class="meta">${esc(u.note)}</span>` : ''}
        <form method="post" action="/admin/benutzer" style="display:inline">
          <input type="hidden" name="do" value="${u.active ? 'off' : 'on'}">
          <input type="hidden" name="id" value="${esc(u.id)}">
          <button class="btn sm danger" type="submit">${u.active ? 'Sperren' : 'Wieder freigeben'}</button>
        </form>
        <form method="post" action="/admin/benutzer" style="display:inline"
              onsubmit="return confirm('Zugang ' + ${jsq(u.username)} + ' löschen?')">
          <input type="hidden" name="do" value="del">
          <input type="hidden" name="id" value="${esc(u.id)}">
          <button class="btn sm danger" type="submit">Löschen</button>
        </form>
      </div>
    </td></tr>`;

  const body = `
    <h1>Benutzer</h1>
    <p class="sub">Wer sich anmelden darf und was er sehen kann.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="stats">
      <div class="stat"><b>${leute.filter(u => u.active).length}</b><span>aktive Zugänge</span></div>
      <div class="stat"><b>${leute.filter(u => u.role === 'chef' && u.active).length}</b><span>mit vollen Rechten</span></div>
      <div class="stat"><b>${leute.filter(u => u.role === 'demo' && u.active).length}</b><span>Demo-Zugänge</span></div>
    </div>

    <div class="card">
      <h2>Zugang anlegen</h2>
      <div class="body">
        <form method="post" action="/admin/benutzer">
          <input type="hidden" name="do" value="add">
          <div class="grid">
            <div class="f"><label for="nn">Name</label>
              <input id="nn" name="name" maxlength="60" placeholder="Vorname Nachname" required></div>
            <div class="f"><label for="nu">Benutzername</label>
              <input id="nu" name="username" maxlength="40" placeholder="vorname" required
                     autocapitalize="none" autocorrect="off" spellcheck="false"></div>
            <div class="f"><label for="nr">Rolle</label>
              <select id="nr" name="role">${rollenAuswahl('service')}</select></div>
            <div class="f"><label for="np">Passwort</label>
              <input id="np" name="pass" maxlength="60" value="${esc(passwortVorschlag())}">
              <p class="hint">Vorschlag — kann überschrieben werden. Wird nach dem Anlegen
                 einmal angezeigt und danach nie wieder.</p></div>
            <div class="f full"><label for="nz">Notiz</label>
              <input id="nz" name="note" maxlength="120" placeholder="wofür dieser Zugang da ist"></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn" type="submit">Anlegen</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Zugänge <em>${leute.length}</em></h2>
      ${leute.length ? `<table><tbody>${leute.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">Noch kein eigener Zugang angelegt — es gilt nur der Hauptzugang.</div>'}
    </div>

    <div class="card">
      <h2>Was die Rollen dürfen</h2>
      <div class="body meta">
        ${Object.entries(ROLLEN).map(([k, r]) =>
          `<p style="margin:0 0 .7rem"><b>${esc(r.label)}</b> — ${esc(r.text)}</p>`).join('')}
        <p style="margin:.9rem 0 0">Der <b>Hauptzugang</b> (${esc(String(env.ADMIN_USER || 'admin'))})
           steht nicht in dieser Liste. Er liegt in den Einstellungen des Servers und ist die
           Rückfallebene, falls hier einmal etwas schiefgeht — deshalb lässt er sich hier auch
           nicht sperren. Ändern kann ihn Hasi Elektronic in einer Minute.</p>
      </div>
    </div>

    <div class="card">
      <h2>Demo-Zugänge und echte Gastdaten</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem">Im Panel stehen Namen, Telefonnummern und E-Mail-Adressen
           echter Gäste sowie die Arbeitszeiten der Mitarbeiter. Das sind personenbezogene
           Daten; verantwortlich dafür ist das Restaurant.</p>
        <p style="margin:0">Deshalb sieht die Rolle <b>Demo</b> keine Kontaktdaten, keine
           Suche, keinen Küchenzettel und kein Personal — und Gastnamen nur abgekürzt
           („Petra S."). So lässt sich das System zeigen, ohne die Daten der Gäste
           weiterzugeben.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Benutzer', active: '/admin/benutzer', body });
}

export async function onRequestPost({ request, env, data }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const fehler = m => redirect('/admin/benutzer?err=' + encodeURIComponent(m));
  if (!db) return fehler('Keine Datenbankverbindung.');

  const id   = clean(d.id, 40);
  const name = clean(d.name, 60);
  const user = nutzername(d.username);
  const rolle = Object.keys(ROLLEN).includes(clean(d.role, 20)) ? clean(d.role, 20) : 'service';
  const pass = clean(d.pass, 60);
  const note = clean(d.note, 120);

  try {
    if (d.do === 'add') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      if (user.length < 3) return fehler('Der Benutzername braucht mindestens drei Zeichen (Buchstaben und Ziffern).');
      if (pass.length < 8) return fehler('Das Passwort braucht mindestens acht Zeichen.');
      if (user === String(env.ADMIN_USER || '').toLowerCase()) {
        return fehler('Dieser Benutzername ist für den Hauptzugang reserviert.');
      }
      const dupe = await db.prepare(`SELECT id FROM users WHERE username=?`).bind(user).first();
      if (dupe) return fehler(`„${user}" gibt es schon.`);
      await db.prepare(
        `INSERT INTO users (id,username,name,pass_hash,role,active,note,created_at)
         VALUES (?,?,?,?,?,1,?,?)`
      ).bind(crypto.randomUUID(), user, name, await passwortHash(pass), rolle,
             note || null, new Date().toISOString()).run();
      return geheimnis({
        user: data?.user, titel: `${name} ist angelegt`,
        zeilen: [['Benutzer', user], ['Passwort', pass], ['Rolle', ROLLEN[rolle]?.label || rolle]],
        hinweis: 'Das Passwort steht nur hier. Es wird verschlüsselt gespeichert und lässt sich '
               + 'nicht wieder anzeigen — vergessen heißt: ein neues vergeben.',
        zurueck: '/admin/benutzer',
      });
    }

    if (!id) return fehler('Zugang nicht gefunden.');

    if (d.do === 'save') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      if (user.length < 3) return fehler('Der Benutzername braucht mindestens drei Zeichen.');
      if (pass && pass.length < 8) return fehler('Das Passwort braucht mindestens acht Zeichen.');
      const dupe = await db.prepare(`SELECT id FROM users WHERE username=? AND id<>?`)
        .bind(user, id).first();
      if (dupe) return fehler(`„${user}" gibt es schon.`);
      if (pass) {
        await db.prepare(`UPDATE users SET name=?, username=?, role=?, pass_hash=? WHERE id=?`)
          .bind(name, user, rolle, await passwortHash(pass), id).run();
        return geheimnis({
          user: data?.user, titel: `${name}: neues Passwort`,
          zeilen: [['Benutzer', user], ['Passwort', pass]],
          hinweis: 'Der bisherige Zugang gilt nicht mehr.',
          zurueck: '/admin/benutzer',
        });
      }
      await db.prepare(`UPDATE users SET name=?, username=?, role=? WHERE id=?`)
        .bind(name, user, rolle, id).run();
      return redirect('/admin/benutzer', `${name} gespeichert.`);
    }

    if (d.do === 'on' || d.do === 'off') {
      const an = d.do === 'on' ? 1 : 0;
      const u = await db.prepare(`SELECT name FROM users WHERE id=?`).bind(id).first();
      await db.prepare(`UPDATE users SET active=? WHERE id=?`).bind(an, id).run();
      return redirect('/admin/benutzer',
        `${u?.name || 'Zugang'} ist ${an ? 'wieder freigegeben' : 'gesperrt'}.`);
    }

    if (d.do === 'del') {
      if (data?.user?.id === id) return fehler('Den eigenen Zugang kann man nicht löschen.');
      const u = await db.prepare(`SELECT name FROM users WHERE id=?`).bind(id).first();
      await db.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
      return redirect('/admin/benutzer', `${u?.name || 'Zugang'} gelöscht.`);
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect('/admin/benutzer');
}
