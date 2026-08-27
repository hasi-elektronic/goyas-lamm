/**
 * Trinkgeld — der Topf eines Abends, aufgeteilt nach gearbeiteten Stunden.
 *
 * Gökhan trägt je Abend eine Summe ein; das Panel teilt sie nach den (gerundeten)
 * Arbeitsminuten dieses Tages auf. Gerechnet wird erst bei der Anzeige — gespeichert
 * ist nur die Summe. Ändert sich später eine Schicht, stimmt die Aufteilung dadurch
 * automatisch wieder.
 *
 * Steuerlich ist der Unterschied wichtig, und er ist **nicht** unsere Entscheidung:
 * Trinkgeld, das der Gast einem Mitarbeiter direkt gibt, ist nach § 3 Nr. 51 EStG
 * steuerfrei. Geht es dagegen erst an das Haus und wird von dort verteilt (Tronc),
 * kann es steuerpflichtiger Arbeitslohn sein. Diese Seite bildet den zweiten Fall ab,
 * also gehört die Liste zum Steuerberater. Der Hinweis steht auch auf der Seite.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import {
  istMonat, monatLabel, monatVerschieben, tagKurz, nettoGerundet, dezimal,
  centAus, euro, verteileTrinkgeld,
} from '../_lib/zeit.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const monat = istMonat(url.searchParams.get('m'))
    ? url.searchParams.get('m') : nowBerlin().date.slice(0, 7);

  let schichten = [], toepfe = [], leute = [];
  let fehler = '';
  try {
    schichten = (await db.prepare(
      `SELECT staff_id, work_date, start_at, end_at, break_min FROM shifts
        WHERE work_date LIKE ? ORDER BY work_date, start_at`).bind(monat + '%').all()).results || [];
    leute = (await db.prepare(`SELECT id, name FROM staff`).all()).results || [];
  } catch {
    fehler = 'Die Tabelle „shifts" fehlt noch — bitte Migration 0007_zeit.sql einspielen.';
  }
  try {
    toepfe = (await db.prepare(
      `SELECT day, amount_cent, note FROM tips WHERE day LIKE ?`).bind(monat + '%').all()).results || [];
  } catch {
    fehler = fehler || 'Die Tabelle „tips" fehlt noch — bitte Migration 0010_lohn.sql einspielen.';
  }

  const name = Object.fromEntries(leute.map(l => [l.id, l.name]));
  const topf = Object.fromEntries(toepfe.map(t => [t.day, t]));

  /* Minuten je Tag und Person */
  const proTag = {};
  for (const s of schichten) {
    const m = nettoGerundet(s);
    if (m === null) continue;                      // offene Schicht zählt nicht mit
    (proTag[s.work_date] ||= {});
    proTag[s.work_date][s.staff_id] = (proTag[s.work_date][s.staff_id] || 0) + m;
  }

  const tage = [...new Set([...Object.keys(proTag), ...Object.keys(topf)])].sort();
  const gesamtCent = toepfe.reduce((s, t) => s + (t.amount_cent || 0), 0);

  /* Monatssumme je Person */
  const proPerson = {};
  for (const tag of tage) {
    const t = topf[tag];
    if (!t?.amount_cent) continue;
    const leuteTag = Object.entries(proTag[tag] || {}).map(([id, minuten]) => ({ id, minuten }));
    const anteil = verteileTrinkgeld(t.amount_cent, leuteTag);
    for (const [id, cent] of Object.entries(anteil)) proPerson[id] = (proPerson[id] || 0) + cent;
  }

  const zeile = tag => {
    const t = topf[tag];
    const leuteTag = Object.entries(proTag[tag] || {}).map(([id, minuten]) => ({ id, minuten }))
      .sort((a, b) => b.minuten - a.minuten);
    const anteil = t?.amount_cent ? verteileTrinkgeld(t.amount_cent, leuteTag) : {};
    return `<tr>
      <td colspan="3" style="padding:0">
        <form method="post" action="/admin/trinkgeld" class="trow">
          <input type="hidden" name="do" value="save">
          <input type="hidden" name="m" value="${esc(monat)}">
          <input type="hidden" name="day" value="${esc(tag)}">
          <div class="f"><label>Abend</label>
            <div style="padding:.55rem 0;font-weight:600">${esc(tagKurz(tag))}</div></div>
          <div class="f"><label for="t-${esc(tag)}">Topf €</label>
            <input id="t-${esc(tag)}" name="amount" inputmode="decimal" maxlength="10"
                   value="${t?.amount_cent ? esc(euro(t.amount_cent)) : ''}" placeholder="z. B. 84,50"></div>
          <div class="f"><label for="n-${esc(tag)}">Notiz</label>
            <input id="n-${esc(tag)}" name="note" maxlength="80"
                   value="${esc(t?.note || '')}" placeholder="optional"></div>
          <div class="trow-act"><button class="btn sm" type="submit">Speichern</button></div>
        </form>
        <div class="trow-sub">
          ${leuteTag.length
            ? leuteTag.map(p => `<span class="meta">${esc(name[p.id] || 'Unbekannt')}
                 ${dezimal(p.minuten)} h${t?.amount_cent
                   ? ` → <b>${euro(anteil[p.id] || 0)} €</b>` : ''}</span>`).join(' · ')
            : '<span class="meta">An diesem Tag ist keine abgeschlossene Schicht erfasst — es gibt niemanden zu beteiligen.</span>'}
        </div>
      </td></tr>`;
  };

  const personenListe = Object.entries(proPerson)
    .sort((a, b) => b[1] - a[1])
    .map(([id, cent]) => `<div class="stat"><b>${euro(cent)} €</b><span>${esc(name[id] || 'Unbekannt')}</span></div>`)
    .join('');

  const body = `
    <h1>Trinkgeld</h1>
    <p class="sub">${esc(monatLabel(monat))} — der Topf eines Abends, aufgeteilt nach den
       gearbeiteten Stunden dieses Abends.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="/admin/trinkgeld?m=${monatVerschieben(monat, -1)}">← ${esc(monatLabel(monatVerschieben(monat, -1)).split(' ')[0])}</a>
      <a class="btn ghost" href="/admin/trinkgeld">Aktueller Monat</a>
      <a class="btn ghost" href="/admin/trinkgeld?m=${monatVerschieben(monat, 1)}">${esc(monatLabel(monatVerschieben(monat, 1)).split(' ')[0])} →</a>
      <a class="btn ghost" href="/admin/arbeitszeit?m=${esc(monat)}">Arbeitszeit</a>
    </div>

    <div class="stats">
      <div class="stat hot"><b>${euro(gesamtCent)} €</b><span>im Monat</span></div>
      <div class="stat"><b>${toepfe.filter(t => t.amount_cent).length}</b><span>Abende erfasst</span></div>
      <div class="stat"><b>${tage.length}</b><span>Abende mit Dienst</span></div>
    </div>

    ${personenListe ? `<div class="card">
      <h2>Anteile im Monat</h2>
      <div class="body"><div class="stats" style="margin-bottom:0">${personenListe}</div></div>
    </div>` : ''}

    <div class="card">
      <h2>Abende <em>Topf je Abend eintragen</em></h2>
      ${tage.length ? `<table><tbody>${tage.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">In diesem Monat sind noch keine Schichten erfasst.</div>'}
    </div>

    <div class="card">
      <h2>Wie geteilt wird — und was der Steuerberater wissen muss</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Nach Stunden, nicht nach Köpfen.</b> Wer an dem Abend
           doppelt so lange da war, bekommt doppelt so viel. Gerechnet wird mit den gerundeten
           Arbeitszeiten; die paar Cent Rundungsrest gehen an den, der am längsten da war, damit
           die Summe der Anteile genau dem Topf entspricht.</p>
        <p style="margin:0 0 .6rem"><b>Offene Schichten zählen nicht mit.</b> Wer den Feierabend
           vergessen hat, ist bei der Aufteilung nicht dabei — erst das Ende unter „Arbeitszeit"
           nachtragen, dann stimmt der Abend wieder.</p>
        <p style="margin:0 0 .6rem">Gespeichert wird nur die Summe des Abends. Die Aufteilung wird
           jedes Mal neu gerechnet — ändert sich später eine Schicht, stimmt sie automatisch wieder.</p>
        <p style="margin:0"><b>Steuerlich ist das kein Nebenschauplatz.</b> Trinkgeld, das ein Gast
           einem Mitarbeiter <b>direkt</b> gibt, ist nach § 3 Nr. 51 EStG steuerfrei. Was dagegen
           erst ins Haus geht und von dort verteilt wird — also genau das, was diese Seite abbildet —
           kann steuerpflichtiger Arbeitslohn sein. Diese Liste gehört deshalb zum Steuerberater;
           das Panel entscheidet die Frage nicht und rechnet keine Abgaben.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Trinkgeld', active: '/admin/trinkgeld', body });
}

export async function onRequestPost({ request, env }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const monat = istMonat(clean(d.m, 7)) ? clean(d.m, 7) : nowBerlin().date.slice(0, 7);
  const zurueck = `/admin/trinkgeld?m=${monat}`;
  const fehler = m => redirect(`${zurueck}&err=${encodeURIComponent(m)}`);
  if (!db) return fehler('Keine Datenbankverbindung.');

  const day = clean(d.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fehler('Kein gültiger Tag.');

  const roh = String(d.amount ?? '').trim();
  const note = clean(d.note, 80) || null;

  try {
    if (!roh) {
      await db.prepare(`DELETE FROM tips WHERE day = ?`).bind(day).run();
      return redirect(zurueck, `${tagKurz(day)} — Eintrag entfernt.`);
    }
    const cent = centAus(roh);
    if (cent === null) return fehler('Betrag bitte als Zahl angeben, z. B. 84,50.');
    await db.prepare(
      `INSERT INTO tips (day, amount_cent, note, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(day) DO UPDATE SET amount_cent = excluded.amount_cent,
                                      note = excluded.note,
                                      updated_at = excluded.updated_at`)
      .bind(day, cent, note, new Date().toISOString()).run();
    return redirect(zurueck, `${tagKurz(day)} — ${euro(cent)} € gespeichert.`);
  } catch {
    return fehler('Das hat nicht geklappt. Fehlt die Migration 0010_lohn.sql?');
  }
}
