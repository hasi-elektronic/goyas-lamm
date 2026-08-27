/**
 * Mitarbeiter anlegen und pflegen. Die PIN wird nur als Hash gespeichert und
 * nach dem Setzen ein einziges Mal im Klartext angezeigt.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect, geheimnis } from '../_lib/ui.js';
import {
  pinHash, summe, centAus, euro, lohnCent, dezimal,
  MINDESTLOHN_CENT, MINIJOB_CENT,
} from '../_lib/zeit.js';
import { gespeicherterPin, setzePin, loeschePin, sperrCookie, DAUER_MIN } from '../_lib/chefpin.js';

const ROLLEN = ['Küche', 'Service', 'Bar', 'Aushilfe', 'Leitung'];

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;

  let leute = [];
  let fehler = '';
  let lohnSpalte = true;
  try {
    leute = (await db.prepare(
      `SELECT id,name,role,pin_hash,active,sort,wage_cent FROM staff
        ORDER BY active DESC, sort, name`).all()).results || [];
  } catch {
    /* Migration 0010 noch nicht eingespielt? Dann ohne Lohnspalte weiterarbeiten,
       statt die ganze Seite zu verweigern. */
    lohnSpalte = false;
    try {
      leute = (await db.prepare(
        `SELECT id,name,role,pin_hash,active,sort FROM staff ORDER BY active DESC, sort, name`
      ).all()).results || [];
      fehler = 'Der Stundenlohn fehlt noch — bitte Migration 0010_lohn.sql einspielen.';
    } catch {
      fehler = 'Die Tabelle „staff" fehlt noch — bitte Migration 0007_zeit.sql einspielen.';
    }
  }

  const chefPinGesetzt = !!await gespeicherterPin(db);

  /* Wer ist gerade eingestempelt? */
  let offen = [];
  try {
    offen = (await db.prepare(
      `SELECT staff_id, work_date, start_at FROM shifts WHERE end_at IS NULL`).all()).results || [];
  } catch { /* egal */ }
  const laeuft = Object.fromEntries(offen.map(o => [o.staff_id, o]));

  /* Monatssumme je Mitarbeiter, nur als Orientierung */
  const monat = nowBerlin().date.slice(0, 7);
  let schichten = [];
  try {
    schichten = (await db.prepare(
      `SELECT staff_id,work_date,start_at,end_at,break_min FROM shifts WHERE work_date LIKE ?`
    ).bind(monat + '%').all()).results || [];
  } catch { /* egal */ }

  const rollen = sel => ['', ...ROLLEN]
    .map(r => `<option value="${esc(r)}"${(sel || '') === r ? ' selected' : ''}>${r || '—'}</option>`).join('');

  const zeile = m => {
    const s = summe(schichten.filter(x => x.staff_id === m.id));
    const on = laeuft[m.id];
    const lohn = lohnCent(s.gerundet, m.wage_cent);
    const unterMindest = m.wage_cent && m.wage_cent < MINDESTLOHN_CENT;
    const ueberMinijob = lohn > MINIJOB_CENT;
    return `<tr class="${m.active ? '' : 'cancelled'}">
      <td colspan="4" style="padding:0">
        <form method="post" action="/admin/personal" class="trow">
          <input type="hidden" name="do" value="save">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="f"><label for="n-${esc(m.id)}">Name</label>
            <input id="n-${esc(m.id)}" name="name" value="${esc(m.name)}" maxlength="60" required></div>
          <div class="f"><label for="r-${esc(m.id)}">Bereich</label>
            <select id="r-${esc(m.id)}" name="role">${rollen(m.role)}</select></div>
          ${lohnSpalte ? `<div class="f"><label for="w-${esc(m.id)}">Stundenlohn €</label>
            <input id="w-${esc(m.id)}" name="wage" inputmode="decimal" maxlength="9"
                   value="${m.wage_cent ? esc(euro(m.wage_cent)) : ''}" placeholder="z. B. 14,50"></div>` : ''}
          <div class="f"><label for="p-${esc(m.id)}">Neue PIN</label>
            <input id="p-${esc(m.id)}" name="pin" inputmode="numeric" pattern="[0-9]{4}"
                   maxlength="4" placeholder="${m.pin_hash ? 'gesetzt' : 'fehlt'}"></div>
          <div class="f"><label for="s-${esc(m.id)}">Nr.</label>
            <input id="s-${esc(m.id)}" name="sort" type="number" min="0" max="999" value="${esc(String(m.sort))}"></div>
          <div class="trow-act"><button class="btn sm" type="submit">Speichern</button></div>
        </form>
        <div class="trow-sub">
          ${on ? `<span class="pill ns">seit ${esc(on.start_at)} Uhr im Dienst</span>` : ''}
          ${m.pin_hash ? '' : '<span class="pill">ohne PIN — kann nicht stempeln</span>'}
          ${unterMindest ? `<span class="pill ns">unter Mindestlohn (${euro(MINDESTLOHN_CENT)} €)</span>` : ''}
          ${ueberMinijob ? '<span class="pill">über der Minijob-Grenze</span>' : ''}
          <span class="meta">diesen Monat ${dezimal(s.gerundet)} h
            an ${s.tage} ${s.tage === 1 ? 'Tag' : 'Tagen'}${m.wage_cent
              ? ` · rund <b>${euro(lohn)} €</b> brutto` : ''}</span>
          <a class="btn sm ghost" href="/admin/arbeitszeit?p=${esc(m.id)}">Zeiten</a>
          <form method="post" action="/admin/personal" style="display:inline">
            <input type="hidden" name="do" value="${m.active ? 'off' : 'on'}">
            <input type="hidden" name="id" value="${esc(m.id)}">
            <button class="btn sm danger" type="submit">${m.active ? 'Ausgeschieden' : 'Wieder aktiv'}</button>
          </form>
        </div>
      </td></tr>`;
  };

  const aktive = leute.filter(m => m.active);

  const body = `
    <h1>Personal</h1>
    <p class="sub">Wer im Haus arbeitet und mit welcher PIN gestempelt wird.
       Die Arbeitszeiten stehen unter <a href="/admin/arbeitszeit">Arbeitszeit</a>.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="stats">
      <div class="stat"><b>${aktive.length}</b><span>im Team</span></div>
      <div class="stat hot"><b>${offen.length}</b><span>gerade im Dienst</span></div>
      <div class="stat"><b>${aktive.filter(m => !m.pin_hash).length}</b><span>ohne PIN</span></div>
    </div>

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/stempel">Stempeluhr öffnen</a>
      <a class="btn ghost" href="/admin/arbeitszeit">Arbeitszeiten</a>
    </div>

    <div class="card">
      <h2>Mitarbeiter anlegen</h2>
      <div class="body">
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="add">
          <div class="grid">
            <div class="f"><label for="nn">Name</label>
              <input id="nn" name="name" maxlength="60" placeholder="Vorname Nachname" required></div>
            <div class="f"><label for="nr">Bereich</label>
              <select id="nr" name="role">${rollen('Service')}</select></div>
            ${lohnSpalte ? `<div class="f"><label for="nw">Stundenlohn €</label>
              <input id="nw" name="wage" inputmode="decimal" maxlength="9"
                     placeholder="z. B. 14,50"></div>` : ''}
            <div class="f"><label for="np">PIN (vier Ziffern)</label>
              <input id="np" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"
                     placeholder="leer = wird erzeugt"></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn" type="submit">Anlegen</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Team <em>${leute.length} ${leute.length === 1 ? 'Person' : 'Personen'}</em></h2>
      ${leute.length ? `<table><tbody>${leute.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">Noch niemand angelegt.</div>'}
    </div>

    <div class="card">
      <h2>Chef-PIN <em>schützt Löhne und Personaldaten</em></h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Damit die Stempeluhr läuft, bleibt das Küchentablet
           dauerhaft angemeldet. Ohne eine zweite Sperre kann dort jeder auf „Personal" tippen und
           die Stundenlöhne der Kollegen lesen. Mit PIN fragt das Panel vor <b>Personal</b>,
           <b>Arbeitszeit</b>, <b>Stundennachweis</b>, <b>Trinkgeld</b> und <b>Benutzer</b> nach —
           danach ist ${DAUER_MIN} Minuten offen. Die Stempeluhr bleibt frei, sonst kann das Team
           nicht mehr stempeln.</p>
        <form method="post" action="/admin/personal" class="grid">
          <input type="hidden" name="do" value="chefpin">
          <div class="f"><label for="cp">${chefPinGesetzt ? 'Neue Chef-PIN' : 'Chef-PIN vergeben'}</label>
            <input id="cp" name="chefpin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6"
                   placeholder="${chefPinGesetzt ? 'gesetzt — leer lassen ändert nichts' : 'vier bis sechs Ziffern'}"></div>
          <div class="f" style="display:flex;align-items:flex-end;gap:.5rem">
            <button class="btn" type="submit">Speichern</button>
            ${chefPinGesetzt ? `<button class="btn ghost" type="submit" name="do" value="chefpin-weg"
                 onclick="return confirm('Chef-PIN entfernen? Danach kommt jeder am Tablet an die Löhne.')"
               >Entfernen</button>` : ''}
          </div>
        </form>
        ${chefPinGesetzt ? `<p class="hint" style="margin:1rem 0 0">Nach fünf Fehlversuchen ist die
           Eingabe zehn Minuten gesperrt. <b>Vergessen?</b> Die PIN lässt sich nicht auslesen —
           dann muss Hasi Elektronic sie in der Datenbank zurücksetzen.</p>` : ''}
      </div>
    </div>

    <div class="card">
      <h2>Wichtig</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Aufzeichnungspflicht:</b> In der Gastronomie müssen
           Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens sieben Tage später
           festgehalten und zwei Jahre aufbewahrt werden (§ 17 Mindestlohngesetz). Genau dafür
           ist diese Erfassung da. Bei einer Prüfung durch den Zoll zählt, was hier steht.</p>
        <p style="margin:0 0 .6rem"><b>„Ausgeschieden"</b> nimmt jemanden aus der Stempeluhr,
           die bisherigen Zeiten bleiben erhalten — sie müssen aufbewahrt werden. Deshalb gibt
           es hier bewusst kein Löschen.</p>
        <p style="margin:0 0 .6rem"><b>Die PIN</b> wird nur verschlüsselt gespeichert und lässt sich
           nicht wieder anzeigen. Vergessen? Einfach eine neue vergeben.</p>
        <p style="margin:0"><b>Der Lohnbetrag ist eine Schätzung, keine Abrechnung.</b> Gerechnet wird
           Stunden mal Stundenlohn — <b>brutto</b>, ohne Steuern, ohne Sozialabgaben, ohne Zuschläge
           für Sonntag und Nacht. Was am Ende ausgezahlt wird, rechnet der Steuerberater.
           Der Mindestlohn liegt 2026 bei ${euro(MINDESTLOHN_CENT)} €, die Minijob-Grenze bei
           ${euro(MINIJOB_CENT)} € im Monat — beides prüft das Panel und warnt, mehr nicht.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Personal', active: '/admin/personal', body });
}

export async function onRequestPost({ request, env, data }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const fehler = m => redirect('/admin/personal?err=' + encodeURIComponent(m));
  if (!db) return fehler('Keine Datenbankverbindung.');

  const id   = clean(d.id, 40);
  const name = clean(d.name, 60);
  const role = ROLLEN.includes(clean(d.role, 20)) ? clean(d.role, 20) : null;
  const pin  = clean(d.pin, 8).replace(/\D/g, '');
  const sort = parseInt(d.sort, 10);
  const wage = 'wage' in d ? centAus(d.wage) : undefined;   // undefined = Feld war nicht dabei

  if (pin && pin.length !== 4) return fehler('Die PIN muss aus genau vier Ziffern bestehen.');
  if ('wage' in d && String(d.wage || '').trim() && wage === null) {
    return fehler('Stundenlohn bitte als Zahl angeben, z. B. 14,50.');
  }

  /* --- Chef-PIN --- */
  if (d.do === 'chefpin' || d.do === 'chefpin-weg') {
    try {
      if (d.do === 'chefpin-weg') {
        await loeschePin(db);
        return new Response(null, { status: 303, headers: {
          location: '/admin/personal?ok=' + encodeURIComponent('Chef-PIN entfernt. Die Geldseiten sind wieder ohne zweite Abfrage erreichbar.'),
          'set-cookie': sperrCookie(), 'cache-control': 'no-store' } });
      }
      const neu = clean(d.chefpin, 8).replace(/\D/g, '');
      if (neu.length < 4 || neu.length > 6) {
        return fehler('Die Chef-PIN braucht vier bis sechs Ziffern.');
      }
      await setzePin(db, neu, env);
      return geheimnis({
        user: data?.user, titel: 'Chef-PIN gesetzt',
        zeilen: [['Chef-PIN', neu]],
        hinweis: 'Gilt ab sofort für Personal, Arbeitszeit, Stundennachweis, Trinkgeld und Benutzer. '
               + 'Sie wird nur verschlüsselt gespeichert und lässt sich nicht wieder anzeigen — '
               + 'am besten jetzt notieren.',
        zurueck: '/admin/personal',
      });
    } catch {
      return fehler('Die Chef-PIN konnte nicht gespeichert werden.');
    }
  }

  try {
    if (d.do === 'add') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      const neu = pin || String(Math.floor(1000 + Math.random() * 9000));
      const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) m FROM staff`).first();
      const nid = crypto.randomUUID();
      const hash = await pinHash(neu, env.IP_SALT);
      const srt = (Number(max?.m) || 0) + 10;
      const jetzt = new Date().toISOString();
      try {
        await db.prepare(
          `INSERT INTO staff (id,name,role,pin_hash,active,sort,created_at,wage_cent)
           VALUES (?,?,?,?,1,?,?,?)`
        ).bind(nid, name, role, hash, srt, jetzt, wage ?? null).run();
      } catch {
        // Migration 0010 fehlt noch — dann ohne Lohnspalte anlegen.
        await db.prepare(
          `INSERT INTO staff (id,name,role,pin_hash,active,sort,created_at) VALUES (?,?,?,?,1,?,?)`
        ).bind(nid, name, role, hash, srt, jetzt).run();
      }
      return geheimnis({
        user: data?.user, titel: `${name} ist angelegt`,
        zeilen: [['Name', name], ['PIN für die Stempeluhr', neu]],
        hinweis: 'Die PIN wird verschlüsselt gespeichert und lässt sich nicht wieder anzeigen. '
               + 'Vergessen? Einfach eine neue vergeben.',
        zurueck: '/admin/personal',
      });
    }

    if (!id) return fehler('Mitarbeiter nicht gefunden.');

    if (d.do === 'save') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      const srt = Number.isFinite(sort) ? sort : 0;
      /* Leeres Lohnfeld heißt „kein Stundenlohn hinterlegt", nicht „0 €". */
      if (wage !== undefined) {
        try {
          await db.prepare(`UPDATE staff SET wage_cent=? WHERE id=?`).bind(wage, id).run();
        } catch { /* Spalte fehlt noch */ }
      }
      if (pin) {
        await db.prepare(`UPDATE staff SET name=?, role=?, sort=?, pin_hash=? WHERE id=?`)
          .bind(name, role, srt, await pinHash(pin, env.IP_SALT), id).run();
        return geheimnis({
          user: data?.user, titel: `${name}: neue PIN`,
          zeilen: [['Name', name], ['PIN für die Stempeluhr', pin]],
          hinweis: 'Die bisherige PIN gilt nicht mehr.',
          zurueck: '/admin/personal',
        });
      }
      await db.prepare(`UPDATE staff SET name=?, role=?, sort=? WHERE id=?`)
        .bind(name, role, srt, id).run();
      const warnung = wage && wage < MINDESTLOHN_CENT
        ? ` Achtung: ${euro(wage)} € liegt unter dem Mindestlohn von ${euro(MINDESTLOHN_CENT)} €.` : '';
      return redirect('/admin/personal', `${name} gespeichert.${warnung}`);
    }

    if (d.do === 'on' || d.do === 'off') {
      const an = d.do === 'on' ? 1 : 0;
      const m = await db.prepare(`SELECT name FROM staff WHERE id=?`).bind(id).first();
      await db.prepare(`UPDATE staff SET active=? WHERE id=?`).bind(an, id).run();

      /* Läuft noch eine Schicht, muss der Chef sie von Hand abschließen. Ein Ende zu
         erfinden wäre eine Fälschung der Aufzeichnung — also lieber deutlich sagen. */
      let offenerHinweis = '';
      if (!an) {
        try {
          const o = await db.prepare(
            `SELECT work_date FROM shifts WHERE staff_id=? AND end_at IS NULL LIMIT 1`)
            .bind(id).first();
          if (o) offenerHinweis = ' Achtung: Es läuft noch eine Schicht vom '
            + `${o.work_date.slice(8)}.${o.work_date.slice(5, 7)}. — bitte unter „Arbeitszeit" das Ende eintragen.`;
        } catch { /* egal */ }
      }
      return redirect('/admin/personal', an
        ? `${m?.name || 'Mitarbeiter'} ist wieder aktiv.`
        : `${m?.name || 'Mitarbeiter'} ist ausgeschieden. Die Zeiten bleiben gespeichert.${offenerHinweis}`);
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect('/admin/personal');
}
