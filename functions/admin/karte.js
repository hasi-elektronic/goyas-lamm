/**
 * Speisekarten-Editor.
 * Ein Reiter je Karten-Reiter, darin Gruppen und Gerichte. Alles wird
 * serverseitig gerendert und per normalem Formular gespeichert — kein
 * JavaScript nötig, funktioniert auch auf dem Küchen-Tablet.
 */
import { clean, esc, jsq } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { loadKarte, zaehle } from '../_lib/karte.js';

const num = (v, min, max, dflt = null) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};

const slug = v => clean(v, 40).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);

const id = () => crypto.randomUUID();

/* ------------------------------------------------------------------ */
/* Anzeige                                                             */
/* ------------------------------------------------------------------ */

function gerichtZeile(i) {
  return `<tr class="${i.active ? '' : 'cancelled'}">
    <td colspan="4" style="padding:0">
      <form method="post" action="/admin/karte" class="irow">
        <input type="hidden" name="do" value="item-save">
        <input type="hidden" name="id" value="${esc(i.id)}">
        <div class="f"><label for="n-${esc(i.id)}">Gericht</label>
          <input id="n-${esc(i.id)}" name="name" value="${esc(i.name)}" maxlength="90" required></div>
        <div class="f"><label for="b-${esc(i.id)}">Beschreibung</label>
          <input id="b-${esc(i.id)}" name="descr" value="${esc(i.descr || '')}" maxlength="200"></div>
        <div class="f"><label for="p-${esc(i.id)}">Preis</label>
          <input id="p-${esc(i.id)}" name="price" value="${esc(String(i.price || '').replace(/\n/g, ' | '))}" maxlength="90"></div>
        <div class="f"><label for="s-${esc(i.id)}">Nr.</label>
          <input id="s-${esc(i.id)}" name="sort" type="number" min="0" max="999" value="${esc(String(i.sort))}"></div>
        <div class="irow-act"><button class="btn sm" type="submit">Speichern</button></div>
      </form>
      <div class="irow-sub">
        <form method="post" action="/admin/karte" style="display:inline">
          <input type="hidden" name="do" value="${i.active ? 'item-off' : 'item-on'}">
          <input type="hidden" name="id" value="${esc(i.id)}">
          <button class="btn sm danger" type="submit">
            ${i.active ? 'Heute nicht verfügbar' : 'Wieder anbieten'}</button></form>
        <form method="post" action="/admin/karte" style="display:inline">
          <input type="hidden" name="do" value="${i.highlight ? 'schau-aus' : 'schau-an'}">
          <input type="hidden" name="id" value="${esc(i.id)}">
          <button class="btn sm ${i.highlight ? '' : 'ghost'}" type="submit"
            title="Steht auf der Startseite in der Auswahl">
            ${i.highlight ? '★ Im Schaufenster' : '☆ Ins Schaufenster'}</button></form>
        <form method="post" action="/admin/karte" style="display:inline"
              onsubmit="return confirm('Gericht ' + ${jsq(i.name)} + ' endgültig löschen?')">
          <input type="hidden" name="do" value="item-del">
          <input type="hidden" name="id" value="${esc(i.id)}">
          <button class="btn sm danger" type="submit">Löschen</button></form>
        ${i.active ? '' : '<span class="pill">steht nicht auf der Website</span>'}
      </div>
    </td></tr>`;
}

function gruppeCard(g) {
  return `<div class="card">
    <h2>${esc(g.title)} <em>${g.items.length} ${g.items.length === 1 ? 'Gericht' : 'Gerichte'}</em></h2>
    <div class="body" style="padding-bottom:.4rem">
      <form method="post" action="/admin/karte">
        <input type="hidden" name="do" value="group-save">
        <input type="hidden" name="id" value="${esc(g.id)}">
        <div class="grid">
          <div class="f"><label for="gt-${esc(g.id)}">Überschrift der Gruppe</label>
            <input id="gt-${esc(g.id)}" name="title" value="${esc(g.title)}" maxlength="80" required></div>
          <div class="f"><label for="gn-${esc(g.id)}">Hinweis darunter</label>
            <input id="gn-${esc(g.id)}" name="note" value="${esc(g.note || '')}" maxlength="200"
                   placeholder="z. B. Pasta wählbar zwischen Spaghetti, Penne und Rigatoni."></div>
          <div class="f"><label for="gs-${esc(g.id)}">Nr.</label>
            <input id="gs-${esc(g.id)}" name="sort" type="number" min="0" max="999" value="${esc(String(g.sort))}"></div>
          <div class="f" style="display:flex;align-items:flex-end;gap:.4rem">
            <button class="btn sm" type="submit">Speichern</button>
          </div>
        </div>
      </form>
    </div>
    ${g.items.length ? `<table><tbody>${g.items.map(gerichtZeile).join('')}</tbody></table>`
      : '<div class="empty">Noch kein Gericht in dieser Gruppe.</div>'}
    <div class="body">
      <form method="post" action="/admin/karte">
        <input type="hidden" name="do" value="item-add">
        <input type="hidden" name="group" value="${esc(g.id)}">
        <div class="grid">
          <div class="f"><label for="an-${esc(g.id)}">Neues Gericht</label>
            <input id="an-${esc(g.id)}" name="name" maxlength="90" placeholder="Name" required></div>
          <div class="f"><label for="ab-${esc(g.id)}">Beschreibung</label>
            <input id="ab-${esc(g.id)}" name="descr" maxlength="200" placeholder="optional"></div>
          <div class="f"><label for="ap-${esc(g.id)}">Preis</label>
            <input id="ap-${esc(g.id)}" name="price" maxlength="90" placeholder="12,50 €"></div>
          <div class="f" style="display:flex;align-items:flex-end">
            <button class="btn ghost" type="submit">Hinzufügen</button></div>
        </div>
      </form>
      <div class="row" style="margin-top:.8rem">
        <form method="post" action="/admin/karte" style="display:inline"
              onsubmit="return confirm('Gruppe ' + ${jsq(g.title)} + ' mit allen ${g.items.length} Gerichten löschen?')">
          <input type="hidden" name="do" value="group-del">
          <input type="hidden" name="id" value="${esc(g.id)}">
          <button class="btn sm danger" type="submit">Ganze Gruppe löschen</button>
        </form>
      </div>
    </div>
  </div>`;
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const karte = await loadKarte(db, { nurAktive: false });

  if (!karte) {
    return layout({
      user: data?.user, title: 'Speisekarte', active: '/admin/karte',
      body: `<h1>Speisekarte</h1>
        <div class="msg err">Die Karte liegt noch nicht in der Datenbank.
        Bitte die Migrationen <code>0005_karte.sql</code> und <code>0006_karte_seed.sql</code>
        einspielen — danach steht hier die vollständige Karte zum Bearbeiten.</div>
        <p class="meta">Solange zeigt die Website die fest eingebaute Karte. Es geht also
        nichts verloren.</p>`,
    });
  }

  const z = zaehle(karte);
  const aktiv = url.searchParams.get('t');
  const tab = karte.find(t => t.id === aktiv) || karte[0];

  const reiter = karte.map(t => `<a href="/admin/karte?t=${encodeURIComponent(t.id)}"
      class="ktab ${t.id === tab.id ? 'on' : ''}">${esc(t.title)}
      <span>${t.groups.reduce((s, g) => s + g.items.length, 0)}</span></a>`).join('');

  const stand = (await db.prepare(`SELECT v FROM settings WHERE k='karte_stand'`)
    .first().catch(() => null))?.v || '';

  const body = `
    <h1>Speisekarte</h1>
    <p class="sub">Was hier steht, steht auf der Website. Änderungen sind nach spätestens
       einer Minute für alle sichtbar.</p>
    ${flash(url)}

    <div class="stats">
      <div class="stat"><b>${z.tabs}</b><span>Reiter</span></div>
      <div class="stat"><b>${z.gruppen}</b><span>Gruppen</span></div>
      <div class="stat hot"><b>${z.items - z.aus}</b><span>Gerichte online</span></div>
      <div class="stat"><b>${z.aus}</b><span>nicht verfügbar</span></div>
    </div>

    <div class="ktabs">${reiter}</div>

    <div class="card">
      <h2>Reiter „${esc(tab.title)}"</h2>
      <div class="body">
        <form method="post" action="/admin/karte">
          <input type="hidden" name="do" value="tab-save">
          <input type="hidden" name="id" value="${esc(tab.id)}">
          <div class="grid">
            <div class="f"><label for="tt">Beschriftung</label>
              <input id="tt" name="title" value="${esc(tab.title)}" maxlength="60" required></div>
            <div class="f"><label for="tc">Layout</label>
              <select id="tc" name="cols">
                <option value="1" ${tab.cols === 1 ? 'selected' : ''}>einspaltig (Speisen)</option>
                <option value="2" ${tab.cols === 2 ? 'selected' : ''}>zweispaltig (Getränke)</option>
              </select></div>
            <div class="f"><label for="ts">Nr.</label>
              <input id="ts" name="sort" type="number" min="0" max="999" value="${esc(String(tab.sort))}"></div>
            <div class="f" style="display:flex;align-items:flex-end;gap:.4rem">
              <button class="btn sm" type="submit">Speichern</button>
            </div>
          </div>
        </form>
        <div class="row" style="margin-top:.9rem">
          <form method="post" action="/admin/karte" style="display:inline">
            <input type="hidden" name="do" value="group-add">
            <input type="hidden" name="tab" value="${esc(tab.id)}">
            <div class="row">
              <input name="title" maxlength="80" placeholder="Neue Gruppe, z. B. „Tagesempfehlung“" required
                     style="font:inherit;padding:.6rem .8rem;border:1px solid var(--sand);border-radius:2px;min-width:min(100%,300px)">
              <button class="btn ghost sm" type="submit">Gruppe anlegen</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    ${tab.groups.length ? tab.groups.map(gruppeCard).join('')
      : '<div class="card"><div class="empty">In diesem Reiter gibt es noch keine Gruppe.</div></div>'}

    <div class="card">
      <h2>Fußzeile der Karte</h2>
      <div class="body">
        <form method="post" action="/admin/karte">
          <input type="hidden" name="do" value="stand">
          <div class="grid">
            <div class="f"><label for="st">Stand der Karte</label>
              <input id="st" name="stand" value="${esc(stand)}" maxlength="40" placeholder="August 2026">
              <p class="hint">Erscheint unten auf der Website: „Änderungen und Druckfehler
                 vorbehalten. Stand der Karte: …"</p></div>
            <div class="f" style="display:flex;align-items:flex-end">
              <button class="btn sm" type="submit">Speichern</button></div>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Gut zu wissen</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>„Heute nicht verfügbar"</b> nimmt ein Gericht von der
           Website, lässt es hier aber stehen — für Dorade, die nicht geliefert wurde.
           Ein Klick, und sie ist wieder da. <b>Löschen</b> ist endgültig.</p>
        <p style="margin:0 0 .6rem"><b>Die Nummer</b> bestimmt die Reihenfolge, kleinere Zahl
           steht oben. In 10er-Schritten vergeben — dann passt später immer noch etwas dazwischen.</p>
        <p style="margin:0 0 .6rem"><b>Preis</b> ist ein freies Textfeld: „12,50 €",
           „6,00 – 10,00 €" oder leer. Für Staffelpreise wie beim Steak die Zeilen mit einem
           senkrechten Strich trennen: <code>200 g 22,00 € | 300 g 29,00 €</code>.</p>
        <p style="margin:0"><b>★ Im Schaufenster</b> heißt: Das Gericht steht auf der
           Startseite in der Auswahl unter „Unsere Karte". Die vollständige Karte liegt
           seit August 2026 auf einer eigenen Seite (<a href="/karte" target="_blank"
           rel="noopener">/karte</a>, dieselbe, die der QR-Code am Tisch öffnet). Zwölf
           Gerichte füllen das Raster auf der Startseite genau aus — wer eins dazunimmt,
           sollte ein anderes herausnehmen. Ein Gericht auf „heute nicht verfügbar"
           verschwindet auch aus dem Schaufenster und kommt von allein zurück.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Speisekarte', active: '/admin/karte', body });
}

/* ------------------------------------------------------------------ */
/* Speichern                                                           */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const zurueck = t => `/admin/karte${t ? '?t=' + encodeURIComponent(t) : ''}`;
  const fehler = (m, t) => redirect(zurueck(t) + (t ? '&' : '?') + 'err=' + encodeURIComponent(m));
  if (!db) return fehler('Keine Datenbankverbindung.');

  const rid   = clean(d.id, 40);
  const name  = clean(d.name, 90);
  const title = clean(d.title, 80);
  /* „|" trennt Zeilen — so lassen sich Staffelpreise in einem Feld eingeben */
  const price = clean(d.price, 90).split('|').map(x => x.trim()).filter(Boolean).join('\n');
  const descr = clean(d.descr, 200);
  const sort  = num(d.sort, 0, 999, 0);

  const tabVon = async (gid) => (await db.prepare(
    `SELECT tab_id FROM menu_groups WHERE id=?`).bind(gid).first())?.tab_id || null;

  try {
    switch (d.do) {
      case 'tab-save': {
        if (!title) return fehler('Bitte eine Beschriftung angeben.', rid);
        await db.prepare(`UPDATE menu_tabs SET title=?, cols=?, sort=? WHERE id=?`)
          .bind(title, num(d.cols, 1, 2, 1), sort, rid).run();
        return redirect(zurueck(rid), 'Reiter gespeichert.');
      }

      case 'group-add': {
        const tab = clean(d.tab, 40);
        if (!title) return fehler('Bitte einen Namen für die Gruppe angeben.', tab);
        const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) m FROM menu_groups WHERE tab_id=?`)
          .bind(tab).first();
        await db.prepare(
          `INSERT INTO menu_groups (id,tab_id,title,note,sort,active) VALUES (?,?,?,NULL,?,1)`
        ).bind(`${slug(title) || 'gruppe'}-${id().slice(0, 6)}`, tab, title,
               (Number(max?.m) || 0) + 10).run();
        return redirect(zurueck(tab), `Gruppe „${title}" angelegt.`);
      }

      case 'group-save': {
        const tab = await tabVon(rid);
        if (!title) return fehler('Bitte einen Namen für die Gruppe angeben.', tab);
        await db.prepare(`UPDATE menu_groups SET title=?, note=?, sort=? WHERE id=?`)
          .bind(title, clean(d.note, 200) || null, sort, rid).run();
        return redirect(zurueck(tab), 'Gruppe gespeichert.');
      }

      case 'group-del': {
        const tab = await tabVon(rid);
        await db.batch([
          db.prepare(`DELETE FROM menu_items WHERE group_id=?`).bind(rid),
          db.prepare(`DELETE FROM menu_groups WHERE id=?`).bind(rid),
        ]);
        return redirect(zurueck(tab), 'Gruppe gelöscht.');
      }

      case 'item-add': {
        const gid = clean(d.group, 40);
        const tab = await tabVon(gid);
        if (!name) return fehler('Bitte einen Namen für das Gericht angeben.', tab);
        const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) m FROM menu_items WHERE group_id=?`)
          .bind(gid).first();
        await db.prepare(
          `INSERT INTO menu_items (id,group_id,name,descr,price,sort,active) VALUES (?,?,?,?,?,?,1)`
        ).bind(id(), gid, name, descr || null, price || null, (Number(max?.m) || 0) + 10).run();
        return redirect(zurueck(tab), `„${name}" hinzugefügt.`);
      }

      case 'item-save': {
        const row = await db.prepare(`SELECT group_id FROM menu_items WHERE id=?`).bind(rid).first();
        const tab = row ? await tabVon(row.group_id) : null;
        if (!name) return fehler('Bitte einen Namen für das Gericht angeben.', tab);
        await db.prepare(`UPDATE menu_items SET name=?, descr=?, price=?, sort=? WHERE id=?`)
          .bind(name, descr || null, price || null, sort, rid).run();
        return redirect(zurueck(tab), `„${name}" gespeichert.`);
      }

      /* Schaufenster: Was auf der Startseite steht. Bewusst hier und nicht in
         einer Liste im Quelltext — die Auswahl ändert sich mit der Saison, und
         dafür soll niemand anrufen müssen. */
      case 'schau-an':
      case 'schau-aus': {
        const an = d.do === 'schau-an' ? 1 : 0;
        const t = await tabVon((await db.prepare(
          `SELECT group_id FROM menu_items WHERE id=?`).bind(rid).first())?.group_id);
        await db.prepare(`UPDATE menu_items SET highlight=? WHERE id=?`).bind(an, rid).run();
        return redirect(zurueck(t), an
          ? 'Steht jetzt auf der Startseite.'
          : 'Von der Startseite genommen.');
      }

      case 'item-on':
      case 'item-off': {
        const row = await db.prepare(`SELECT group_id,name FROM menu_items WHERE id=?`).bind(rid).first();
        const tab = row ? await tabVon(row.group_id) : null;
        const an = d.do === 'item-on' ? 1 : 0;
        await db.prepare(`UPDATE menu_items SET active=? WHERE id=?`).bind(an, rid).run();
        return redirect(zurueck(tab), an
          ? `„${row?.name || 'Gericht'}" steht wieder auf der Karte.`
          : `„${row?.name || 'Gericht'}" ist von der Website genommen.`);
      }

      case 'item-del': {
        const row = await db.prepare(`SELECT group_id,name FROM menu_items WHERE id=?`).bind(rid).first();
        const tab = row ? await tabVon(row.group_id) : null;
        await db.prepare(`DELETE FROM menu_items WHERE id=?`).bind(rid).run();
        return redirect(zurueck(tab), `„${row?.name || 'Gericht'}" gelöscht.`);
      }

      case 'stand': {
        const v = clean(d.stand, 40);
        await db.prepare(
          `INSERT INTO settings (k,v) VALUES ('karte_stand',?)
           ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(v || null).run();
        return redirect(zurueck(), 'Fußzeile gespeichert.');
      }
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect(zurueck());
}
