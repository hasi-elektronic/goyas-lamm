/**
 * Privatkasse — Gökhans eigenes Haushaltsbuch.
 *
 * ── Warum es das gibt ─────────────────────────────────────────────────
 * Gökhan hat ausdrücklich um eine Stelle gebeten, an der er seine **privaten**
 * Ausgaben mitschreiben kann. Alles von Hand, nichts automatisch: keine Bank,
 * keine Kasse, kein Beleg-Import. Ein Notizblock, der rechnen kann.
 *
 * ── Die Trennlinie, die den ganzen Aufbau erklärt ─────────────────────
 * **Das hier ist nicht der Betrieb.** Diese Seite
 *   · taucht in keiner Betriebsauswertung auf,
 *   · steht in keiner Kachel der Übersicht,
 *   · geht nirgends an den Steuerberater,
 *   · und verrechnet keine einzige Zahl mit Betriebszahlen.
 *
 * Daraus folgen zwei Sätze, die auch auf der Seite stehen und dort bleiben:
 *   1. Eine **Privatentnahme** aus dem Betrieb muss der Steuerberater trotzdem
 *      erfahren. Hier einzutragen ersetzt das nicht.
 *   2. Eine Ausgabe, die in Wahrheit **betrieblich** ist, gehört auf den Beleg
 *      und nicht hierher — sonst ist sie für die Buchhaltung verloren.
 *
 * ── Zugriff ───────────────────────────────────────────────────────────
 * Für `service` und `demo` gesperrt (`_lib/auth.js`) und zusätzlich hinter der
 * Chef-PIN (`_lib/chefpin.js`). Das ist das Privatgeld des Inhabers; niemand im
 * Team hat einen Grund, es zu sehen.
 */
import { clean, esc, nowBerlin, isValidDate } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import {
  AUS_KATEGORIEN, EIN_KATEGORIEN, RICHTUNGEN, ZAHLARTEN,
  istRichtung, istKategorie, katListe, katLabel,
  euro, centAus, istMonat, monatMinus, monatLabel, monatKurz,
  summen, nachKategorie, offeneVorlagen,
} from '../_lib/privat.js';

const MIGRATION = 'Die Privatkasse braucht die Migration 0027_privatkasse.sql. '
  + 'Bitte einspielen, dann steht die Seite.';

/* ================================================================== */
/* Stil                                                               */
/* ================================================================== */

const CSS = `
/* Die Saldokacheln sind die vorhandenen .stat-Kacheln, nur eingefärbt:
   Eingenommen grün, Ausgegeben und ein negativer Rest weinrot. */
.stat.gut b{color:var(--ok)}

/* Balken für „wohin geht das Geld". Bewusst nur ein Balken je Kategorie —
   ein Tortendiagramm mit elf Stücken liest niemand. */
.pk-bal{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.2rem .9rem;align-items:baseline}
.pk-bal .n{font-size:.92rem}
.pk-bal .w{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.pk-bal .s{grid-column:1 / -1;height:6px;border-radius:3px;background:var(--sand);
  margin:0 0 .75rem;overflow:hidden}
.pk-bal .s i{display:block;height:100%;background:var(--wine);border-radius:3px}

.pk-mon{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:1.2rem}
.pk-mon .jetzt{font-weight:600;font-size:1.05rem;padding:0 .5rem}

.pk-neu .grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.pk-tag{white-space:nowrap;font-variant-numeric:tabular-nums}
td.pk-b{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
td.pk-b.ein{color:var(--ok)}
tr.pk-fix td.nm .meta::before{content:"↻ "}
/* Ein Monat ohne Einträge ist blass, aber nicht durchgestrichen — er ist
   ungefüllt, nicht storniert. */
tr.pk-leer{color:var(--muted)}
`;

/* ================================================================== */
/* Textbausteine                                                      */
/* ================================================================== */

const ABGRENZUNG = `
  <details class="card">
    <summary>Wofür diese Seite gedacht ist — und wofür nicht</summary>
    <div class="body meta">
      <p style="margin:0 0 .8rem"><b>Sie ist ein privates Haushaltsbuch.</b> Was hier steht,
         steht nur hier: keine Auswertung des Betriebs greift darauf zu, keine Zahl wird mit
         Betriebszahlen verrechnet, und an den Steuerberater geht davon nichts.</p>
      <p style="margin:0 0 .8rem"><b>Sie ist keine Buchhaltung.</b> Eine <b>Entnahme aus dem
         Betrieb</b> ist buchhalterisch relevant und muss dem Steuerberater weiterhin gemeldet
         werden — hier einzutragen ersetzt das nicht, es hält nur die private Seite vollständig.</p>
      <p style="margin:0 0 .8rem"><b>Betriebliche Ausgaben gehören nicht hierher.</b> Wer eine
         Rechnung für das Lokal hier einträgt statt auf den Beleg für den Steuerberater, hat sie
         für die Buchhaltung verloren — und damit als Betriebsausgabe.</p>
      <p style="margin:0"><b>Es rechnet nichts von allein.</b> Kein Konto, keine Kasse, kein
         Beleg-Import. Was nicht eingetragen wird, steht auch nicht drin — dafür stimmt alles,
         was drinsteht.</p>
    </div>
  </details>`;

/* ================================================================== */
/* Bausteine                                                          */
/* ================================================================== */

const tagKurzDe = t => `${String(t).slice(8)}.${String(t).slice(5, 7)}.`;

/** Auswahlliste für Kategorien, nach Richtung gruppiert. */
const katOptionen = (gewaehlt) => `
  <optgroup label="Ausgabe">${Object.entries(AUS_KATEGORIEN).map(([k, v]) =>
    `<option value="${k}"${k === gewaehlt ? ' selected' : ''}>${esc(v)}</option>`).join('')}</optgroup>
  <optgroup label="Einnahme">${Object.entries(EIN_KATEGORIEN).map(([k, v]) =>
    `<option value="${k}"${k === gewaehlt ? ' selected' : ''}>${esc(v)}</option>`).join('')}</optgroup>`;

function saldoBlock({ ein, aus, saldo }) {
  return `<div class="stats">
    <div class="stat gut"><b>${esc(euro(ein))} €</b><span>Eingenommen</span></div>
    <div class="stat hot"><b>${esc(euro(aus))} €</b><span>Ausgegeben</span></div>
    <div class="stat${saldo < 0 ? ' hot' : ''}">
      <b>${saldo < 0 ? '−' : ''}${esc(euro(Math.abs(saldo)))} €</b>
      <span>${saldo < 0 ? 'mehr ausgegeben' : 'übrig'}</span></div>
  </div>`;
}

/* ================================================================== */
/* Monatsansicht                                                      */
/* ================================================================== */

function monatSeite({ url, user, monat, zeilen, vorlagen, heute }) {
  const s = summen(zeilen);
  const kats = nachKategorie(zeilen);
  const offen = offeneVorlagen(vorlagen, zeilen);
  const groesster = kats[0]?.cent || 1;

  /* Innerhalb des angezeigten Monats darf man auf jeden Tag buchen; darüber
     hinaus nicht, sonst landet ein Eintrag versehentlich im falschen Monat. */
  const ersterTag = `${monat}-01`;
  const letzterTag = new Date(Date.UTC(+monat.slice(0, 4), +monat.slice(5, 7), 0))
    .toISOString().slice(0, 10);
  const vorbelegt = heute >= ersterTag && heute <= letzterTag ? heute : ersterTag;

  const zeile = z => `<tr class="${z.fix_id ? 'pk-fix' : ''}">
    <td class="t pk-tag">${esc(tagKurzDe(z.tag))}</td>
    <td class="nm"><b>${esc(z.text || katLabel(z.kategorie, z.richtung))}</b>
      <div class="meta">${esc(katLabel(z.kategorie, z.richtung))}${
        z.zahlart ? ` · ${esc(ZAHLARTEN[z.zahlart] || z.zahlart)}` : ''}${
        z.fix_id ? ' · aus Vorlage' : ''}</div></td>
    <td class="pk-b${z.richtung === 'ein' ? ' ein' : ''}">${
      z.richtung === 'ein' ? '+' : '−'} ${esc(euro(z.cent))} €</td>
    <td class="act">
      <form method="post" action="/admin/privat" style="display:inline"
            onsubmit="return confirm('Diesen Eintrag löschen?')">
        <input type="hidden" name="do" value="weg">
        <input type="hidden" name="id" value="${esc(z.id)}">
        <input type="hidden" name="m" value="${esc(monat)}">
        <button class="btn sm danger" type="submit">Löschen</button>
      </form>
    </td>
  </tr>`;

  const vorlageZeile = v => `<tr>
    <td class="nm"><b>${esc(v.text)}</b>
      <div class="meta">${esc(katLabel(v.kategorie, v.richtung))} ·
        ${esc(RICHTUNGEN[v.richtung])}</div></td>
    <td class="pk-b${v.richtung === 'ein' ? ' ein' : ''}">${esc(euro(v.cent))} €</td>
    <td class="act">
      <form method="post" action="/admin/privat" style="display:inline">
        <input type="hidden" name="do" value="vorlage_weg">
        <input type="hidden" name="id" value="${esc(v.id)}">
        <input type="hidden" name="m" value="${esc(monat)}">
        <button class="btn sm danger" type="submit">Entfernen</button>
      </form>
    </td>
  </tr>`;

  const body = `<style>${CSS}</style>
    <h1>Privatkasse</h1>
    <p class="sub">Privates Haushaltsbuch — getrennt vom Betrieb, alles von Hand eingetragen.</p>
    ${flash(url)}

    <div class="pk-mon">
      <a class="btn sm ghost" href="/admin/privat?m=${monatMinus(monat, 1)}">← ${
        esc(monatLabel(monatMinus(monat, 1)))}</a>
      <span class="jetzt">${esc(monatLabel(monat))}</span>
      <a class="btn sm ghost" href="/admin/privat?m=${monatMinus(monat, -1)}">${
        esc(monatLabel(monatMinus(monat, -1)))} →</a>
      <a class="btn sm ghost" href="/admin/privat?jahr=${esc(monat.slice(0, 4))}">Jahresübersicht</a>
    </div>

    ${saldoBlock(s)}

    <div class="card pk-neu">
      <h2>Eintragen</h2>
      <div class="body">
        <form method="post" action="/admin/privat">
          <input type="hidden" name="do" value="neu">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="grid">
            <div class="f"><label for="richtung">Was</label>
              <select id="richtung" name="richtung">
                <option value="aus">Ausgabe</option>
                <option value="ein">Einnahme</option>
              </select></div>
            <div class="f"><label for="betrag">Betrag in Euro</label>
              <input id="betrag" name="betrag" type="text" inputmode="decimal" required
                     placeholder="z. B. 84,90"></div>
            <div class="f"><label for="tag">Tag</label>
              <input id="tag" name="tag" type="date" required value="${esc(vorbelegt)}"
                     min="${esc(ersterTag)}" max="${esc(letzterTag)}"></div>
            <div class="f"><label for="kategorie">Kategorie</label>
              <select id="kategorie" name="kategorie">${katOptionen('einkauf')}</select></div>
            <div class="f"><label for="zahlart">Bezahlt</label>
              <select id="zahlart" name="zahlart">
                <option value="">— keine Angabe —</option>
                ${Object.entries(ZAHLARTEN).map(([k, v]) =>
                  `<option value="${k}">${esc(v)}</option>`).join('')}
              </select></div>
            <div class="f full"><label for="text">Wofür <span class="meta">optional</span></label>
              <input id="text" name="text" maxlength="80"
                     placeholder="z. B. Nebenkosten Nachzahlung, Reifen, Zahnarzt"></div>
          </div>
          <p class="hint" style="margin:.6rem 0 0">Die Kategorie muss zur Richtung passen —
             „Entnahme aus dem Betrieb" ist eine Einnahme, „Wohnen" eine Ausgabe.
             Passt beides nicht zusammen, sagt die Seite es beim Speichern.</p>
          <div class="row end" style="margin-top:1rem">
            <button class="btn" type="submit">Eintragen</button>
          </div>
        </form>
      </div>
    </div>

    ${kats.length ? `<div class="card">
      <h2>Wohin das Geld geht <em>${esc(monatLabel(monat))}</em></h2>
      <div class="body">
        <div class="pk-bal">
          ${kats.map(k => `
            <span class="n">${esc(k.label)}</span>
            <span class="w">${esc(euro(k.cent))} € · ${k.anteil} %</span>
            <span class="s"><i style="width:${Math.max(2, Math.round(k.cent * 100 / groesster))}%"></i></span>
          `).join('')}
        </div>
        <p class="hint" style="margin:.2rem 0 0">Nur Ausgaben. Der Balken zeigt den Anteil an
           der größten Kategorie, die Prozentzahl den Anteil an allen Ausgaben des Monats.</p>
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Einträge <em>${s.anzahl}</em></h2>
      ${zeilen.length
        ? `<table class="stack"><thead><tr><th>Tag</th><th>Wofür</th>
             <th style="text-align:right">Betrag</th><th></th></tr></thead>
           <tbody>${zeilen.map(zeile).join('')}</tbody></table>`
        : `<div class="empty">Für ${esc(monatLabel(monat))} ist noch nichts eingetragen.</div>`}
    </div>

    <details class="card"${offen.length ? ' open' : ''}>
      <summary>Feste Posten <em>${vorlagen.length}</em></summary>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Miete, Versicherung, Handy — was jeden Monat
           gleich wiederkommt, wird einmal angelegt und danach mit einem Griff gebucht.
           <b>Nichts läuft von allein:</b> ein Eintrag, den niemand ausgelöst hat, ist ein
           Eintrag, dem niemand traut. Ändert sich ein Betrag, wird die Vorlage geändert —
           schon gebuchte Monate bleiben, wie sie waren.</p>

        ${offen.length ? `<form method="post" action="/admin/privat" style="margin-bottom:1.2rem">
          <input type="hidden" name="do" value="vorlage_buchen">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="msg warn" style="margin:0 0 .8rem">
            <b>${offen.length} ${offen.length === 1 ? 'fester Posten ist' : 'feste Posten sind'}
            für ${esc(monatLabel(monat))} noch nicht gebucht.</b>
            Zusammen ${esc(euro(offen.reduce((a, v) => a + (v.richtung === 'aus' ? v.cent : 0), 0)))} €
            an Ausgaben.
          </div>
          <button class="btn" type="submit">Alle ${offen.length} für ${
            esc(monatLabel(monat))} buchen</button>
        </form>` : vorlagen.length ? `<div class="msg" style="margin:0 0 1.2rem">Für ${
            esc(monatLabel(monat))} sind alle festen Posten gebucht.</div>` : ''}

        ${vorlagen.length ? `<table class="stack"><thead><tr><th>Posten</th>
             <th style="text-align:right">Betrag</th><th></th></tr></thead>
           <tbody>${vorlagen.map(vorlageZeile).join('')}</tbody></table>`
          : '<div class="empty">Noch keine festen Posten angelegt.</div>'}

        <form method="post" action="/admin/privat" style="margin-top:1.4rem">
          <input type="hidden" name="do" value="vorlage_neu">
          <input type="hidden" name="m" value="${esc(monat)}">
          <div class="grid">
            <div class="f"><label for="vtext">Bezeichnung</label>
              <input id="vtext" name="text" maxlength="60" required placeholder="z. B. Miete Wohnung"></div>
            <div class="f"><label for="vbetrag">Betrag in Euro</label>
              <input id="vbetrag" name="betrag" type="text" inputmode="decimal" required
                     placeholder="z. B. 980,00"></div>
            <div class="f"><label for="vrichtung">Was</label>
              <select id="vrichtung" name="richtung">
                <option value="aus">Ausgabe</option>
                <option value="ein">Einnahme</option>
              </select></div>
            <div class="f"><label for="vkat">Kategorie</label>
              <select id="vkat" name="kategorie">${katOptionen('wohnen')}</select></div>
          </div>
          <div class="row end" style="margin-top:1rem">
            <button class="btn ghost" type="submit">Festen Posten anlegen</button>
          </div>
        </form>
      </div>
    </details>

    ${ABGRENZUNG}`;

  return layout({ user, title: `Privatkasse ${monatLabel(monat)}`, active: '/admin/privat', body });
}

/* ================================================================== */
/* Jahresübersicht                                                    */
/* ================================================================== */

function jahrSeite({ url, user, jahr, zeilen, jahre }) {
  const proMonat = new Map();
  for (const z of zeilen) {
    const m = z.tag.slice(0, 7);
    const e = proMonat.get(m) || { ein: 0, aus: 0 };
    if (z.richtung === 'ein') e.ein += z.cent || 0; else e.aus += z.cent || 0;
    proMonat.set(m, e);
  }
  const monate = [...Array(12)].map((_, i) => {
    const m = `${jahr}-${String(i + 1).padStart(2, '0')}`;
    const e = proMonat.get(m) || { ein: 0, aus: 0 };
    return { m, ...e, saldo: e.ein - e.aus, leer: !e.ein && !e.aus };
  });
  const s = summen(zeilen);
  const kats = nachKategorie(zeilen);
  const groesster = kats[0]?.cent || 1;
  const gefuellt = monate.filter(m => !m.leer).length;

  const body = `<style>${CSS}</style>
    <h1>Privatkasse ${esc(String(jahr))}</h1>
    <p class="sub">Was über das Jahr privat geflossen ist. Getrennt vom Betrieb.</p>
    ${flash(url)}

    <div class="pk-mon">
      ${jahre.map(j => `<a class="btn sm ghost" href="/admin/privat?jahr=${j}"${
        j === jahr ? ' style="border-color:var(--wine);color:var(--wine)"' : ''}>${j}</a>`).join('')}
      <a class="btn sm ghost" href="/admin/privat">Zurück zum Monat</a>
    </div>

    ${saldoBlock(s)}

    <div class="card">
      <h2>Monat für Monat</h2>
      <table class="stack"><thead><tr><th>Monat</th>
        <th style="text-align:right">Ein</th><th style="text-align:right">Aus</th>
        <th style="text-align:right">Bleibt</th><th></th></tr></thead>
      <tbody>${monate.map(m => `<tr class="${m.leer ? 'pk-leer' : ''}">
        <td class="t"><a href="/admin/privat?m=${esc(m.m)}">${esc(monatKurz(m.m))}</a></td>
        <td class="pk-b${m.ein ? ' ein' : ''}">${m.ein ? esc(euro(m.ein)) + ' €' : '—'}</td>
        <td class="pk-b">${m.aus ? esc(euro(m.aus)) + ' €' : '—'}</td>
        <td class="pk-b"${m.saldo < 0 ? ' style="color:var(--wine)"' : ''}>${
          m.leer ? '—' : (m.saldo < 0 ? '−' : '') + esc(euro(Math.abs(m.saldo))) + ' €'}</td>
        <td class="act"><a class="btn sm ghost" href="/admin/privat?m=${esc(m.m)}">Öffnen</a></td>
      </tr>`).join('')}</tbody></table>
      <div class="body">
        <p class="hint" style="margin:0">${gefuellt === 0
          ? `Für ${jahr} ist noch nichts eingetragen.`
          : `Eingetragen in ${gefuellt} von 12 Monaten. Ein Durchschnitt über das ganze Jahr
             wäre irreführend, solange nicht jeder Monat gepflegt ist — deshalb steht hier keiner.`}</p>
      </div>
    </div>

    ${kats.length ? `<div class="card">
      <h2>Ausgaben nach Kategorie <em>${esc(String(jahr))}</em></h2>
      <div class="body">
        <div class="pk-bal">
          ${kats.map(k => `
            <span class="n">${esc(k.label)}</span>
            <span class="w">${esc(euro(k.cent))} € · ${k.anteil} %</span>
            <span class="s"><i style="width:${Math.max(2, Math.round(k.cent * 100 / groesster))}%"></i></span>
          `).join('')}
        </div>
      </div>
    </div>` : ''}

    ${ABGRENZUNG}`;

  return layout({ user, title: `Privatkasse ${jahr}`, active: '/admin/privat', body });
}

/* ================================================================== */
/* GET                                                                */
/* ================================================================== */

/** Fehlt die Migration, sagt die Seite das — statt einen 500er zu werfen. */
const fehltSeite = (user, url) => layout({
  user, title: 'Privatkasse', active: '/admin/privat',
  body: `<h1>Privatkasse</h1>${flash(url)}
    <div class="card"><div class="body"><p class="meta" style="margin:0">${esc(MIGRATION)}</p></div></div>`,
});

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const user = data?.user || null;
  const db = env.DB;
  const heute = nowBerlin().date;

  /* Welche Jahre überhaupt etwas enthalten — plus das laufende, damit die
     Auswahl auch im leeren Zustand nicht verschwindet. */
  let jahre = [Number(heute.slice(0, 4))];
  try {
    const r = (await db.prepare(
      `SELECT DISTINCT substr(tag,1,4) AS j FROM private_entries ORDER BY j DESC`).all()).results || [];
    jahre = [...new Set([...r.map(x => Number(x.j)), Number(heute.slice(0, 4))])].sort((a, b) => b - a);
  } catch { return fehltSeite(user, url); }

  /* ---- Jahresübersicht ---- */
  const jParam = clean(url.searchParams.get('jahr'), 4);
  if (/^\d{4}$/.test(jParam)) {
    const jahr = Number(jParam);
    let zeilen = [];
    try {
      zeilen = (await db.prepare(
        `SELECT tag,richtung,kategorie,cent FROM private_entries
          WHERE substr(tag,1,4)=? ORDER BY tag`).bind(jParam).all()).results || [];
    } catch { return fehltSeite(user, url); }
    return jahrSeite({ url, user, jahr, zeilen, jahre });
  }

  /* ---- Monat ---- */
  const mParam = clean(url.searchParams.get('m'), 7);
  const monat = istMonat(mParam) ? mParam : heute.slice(0, 7);

  let zeilen = [], vorlagen = [];
  try {
    zeilen = (await db.prepare(
      `SELECT id,tag,richtung,kategorie,text,cent,zahlart,fix_id FROM private_entries
        WHERE substr(tag,1,7)=? ORDER BY tag DESC, created_at DESC`).bind(monat).all()).results || [];
    vorlagen = (await db.prepare(
      `SELECT id,richtung,kategorie,text,cent,aktiv FROM private_fix
        WHERE aktiv=1 ORDER BY sort, text`).all()).results || [];
  } catch { return fehltSeite(user, url); }

  return monatSeite({ url, user, monat, zeilen, vorlagen, heute });
}

/* ================================================================== */
/* POST                                                               */
/* ================================================================== */

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }

  const monat = istMonat(clean(d.m, 7)) ? clean(d.m, 7) : nowBerlin().date.slice(0, 7);
  const zurueck = (ok) => redirect(`/admin/privat?m=${monat}`, ok);
  const fehler = (t) => new Response(null, { status: 303, headers: {
    location: `/admin/privat?m=${monat}&err=${encodeURIComponent(t)}`, 'cache-control': 'no-store' } });

  if (!db) return fehler('Die Datenbank ist gerade nicht erreichbar.');
  const jetzt = new Date().toISOString();

  /* ---- Einzelner Eintrag ------------------------------------------ */
  if (d.do === 'neu') {
    const richtung = clean(d.richtung, 4);
    if (!istRichtung(richtung)) return fehler('Bitte Ausgabe oder Einnahme wählen.');

    const kategorie = clean(d.kategorie, 24);
    /* Die Auswahlliste zeigt beide Richtungen — sonst müsste die Seite bei
       jedem Wechsel neu laden. Hier wird geprüft, dass zusammenpasst, was
       zusammengehört: „Entnahme" als Ausgabe wäre eine stille Falschbuchung. */
    if (!istKategorie(kategorie, richtung)) {
      return fehler(`„${katLabel(kategorie, richtung)}" passt nicht zu einer `
        + `${richtung === 'ein' ? 'Einnahme' : 'Ausgabe'}. Bitte die Kategorie prüfen.`);
    }

    const cent = centAus(d.betrag);
    if (cent === null) return fehler('Der Betrag ist nicht lesbar. Beispiel: 84,90');
    if (cent <= 0) return fehler('Ein Betrag von null ergibt keinen Eintrag.');

    const tag = clean(d.tag, 10);
    if (!isValidDate(tag)) return fehler('Bitte einen gültigen Tag angeben.');

    const zahlart = Object.hasOwn(ZAHLARTEN, clean(d.zahlart, 8)) ? clean(d.zahlart, 8) : null;
    const text = clean(d.text, 80) || null;

    try {
      await db.prepare(
        `INSERT INTO private_entries (id,tag,richtung,kategorie,text,cent,zahlart,created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), tag, richtung, kategorie, text, cent, zahlart, jetzt).run();
    } catch { return fehler(MIGRATION); }

    /* Der Eintrag kann in einem anderen Monat liegen als dem angezeigten —
       dann wird dorthin gesprungen, sonst sucht man ihn vergeblich. */
    const ziel = tag.slice(0, 7);
    return redirect(`/admin/privat?m=${ziel}`,
      `${richtung === 'ein' ? 'Einnahme' : 'Ausgabe'} über ${euro(cent)} € eingetragen.`);
  }

  if (d.do === 'weg') {
    const id = clean(d.id, 40);
    try { await db.prepare(`DELETE FROM private_entries WHERE id=?`).bind(id).run(); }
    catch { return fehler('Das hat nicht geklappt.'); }
    return zurueck('Eintrag gelöscht.');
  }

  /* ---- Feste Posten ----------------------------------------------- */
  if (d.do === 'vorlage_neu') {
    const richtung = clean(d.richtung, 4);
    if (!istRichtung(richtung)) return fehler('Bitte Ausgabe oder Einnahme wählen.');
    const kategorie = clean(d.kategorie, 24);
    if (!istKategorie(kategorie, richtung)) {
      return fehler(`„${katLabel(kategorie, richtung)}" passt nicht zu einer `
        + `${richtung === 'ein' ? 'Einnahme' : 'Ausgabe'}. Bitte die Kategorie prüfen.`);
    }
    const cent = centAus(d.betrag);
    if (cent === null || cent <= 0) return fehler('Der Betrag ist nicht lesbar. Beispiel: 980,00');
    const text = clean(d.text, 60);
    if (!text) return fehler('Ein fester Posten braucht eine Bezeichnung.');

    try {
      await db.prepare(
        `INSERT INTO private_fix (id,richtung,kategorie,text,cent,aktiv,sort,created_at)
         VALUES (?,?,?,?,?,1,0,?)`
      ).bind(crypto.randomUUID(), richtung, kategorie, text, cent, jetzt).run();
    } catch { return fehler(MIGRATION); }
    return zurueck(`„${text}" als festen Posten angelegt.`);
  }

  if (d.do === 'vorlage_weg') {
    /* Nur die Vorlage verschwindet. Was daraus schon gebucht wurde, bleibt
       stehen — es ist ausgegebenes Geld, keine Einstellung. */
    const id = clean(d.id, 40);
    try { await db.prepare(`DELETE FROM private_fix WHERE id=?`).bind(id).run(); }
    catch { return fehler('Das hat nicht geklappt.'); }
    return zurueck('Fester Posten entfernt. Bereits gebuchte Monate bleiben unverändert.');
  }

  if (d.do === 'vorlage_buchen') {
    let vorlagen = [], schon = [];
    try {
      vorlagen = (await db.prepare(
        `SELECT id,richtung,kategorie,text,cent FROM private_fix WHERE aktiv=1 ORDER BY sort, text`)
        .all()).results || [];
      schon = (await db.prepare(
        `SELECT fix_id FROM private_entries WHERE substr(tag,1,7)=? AND fix_id IS NOT NULL`)
        .bind(monat).all()).results || [];
    } catch { return fehler(MIGRATION); }

    const gebucht = new Set(schon.map(z => z.fix_id));
    const offen = vorlagen.filter(v => !gebucht.has(v.id));
    if (!offen.length) return zurueck('Für diesen Monat war schon alles gebucht.');

    /* Gebucht wird auf den Monatsersten. Ein echtes Fälligkeitsdatum je Posten
       wäre eine Genauigkeit, die niemand pflegt — und die erste Zeile im Monat
       ist genau da richtig. */
    const tag = `${monat}-01`;
    let n = 0;
    for (const v of offen) {
      try {
        await db.prepare(
          `INSERT INTO private_entries (id,tag,richtung,kategorie,text,cent,fix_id,created_at)
           VALUES (?,?,?,?,?,?,?,?)`
        ).bind(crypto.randomUUID(), tag, v.richtung, v.kategorie, v.text, v.cent, v.id, jetzt).run();
        n++;
      } catch {
        /* Der eindeutige Index schlägt zu, wenn parallel schon gebucht wurde.
           Kein Grund abzubrechen — der Posten steht dann bereits drin. */
      }
    }
    return zurueck(n
      ? `${n} ${n === 1 ? 'fester Posten' : 'feste Posten'} für ${monatLabel(monat)} gebucht.`
      : 'Es war nichts mehr zu buchen.');
  }

  return fehler('Das hat nicht geklappt.');
}
