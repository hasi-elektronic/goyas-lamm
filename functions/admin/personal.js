/**
 * Personal — Liste und Personalkarte.
 *
 * ── Warum eine Karte und keine Zeilen mehr ────────────────────────────
 * Vorher war jede Zeile der Liste ein eigenes Formular: Name, Bereich, Lohn,
 * PIN und Sortiernummer nebeneinander, für jeden im Team. Auf dem Telefon
 * hieß das fünf Felder im Querlauf und ein „Speichern" pro Zeile, und alles,
 * was über Name und Lohn hinausging, hatte schlicht keinen Platz.
 *
 * Jetzt derselbe Aufbau, den Schichtplaner alle verwenden (7shifts, Planday,
 * Deputy): eine ruhige Liste, ein Klick auf den Namen öffnet die Karte, oben
 * ein fester Kopf mit Initialen, Name, Bereich und Status, darunter drei
 * Reiter. Die Reiter sind Links mit `?t=`, kein JavaScript — dieselbe Seite
 * funktioniert auf dem Küchentablet mit abgeschaltetem Skript genauso.
 *
 * Drei Reiter statt der neun, die 7shifts hat: Für ein Haus mit einer Handvoll
 * Leuten sind Reiter für Leistungsbeurteilung, Standorte und Abteilungen
 * leerer Platz, der bei jedem Öffnen mitgezählt werden will.
 *
 * ── Was bewusst nicht auf der Karte steht ─────────────────────────────
 * Keine Bankverbindung, keine Steuer-ID, keine Sozialversicherungsnummer —
 * die Abrechnung macht der Steuerberater. Keine Krankmeldungen und keine
 * Diagnosen: Gesundheitsdaten sind nach Art. 9 DSGVO besonders geschützt und
 * müssen getrennt von der übrigen Personalakte liegen; diese Trennung kann
 * das Panel nicht leisten, also gehören sie nicht hinein.
 *
 * Und weiterhin kein Löschen. „Ausgeschieden" nimmt jemanden aus der
 * Stempeluhr, die Schichten bleiben — § 17 MiLoG verlangt zwei Jahre
 * Aufbewahrung, in der Gastronomie für alle Beschäftigten.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect, geheimnis } from '../_lib/ui.js';
import {
  pinHash, summe, centAus, euro, lohnCent, dezimal, verteileTrinkgeld, tagKurz,
  MINDESTLOHN_CENT, MINIJOB_CENT,
} from '../_lib/zeit.js';
import { gespeicherterPin, setzePin, loeschePin, sperrCookie, DAUER_MIN } from '../_lib/chefpin.js';
import {
  ARTEN as ABW_ARTEN, STATUS, istArt, artLabel, werktage, mindestUrlaub,
  urlaubskonto, zeitraum, auFrist,
} from '../_lib/abwesenheit.js';
import { fristenFuer, resturlaubHinweis } from '../_lib/personalfristen.js';

const ROLLEN = ['Küche', 'Service', 'Bar', 'Aushilfe', 'Leitung'];
const ARTEN  = ['Vollzeit', 'Teilzeit', 'Minijob', 'Aushilfe', 'Azubi'];
const REITER = [['person', 'Person'], ['zeit', 'Zeit & Lohn'],
                ['frei', 'Urlaub & Ausfall'], ['nachweis', 'Nachweise & Notizen']];

/* Die Belehrung nach § 43 IfSG wird vom Gesundheitsamt erstmalig erteilt; die
   Wiederholung durch den Arbeitgeber ist alle zwei Jahre fällig. Wir rechnen
   nur das Datum aus und erinnern daran — mehr kann und darf die Seite nicht. */
const BELEHRUNG_JAHRE = 2;
const WARN_TAGE = 60;

const SPALTEN_NEU = 'phone,birthday,start_date,art,nk_name,nk_phone,belehrung_am,notiz';
/* Migration 0025 — Urlaubskonto und zwei weitere Fristen. Eigene Stufe beim
   Lesen, damit ein Haus ohne diese Migration die Karte trotzdem bekommt. */
const SPALTEN_25 = 'urlaub_tage,urlaub_rest_vj,vertrag_am,titel_bis';

/* ------------------------------------------------------------------ */
/* Kleinkram                                                           */
/* ------------------------------------------------------------------ */

/** „Mehmet Yıldız" → „MY", „Anna" → „A" */
function initialen(name) {
  const t = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return '?';
  return (t.length === 1 ? t[0][0] : t[0][0] + t[t.length - 1][0]).toUpperCase();
}

const istDatum = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const datumAus = v => {
  const s = clean(v, 10);
  return istDatum(s) ? s : null;
};
const datumDe = d => (istDatum(d) ? `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '—');

/** Datum plus n Jahre, als YYYY-MM-DD. */
function plusJahre(d, n) {
  if (!istDatum(d)) return null;
  const [y, m, t] = d.split('-').map(Number);
  return `${String(y + n).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
}

const tageBis = (ziel, heute) =>
  Math.round((Date.parse(ziel + 'T00:00:00Z') - Date.parse(heute + 'T00:00:00Z')) / 86400000);

/**
 * Stand der Belehrung.
 * @returns {{ablauf:string, tage:number, stufe:'ok'|'bald'|'faellig'}|null}
 */
function belehrungStand(am, heute) {
  const ablauf = plusJahre(am, BELEHRUNG_JAHRE);
  if (!ablauf) return null;
  const tage = tageBis(ablauf, heute);
  return { ablauf, tage, stufe: tage < 0 ? 'faellig' : (tage <= WARN_TAGE ? 'bald' : 'ok') };
}

/** Alter in Jahren, für die Karte. */
function alter(gebdatum, heute) {
  if (!istDatum(gebdatum)) return null;
  let a = +heute.slice(0, 4) - +gebdatum.slice(0, 4);
  if (heute.slice(5) < gebdatum.slice(5)) a--;
  return a >= 0 && a < 120 ? a : null;
}

/** Hat heute Geburtstag? Ein Satz, der im Haus mehr wert ist als er kostet. */
const heuteGeburtstag = (g, heute) => istDatum(g) && g.slice(5) === heute.slice(5);

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

/**
 * Team lesen — mit den Spalten der Personalkarte, sonst ohne.
 *
 * Dasselbe Muster wie in `loadKarte`: Eine nicht eingespielte Migration darf
 * nicht dazu führen, dass die Seite gar nichts mehr zeigt.
 */
async function liesTeam(db) {
  const basis = 'id,name,role,pin_hash,active,sort';
  try {
    return { neu: true, lohn: true, abw: true, leute: (await db.prepare(
      `SELECT ${basis},wage_cent,${SPALTEN_NEU},${SPALTEN_25} FROM staff ORDER BY active DESC, sort, name`
    ).all()).results || [] };
  } catch { /* Migration 0025 fehlt */ }
  try {
    return { neu: true, lohn: true, abw: false, leute: (await db.prepare(
      `SELECT ${basis},wage_cent,${SPALTEN_NEU} FROM staff ORDER BY active DESC, sort, name`
    ).all()).results || [] };
  } catch { /* Migration 0020 fehlt */ }
  try {
    return { neu: false, lohn: true, leute: (await db.prepare(
      `SELECT ${basis},wage_cent FROM staff ORDER BY active DESC, sort, name`).all()).results || [],
      hinweis: 'Die Felder der Personalkarte fehlen noch — bitte Migration 0020_personalkarte.sql einspielen.' };
  } catch { /* Migration 0010 fehlt */ }
  return { neu: false, lohn: false, leute: (await db.prepare(
    `SELECT ${basis} FROM staff ORDER BY active DESC, sort, name`).all()).results || [],
    hinweis: 'Der Stundenlohn fehlt noch — bitte Migration 0010_lohn.sql einspielen.' };
}

/* ------------------------------------------------------------------ */
/* Stil                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.kkopf{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin:0 0 1.2rem}
.kbild{width:56px;height:56px;border-radius:50%;background:var(--wine);color:#fff;
  display:grid;place-items:center;font-weight:700;font-size:1.15rem;letter-spacing:.02em;
  flex:0 0 auto}
.kkopf.aus .kbild{background:var(--muted)}
.kkopf h1{margin:0;font-size:1.5rem;line-height:1.15}
.kkopf .wer{flex:1;min-width:200px}
.kkopf .meta{display:block;margin-top:.2rem}
.kreiter{display:flex;gap:.2rem;flex-wrap:wrap;border-bottom:1px solid var(--sand);margin:0 0 1.4rem}
.kreiter a{padding:.7rem .95rem;text-decoration:none;color:var(--muted);font-weight:600;
  font-size:.95rem;border-bottom:2px solid transparent;margin-bottom:-1px}
.kreiter a:hover{color:var(--ink)}
.kreiter a.on{color:var(--wine);border-bottom-color:var(--wine)}
.paare{display:grid;gap:.1rem}
.paare div{display:flex;gap:.8rem;padding:.55rem 0;border-bottom:1px solid var(--sand);
  flex-wrap:wrap}
.paare div:last-child{border-bottom:0}
.paare dt,.paare .k{color:var(--muted);min-width:170px;flex:0 0 auto}
.paare .v{font-weight:600}
.pnam{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:inherit}
.pnam .kbild{width:38px;height:38px;font-size:.85rem}
.pnam b{font-size:1rem}
tr.cancelled .pnam .kbild{background:var(--muted)}
td.num{text-align:right;white-space:nowrap;vertical-align:middle}
/* Am Telefon wird aus der Zeile ein Block: vier Spalten nebeneinander lassen
   einem Namen wie „Marek Kowalski" keine 90 Pixel, und dann bricht er mitten
   im Wort. Der „Karte"-Knopf entfällt dort — der Name ist ohnehin der Link. */
@media(max-width:640px){
  .paare .k{min-width:0;flex:1 0 100%}
  .kkopf .row{width:100%}
  .team-t tr{display:block;border-bottom:1px solid var(--sand)}
  .team-t tr:last-child{border-bottom:0}
  .team-t td{display:block;border:0;padding:.15rem 1.1rem;text-align:left}
  .team-t td:first-child{padding-top:.9rem}
  .team-t td:last-child{display:none}
  .team-t td.num{text-align:left;padding-bottom:.9rem}
  .team-t .pill{margin:.15rem .3rem .15rem 0}
}
`;

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

function listeSeite({ url, user, leute, hinweis, offen, laeuft, schichten, heute,
                      chefPinGesetzt, lohn, heuteFrei = {}, antraege = [] }) {
  const aktive = leute.filter(m => m.active);
  const faellig = leute.filter(m => {
    const b = belehrungStand(m.belehrung_am, heute);
    return m.active && b && b.stufe !== 'ok';
  });
  const nameVon = id => leute.find(x => x.id === id)?.name || 'Unbekannt';

  const zeile = m => {
    const s = summe(schichten.filter(x => x.staff_id === m.id));
    const on = laeuft[m.id];
    const b = belehrungStand(m.belehrung_am, heute);
    const frei = heuteFrei[m.id];
    return `<tr class="${m.active ? '' : 'cancelled'}">
      <td>
        <a class="pnam" href="/admin/personal?id=${encodeURIComponent(m.id)}">
          <span class="kbild">${esc(initialen(m.name))}</span>
          <span><b>${esc(m.name)}</b><br>
            <span class="meta">${esc(m.role || 'ohne Bereich')}${
              m.art ? ' · ' + esc(m.art) : ''}</span></span>
        </a>
      </td>
      <td>
        ${on ? `<span class="pill ns">seit ${esc(on.start_at)} Uhr im Dienst</span>` : ''}
        ${frei ? `<span class="pill walk">heute ${esc(artLabel(frei.art))} bis ${esc(frei.bis.slice(8))}.${esc(frei.bis.slice(5, 7))}.</span>` : ''}
        ${m.active ? '' : '<span class="pill">ausgeschieden</span>'}
        ${m.active && !m.pin_hash ? '<span class="pill">ohne PIN</span>' : ''}
        ${m.active && b && b.stufe === 'faellig' ? '<span class="pill ns">Belehrung abgelaufen</span>' : ''}
        ${m.active && b && b.stufe === 'bald' ? `<span class="pill">Belehrung läuft in ${b.tage} Tagen ab</span>` : ''}
        ${heuteGeburtstag(m.birthday, heute) ? '<span class="pill">hat heute Geburtstag</span>' : ''}
      </td>
      <td class="num"><span class="meta">${dezimal(s.gerundet)} h</span></td>
      <td class="num"><a class="btn sm ghost"
        href="/admin/personal?id=${encodeURIComponent(m.id)}">Karte</a></td>
    </tr>`;
  };

  const body = `<style>${CSS}</style>
    <h1>Personal</h1>
    <p class="sub">Wer im Haus arbeitet. Ein Klick auf den Namen öffnet die Personalkarte;
       die Arbeitszeiten stehen unter <a href="/admin/arbeitszeit">Arbeitszeit</a>.</p>
    ${hinweis ? `<div class="msg err">${esc(hinweis)}</div>` : ''}
    ${flash(url)}

    <div class="stats">
      <div class="stat"><b>${aktive.length}</b><span>im Team</span></div>
      <div class="stat hot"><b>${offen.length}</b><span>gerade im Dienst</span></div>
      <div class="stat"><b>${Object.keys(heuteFrei).length}</b><span>heute nicht da</span></div>
      <div class="stat ${antraege.length ? 'hot' : ''}"><b>${antraege.length}</b><span>offene Anträge</span></div>
      <div class="stat"><b>${aktive.filter(m => !m.pin_hash).length}</b><span>ohne PIN</span></div>
      <div class="stat"><b>${faellig.length}</b><span>Belehrung fällig</span></div>
    </div>

    ${antraege.length ? `<div class="card">
      <h2>Urlaubsanträge <em>warten auf Entscheidung</em></h2>
      <table class="stack"><tbody>${antraege.map(a => `<tr>
        <td class="nm"><a href="/admin/personal?id=${encodeURIComponent(a.staff_id)}&t=frei">${
          esc(nameVon(a.staff_id))}</a></td>
        <td class="t">${esc(zeitraum(a.von, a.bis))}</td>
        <td class="num">${a.tage ? esc(String(a.tage)) + ' Tage' : ''}</td>
        <td class="act">
          <form method="post" action="/admin/personal" style="display:inline">
            <input type="hidden" name="do" value="abw_status">
            <input type="hidden" name="id" value="${esc(a.staff_id)}">
            <input type="hidden" name="aid" value="${esc(a.id)}">
            <button class="btn sm" name="status" value="genehmigt" type="submit">Genehmigen</button>
            <button class="btn sm danger" name="status" value="abgelehnt" type="submit">Ablehnen</button>
          </form></td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn" href="/admin/stempel">Stempeluhr öffnen</a>
      <a class="btn ghost" href="/admin/arbeitszeit">Arbeitszeiten</a>
      <a class="btn ghost" href="/admin/dienstplan">Dienstplan</a>
    </div>

    <div class="card">
      <h2>Team <em>${leute.length} ${leute.length === 1 ? 'Person' : 'Personen'} · Stunden im laufenden Monat</em></h2>
      ${leute.length ? `<table class="team-t"><tbody>${leute.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">Noch niemand angelegt.</div>'}
    </div>

    <div class="card">
      <h2>Mitarbeiter anlegen</h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Name, Bereich und PIN reichen zum Start —
           alles Weitere lässt sich danach auf der Karte nachtragen.</p>
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="add">
          <div class="grid">
            <div class="f"><label for="nn">Name</label>
              <input id="nn" name="name" maxlength="60" placeholder="Vorname Nachname" required></div>
            <div class="f"><label for="nr">Bereich</label>
              <select id="nr" name="role">${['', ...ROLLEN].map(r =>
                `<option value="${esc(r)}"${r === 'Service' ? ' selected' : ''}>${r || '—'}</option>`).join('')}</select></div>
            ${lohn ? `<div class="f"><label for="nw">Stundenlohn €</label>
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
    </div>`;

  return layout({ user, title: 'Personal', active: '/admin/personal', body });
}

/* ------------------------------------------------------------------ */
/* Karte                                                               */
/* ------------------------------------------------------------------ */

function feld(name, label, wert, { typ = 'text', hinweis = '', modus = '' } = {}) {
  return `<div class="f"><label for="${name}">${esc(label)}</label>
    <input id="${name}" name="${name}" type="${typ}" value="${esc(wert || '')}" maxlength="80"
      ${modus ? `inputmode="${modus}"` : ''} ${hinweis ? `placeholder="${esc(hinweis)}"` : ''}></div>`;
}

function auswahl(name, label, werte, gewaehlt) {
  return `<div class="f"><label for="${name}">${esc(label)}</label>
    <select id="${name}" name="${name}">${['', ...werte].map(w =>
      `<option value="${esc(w)}"${(gewaehlt || '') === w ? ' selected' : ''}>${w || '—'}</option>`
    ).join('')}</select></div>`;
}

function karteSeite({ url, user, m, reiter, neu, lohn, abw, heute, monat,
                      meine, letzte, trinkgeldCent, laeuft, abwesenheiten = [] }) {
  const s = summe(meine);
  const lohnSum = lohnCent(s.gerundet, m.wage_cent);
  const b = belehrungStand(m.belehrung_am, heute);
  const j = alter(m.birthday, heute);
  const zu = t => `/admin/personal?id=${encodeURIComponent(m.id)}&t=${t}`;

  const kopf = `
    <div class="kkopf${m.active ? '' : ' aus'}">
      <span class="kbild">${esc(initialen(m.name))}</span>
      <div class="wer">
        <h1>${esc(m.name)}</h1>
        <span class="meta">${esc(m.role || 'ohne Bereich')}${m.art ? ' · ' + esc(m.art) : ''}${
          m.start_date ? ' · seit ' + esc(datumDe(m.start_date)) : ''}</span>
      </div>
      <div class="row">
        <a class="btn ghost sm" href="/admin/personal">Zurück zur Liste</a>
        <a class="btn ghost sm" href="/admin/arbeitszeit?p=${encodeURIComponent(m.id)}">Zeiten</a>
      </div>
    </div>
    <div class="row" style="margin:-.6rem 0 1.2rem;gap:.4rem;flex-wrap:wrap">
      ${laeuft ? `<span class="pill ns">seit ${esc(laeuft.start_at)} Uhr im Dienst</span>` : ''}
      ${m.active ? '' : '<span class="pill">ausgeschieden — kann nicht stempeln</span>'}
      ${m.active && !m.pin_hash ? '<span class="pill">ohne PIN — kann nicht stempeln</span>' : ''}
      ${b && b.stufe === 'faellig' ? '<span class="pill ns">Belehrung abgelaufen</span>' : ''}
      ${b && b.stufe === 'bald' ? `<span class="pill">Belehrung läuft in ${b.tage} Tagen ab</span>` : ''}
      ${heuteGeburtstag(m.birthday, heute) ? '<span class="pill">hat heute Geburtstag</span>' : ''}
    </div>
    <nav class="kreiter">${REITER.map(([k, t]) =>
      `<a href="${zu(k)}" class="${reiter === k ? 'on' : ''}">${t}</a>`).join('')}</nav>`;

  let inhalt = '';

  if (reiter === 'person') {
    inhalt = `
    <div class="card">
      <h2>Person</h2>
      <div class="body">
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="person">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="grid">
            <div class="f"><label for="name">Name</label>
              <input id="name" name="name" value="${esc(m.name)}" maxlength="60" required></div>
            ${auswahl('role', 'Bereich', ROLLEN, m.role)}
            ${neu ? auswahl('art', 'Beschäftigungsart', ARTEN, m.art) : ''}
            ${neu ? feld('phone', 'Handynummer', m.phone, { typ: 'tel', hinweis: 'für den Notfall' }) : ''}
            ${neu ? feld('birthday', 'Geburtstag', m.birthday, { typ: 'date' }) : ''}
            ${neu ? feld('start_date', 'Eintritt', m.start_date, { typ: 'date' }) : ''}
            <div class="f"><label for="sort">Reihenfolge in der Stempeluhr</label>
              <input id="sort" name="sort" type="number" min="0" max="999"
                     value="${esc(String(m.sort ?? 0))}"></div>
          </div>
          ${neu ? `<h3 style="font-size:.95rem;margin:1.4rem 0 .6rem">Notfallkontakt</h3>
          <p class="meta" style="margin:0 0 .8rem">Wen rufen wir an, wenn in der Küche etwas
             passiert? Das ist das Feld, das man nie braucht und dann sofort.</p>
          <div class="grid">
            ${feld('nk_name', 'Name und Verhältnis', m.nk_name, { hinweis: 'z. B. Ayşe, Schwester' })}
            ${feld('nk_phone', 'Nummer', m.nk_phone, { typ: 'tel' })}
          </div>` : ''}
          <div class="row end" style="margin-top:1.2rem">
            <button class="btn" type="submit">Speichern</button>
          </div>
        </form>
      </div>
    </div>

    ${neu && (m.phone || m.nk_phone || j !== null) ? `<div class="card">
      <h2>Anrufen</h2>
      <div class="body paare">
        ${m.phone ? `<div><span class="k">${esc(m.name.split(' ')[0])}</span>
          <span class="v"><a href="tel:${esc(m.phone)}">${esc(m.phone)}</a></span></div>` : ''}
        ${m.nk_name || m.nk_phone ? `<div><span class="k">Im Notfall</span><span class="v">${
          esc(m.nk_name || '')}${m.nk_phone
            ? ` · <a href="tel:${esc(m.nk_phone)}">${esc(m.nk_phone)}</a>` : ''}</span></div>` : ''}
        ${j !== null ? `<div><span class="k">Alter</span><span class="v">${j} Jahre</span></div>` : ''}
      </div>
    </div>` : ''}

    <div class="card">
      <h2>${m.active ? 'Ausscheiden' : 'Wieder aufnehmen'}</h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">${m.active
          ? 'Nimmt die Person aus der Stempeluhr. Die bisherigen Zeiten bleiben gespeichert — '
            + 'sie müssen nach § 17 MiLoG zwei Jahre aufbewahrt werden. Deshalb gibt es hier '
            + 'bewusst kein Löschen.'
          : 'Die Person erscheint wieder in der Stempeluhr und kann mit ihrer PIN stempeln.'}</p>
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="${m.active ? 'off' : 'on'}">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <button class="btn ${m.active ? 'danger' : ''}" type="submit"
            >${m.active ? 'Ausgeschieden' : 'Wieder aktiv'}</button>
        </form>
      </div>
    </div>`;
  }

  if (reiter === 'zeit') {
    const unterMindest = m.wage_cent && m.wage_cent < MINDESTLOHN_CENT;
    const ueberMinijob = lohnSum > MINIJOB_CENT;
    inhalt = `
    <div class="card">
      <h2>Diesen Monat <em>${esc(monat.slice(5))}/${esc(monat.slice(0, 4))}</em></h2>
      <div class="body paare">
        <div><span class="k">Gearbeitet</span><span class="v">${dezimal(s.gerundet)} h
          <span class="meta">an ${s.tage} ${s.tage === 1 ? 'Tag' : 'Tagen'}</span></span></div>
        ${s.offen ? `<div><span class="k">Offene Schichten</span>
          <span class="v">${s.offen} <span class="meta">ohne Ende — bitte unter
            <a href="/admin/arbeitszeit?p=${encodeURIComponent(m.id)}">Arbeitszeit</a> nachtragen</span></span></div>` : ''}
        ${lohn ? `<div><span class="k">Lohn, geschätzt</span><span class="v">${m.wage_cent
          ? `${euro(lohnSum)} € <span class="meta">brutto, ohne Zuschläge</span>`
          : '<span class="meta">kein Stundenlohn hinterlegt</span>'}</span></div>` : ''}
        <div><span class="k">Trinkgeldanteil</span><span class="v">${
          trinkgeldCent ? `${euro(trinkgeldCent)} €` : '—'}
          <span class="meta">nach gearbeiteten Minuten, siehe
            <a href="/admin/trinkgeld">Trinkgeld</a></span></span></div>
      </div>
    </div>

    <div class="card">
      <h2>Stundenlohn und PIN</h2>
      <div class="body">
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="zeit">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="grid">
            ${lohn ? `<div class="f"><label for="wage">Stundenlohn €</label>
              <input id="wage" name="wage" inputmode="decimal" maxlength="9"
                     value="${m.wage_cent ? esc(euro(m.wage_cent)) : ''}" placeholder="z. B. 14,50"></div>` : ''}
            <div class="f"><label for="pin">Neue PIN (vier Ziffern)</label>
              <input id="pin" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"
                     placeholder="${m.pin_hash ? 'gesetzt — leer lassen ändert nichts' : 'fehlt'}"></div>
          </div>
          <div class="row end" style="margin-top:1.2rem">
            <button class="btn" type="submit">Speichern</button>
          </div>
        </form>
        ${unterMindest ? `<p class="hint" style="margin:1rem 0 0"><b>Unter dem Mindestlohn.</b>
          Der liegt 2026 bei ${euro(MINDESTLOHN_CENT)} € je Stunde.</p>` : ''}
        ${ueberMinijob ? `<p class="hint" style="margin:1rem 0 0"><b>Über der Minijob-Grenze.</b>
          Die liegt bei ${euro(MINIJOB_CENT)} € im Monat — bitte mit dem Steuerberater klären.</p>` : ''}
        <p class="hint" style="margin:1rem 0 0">Der Lohnbetrag ist eine Schätzung, keine
          Abrechnung: Stunden mal Stundenlohn, brutto, ohne Steuern, Sozialabgaben und ohne
          Zuschläge für Sonntag und Nacht. Was ausgezahlt wird, rechnet der Steuerberater.
          Die PIN wird nur verschlüsselt gespeichert und lässt sich nicht wieder anzeigen.</p>
      </div>
    </div>

    <div class="card">
      <h2>Letzte Schichten</h2>
      ${letzte.length ? `<table><tbody>${letzte.map(x => `<tr>
        <td>${esc(tagKurz(x.work_date))}</td>
        <td>${esc(x.start_at)}–${x.end_at ? esc(x.end_at) : '<span class="meta">läuft</span>'}</td>
        <td class="num"><span class="meta">${x.break_min ? x.break_min + ' min Pause' : ''}</span></td>
        <td class="num">${x.corrected ? '<span class="pill">korrigiert</span>' : ''}</td>
      </tr>`).join('')}</tbody></table>
      <div class="body"><a class="btn sm ghost"
        href="/admin/arbeitszeit?p=${encodeURIComponent(m.id)}">Alle Zeiten</a>
        <a class="btn sm ghost"
        href="/admin/zeitzettel?p=${encodeURIComponent(m.id)}&m=${esc(monat)}">Stundennachweis</a></div>`
      : '<div class="empty">Noch keine Schichten erfasst.</div>'}
    </div>`;
  }

  if (reiter === 'frei') {
    const jahr = Number(heute.slice(0, 4));
    const konto = urlaubskonto(m, abwesenheiten, jahr);
    const heutigeAbw = abwesenheiten.find(
      a => a.status === STATUS.genehmigt && a.von <= heute && heute <= a.bis);

    const zeile = a => {
      const offen = a.status === STATUS.beantragt;
      const auFehlt = a.art === 'krank' && !a.au_da && auFrist(a.von) < heute;
      return `<tr class="${a.status === STATUS.abgelehnt || a.status === STATUS.storniert ? 'cancelled' : ''}">
        <td class="t">${esc(zeitraum(a.von, a.bis))}</td>
        <td class="nm"><b>${esc(artLabel(a.art))}</b>
          ${a.notiz ? `<div class="meta">${esc(a.notiz)}</div>` : ''}
          ${a.quelle === 'antrag' ? '<div class="meta">selbst beantragt</div>' : ''}
          ${auFehlt ? '<div class="meta"><span class="pill ns">AU-Bescheinigung fehlt</span></div>' : ''}
        </td>
        <td class="num">${a.tage ? esc(String(a.tage)) + (ABW_ARTEN[a.art]?.konto ? ' Urlaubst.' : ' Tage') : '—'}</td>
        <td class="num">${offen ? '<span class="pill">beantragt</span>'
          : a.status === STATUS.abgelehnt ? '<span class="pill">abgelehnt</span>'
          : a.status === STATUS.storniert ? '<span class="pill">storniert</span>'
          : '<span class="meta">gilt</span>'}</td>
        <td class="act">
          ${offen ? `<form method="post" action="/admin/personal" style="display:inline">
              <input type="hidden" name="do" value="abw_status">
              <input type="hidden" name="id" value="${esc(m.id)}">
              <input type="hidden" name="aid" value="${esc(a.id)}">
              <button class="btn sm" name="status" value="genehmigt" type="submit">Genehmigen</button>
              <button class="btn sm danger" name="status" value="abgelehnt" type="submit">Ablehnen</button>
            </form>` : ''}
          ${a.art === 'krank' && !a.au_da ? `<form method="post" action="/admin/personal" style="display:inline">
              <input type="hidden" name="do" value="abw_au">
              <input type="hidden" name="id" value="${esc(m.id)}">
              <input type="hidden" name="aid" value="${esc(a.id)}">
              <button class="btn sm ghost" type="submit">AU liegt vor</button>
            </form>` : ''}
          ${a.status === STATUS.genehmigt ? `<form method="post" action="/admin/personal" style="display:inline"
              onsubmit="return confirm('Diesen Eintrag stornieren?')">
              <input type="hidden" name="do" value="abw_status">
              <input type="hidden" name="id" value="${esc(m.id)}">
              <input type="hidden" name="aid" value="${esc(a.id)}">
              <button class="btn sm danger" name="status" value="storniert" type="submit">Storno</button>
            </form>` : ''}
        </td>
      </tr>`;
    };

    inhalt = !abw ? `<div class="card"><div class="body">
        <p class="meta" style="margin:0">Urlaub und Ausfälle brauchen die Migration
           <code>0025_abwesenheiten.sql</code>. Bitte einspielen, dann steht diese Seite.</p>
      </div></div>` : `
    <div class="card">
      <h2>Urlaubskonto ${jahr}</h2>
      <div class="body">
        <div class="stats" style="margin-bottom:1.2rem">
          <div class="stat"><b>${konto.gesamt}</b><span>Anspruch inkl. Übertrag</span></div>
          <div class="stat"><b>${konto.genommen}</b><span>genommen</span></div>
          <div class="stat"><b>${konto.geplant}</b><span>beantragt</span></div>
          <div class="stat ${konto.rest < 0 ? 'hot' : ''}"><b>${konto.rest}</b><span>noch offen</span></div>
        </div>
        ${heutigeAbw ? `<div class="msg warn"><b>Heute nicht da:</b>
          ${esc(artLabel(heutigeAbw.art))} bis ${esc(zeitraum(heutigeAbw.bis, heutigeAbw.bis))}</div>` : ''}
        ${konto.rest < 0 ? `<div class="msg err">Mehr Urlaub vergeben als Anspruch besteht.
          Entweder ist der Jahresanspruch zu niedrig eingetragen, oder es wurde zu viel genehmigt.</div>` : ''}
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="abw_konto">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="grid">
            <div class="f"><label for="ut">Jahresanspruch in Werktagen</label>
              <input id="ut" name="urlaub_tage" type="number" min="0" max="60"
                     value="${m.urlaub_tage ?? ''}" placeholder="z. B. ${mindestUrlaub(5)}">
              <p class="hint">Gesetzlicher Mindesturlaub nach § 3 BUrlG: ${mindestUrlaub(6)} Werktage bei
                 Sechstagewoche, ${mindestUrlaub(5)} bei Fünftagewoche. Was im Vertrag steht, gilt —
                 sofern es darüber liegt.</p></div>
            <div class="f"><label for="uv">Übertrag aus dem Vorjahr</label>
              <input id="uv" name="urlaub_rest_vj" type="number" min="0" max="60"
                     value="${m.urlaub_rest_vj ?? ''}" placeholder="0">
              <p class="hint">Resturlaub verfällt zum 31.12. nur, wenn rechtzeitig darauf
                 hingewiesen wurde — sonst wandert er hierher.</p></div>
          </div>
          <div class="row end" style="margin-top:1rem"><button class="btn" type="submit">Speichern</button></div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Eintragen</h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Urlaub und Ausfälle trägt <b>nur der Chef</b>
           hier ein — besprochen wird das im Betrieb, nicht über ein Formular. Die Stempeluhr
           unter <code>/zeit</code> kann ausschließlich kommen, Pause und gehen.
           Was hier steht, gilt sofort und wartet auf keine Genehmigung.</p>
        <form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="abw_neu">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="grid">
            <div class="f"><label for="art">Was</label>
              <select id="art" name="art">${Object.entries(ABW_ARTEN).map(([k, v]) =>
                `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
            <div class="f"><label for="von">Von</label>
              <input id="von" name="von" type="date" required value="${esc(heute)}"></div>
            <div class="f"><label for="bis">Bis <span class="meta">einschließlich</span></label>
              <input id="bis" name="bis" type="date" required value="${esc(heute)}"></div>
            <div class="f"><label for="tage">Angerechnete Tage</label>
              <input id="tage" name="tage" type="number" min="0" max="60" placeholder="automatisch">
              <p class="hint">Leer lassen: Werktage Montag–Samstag werden gezählt. Nur überschreiben,
                 wenn es im Einzelfall anders vereinbart ist.</p></div>
            <div class="f full"><label for="anotiz">Anlass <span class="meta">optional, ein Wort</span></label>
              <input id="anotiz" name="notiz" maxlength="80"
                     placeholder="z. B. Heimatbesuch, Umzug, Fortbildung"></div>
          </div>
          <div class="msg warn" style="margin:1.2rem 0 0">
            <b>Bei Krankheit: kein Grund, keine Diagnose.</b> Was der Betrieb wissen darf, ist der
            Zeitraum und ob die Arbeitsunfähigkeitsbescheinigung vorliegt. Alles andere ist
            Gesundheitsdatum nach Art. 9 DSGVO und gehört nicht ins Panel — auch nicht ins
            Anlassfeld.
          </div>
          <div class="row end" style="margin-top:1.2rem">
            <button class="btn" type="submit">Eintragen</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <h2>Bisher <em>${abwesenheiten.length} ${abwesenheiten.length === 1 ? 'Eintrag' : 'Einträge'}</em></h2>
      ${abwesenheiten.length
        ? `<table class="stack"><thead><tr><th>Zeitraum</th><th>Was</th><th class="num">Tage</th>
             <th class="num">Stand</th><th></th></tr></thead>
           <tbody>${abwesenheiten.map(zeile).join('')}</tbody></table>`
        : '<div class="empty">Noch nichts eingetragen.</div>'}
    </div>`;
  }

  if (reiter === 'nachweis') {
    const hinweise = neu ? fristenFuer(m, heute, {
      monatCent: lohn && m.wage_cent ? lohnSum : 0,
      abwesenheiten,
    }) : [];
    const rest = abw ? resturlaubHinweis(
      urlaubskonto(m, abwesenheiten, Number(heute.slice(0, 4))), heute) : null;
    if (rest) hinweise.push(rest);

    inhalt = `
    ${hinweise.length ? `<div class="card">
      <h2>Woran zu denken ist <em>${hinweise.length}</em></h2>
      <div class="body">
        ${hinweise.map(h => `<div class="msg ${h.stufe === 'warn' ? 'warn' : ''}"
             style="margin-bottom:.7rem"><b>${esc(h.kurz)}.</b> ${esc(h.text)}</div>`).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Belehrung nach § 43 IfSG</h2>
      <div class="body">
        <p class="meta" style="margin:0 0 1rem">Wer mit Lebensmitteln arbeitet, braucht die
           Erstbelehrung durch das Gesundheitsamt. Die Wiederholung macht der Betrieb selbst,
           alle zwei Jahre — hier steht nur, wann sie zuletzt war und wann sie wieder ansteht.
           Der Nachweis selbst gehört in den Ordner, nicht ins Panel.</p>
        ${neu ? `<form method="post" action="/admin/personal">
          <input type="hidden" name="do" value="nachweis">
          <input type="hidden" name="id" value="${esc(m.id)}">
          <div class="grid">
            ${feld('belehrung_am', 'Zuletzt belehrt am', m.belehrung_am, { typ: 'date' })}
            ${abw ? feld('vertrag_am', 'Arbeitsvertrag vom', m.vertrag_am, { typ: 'date' }) : ''}
            ${abw ? feld('titel_bis', 'Arbeitserlaubnis gültig bis', m.titel_bis, { typ: 'date' }) : ''}
          </div>
          ${abw ? `<p class="hint" style="margin:.2rem 0 0">Beim Arbeitsvertrag steht hier nur das
             Datum — das Nachweisgesetz verlangt die wesentlichen Bedingungen schriftlich,
             spätestens am ersten Arbeitstag. Das Papier gehört in den Ordner.
             Die Arbeitserlaubnis nur ausfüllen, wenn eine befristete vorliegt; dann warnt die
             Übersicht rechtzeitig vor dem Ablauf.</p>` : ''}
          <div class="f" style="margin-top:1rem">
            <label for="notiz">Notiz <span class="meta">nur für den Chef sichtbar</span></label>
            <textarea id="notiz" name="notiz" rows="4" maxlength="600"
              placeholder="z. B. Führerschein vorhanden, arbeitet freitags nicht"
              >${esc(m.notiz || '')}</textarea>
          </div>
          <div class="row end" style="margin-top:1.2rem">
            <button class="btn" type="submit">Speichern</button>
          </div>
        </form>
        ${b ? `<p class="hint" style="margin:1rem 0 0">${b.stufe === 'faellig'
          ? `<b>Fällig.</b> Die Belehrung ist seit dem ${datumDe(b.ablauf)} abgelaufen.`
          : `Nächste Wiederholung bis <b>${datumDe(b.ablauf)}</b>${
              b.stufe === 'bald' ? ` — das ist in ${b.tage} Tagen.` : '.'}`}</p>` : ''}`
        : '<p class="meta">Migration 0020_personalkarte.sql fehlt noch.</p>'}
      </div>
    </div>

    <div class="card">
      <h2>Was hier bewusst fehlt</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Kein Krankheitsgrund, keine Diagnose, kein Attest als
           Datei.</b> Dass jemand krank ist und wie lange, steht unter „Urlaub &amp; Ausfall" —
           das muss der Betrieb wissen und darf er festhalten. <em>Woran</em> jemand erkrankt
           ist, geht den Arbeitgeber nichts an: Gesundheitsdaten sind nach Art. 9 DSGVO
           besonders geschützt. Deshalb gibt es dafür kein Feld, auch nicht im Anlassfeld.
           Die Bescheinigung selbst gehört in den Ordner, hier steht nur, ob sie da ist.</p>
        <p style="margin:0"><b>Keine Bankverbindung, keine Steuer-ID, keine
           Sozialversicherungsnummer.</b> Die Abrechnung macht der Steuerberater. Jedes Feld,
           das nicht gespeichert wird, muss auch nicht geschützt werden.</p>
      </div>
    </div>`;
  }

  return layout({
    user, title: m.name, active: '/admin/personal',
    body: `<style>${CSS}</style>${kopf}${flash(url)}${inhalt}`,
  });
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const heute = nowBerlin().date;
  const monat = heute.slice(0, 7);

  let team = { leute: [], neu: false, lohn: false, hinweis: '' };
  try {
    team = await liesTeam(db);
  } catch {
    team.hinweis = 'Die Tabelle „staff" fehlt noch — bitte Migration 0007_zeit.sql einspielen.';
  }

  /* Wer ist gerade eingestempelt? */
  let offen = [];
  try {
    offen = (await db.prepare(
      `SELECT staff_id, work_date, start_at FROM shifts WHERE end_at IS NULL`).all()).results || [];
  } catch { /* egal */ }
  const laeuft = Object.fromEntries(offen.map(o => [o.staff_id, o]));

  /* Schichten des laufenden Monats — für die Stundenspalte und die Karte. */
  let schichten = [];
  try {
    schichten = (await db.prepare(
      `SELECT staff_id,work_date,start_at,end_at,break_min,corrected FROM shifts
        WHERE work_date LIKE ?`).bind(monat + '%').all()).results || [];
  } catch { /* egal */ }

  const id = clean(url.searchParams.get('id'), 40);
  const m = id ? team.leute.find(x => x.id === id) : null;

  if (id && !m) return redirect('/admin/personal?err=' + encodeURIComponent('Mitarbeiter nicht gefunden.'));

  if (m) {
    const r = clean(url.searchParams.get('t'), 12);
    const reiter = REITER.some(([k]) => k === r) ? r : 'person';

    /* Trinkgeldanteil des Monats: derselbe Weg wie auf der Trinkgeldseite —
       je Abend wird der Topf nach den gearbeiteten Minuten aufgeteilt. */
    let trinkgeldCent = 0;
    if (reiter === 'zeit') {
      try {
        const toepfe = (await db.prepare(
          `SELECT day, amount_cent FROM tips WHERE day LIKE ?`).bind(monat + '%').all()).results || [];
        const proTag = {};
        for (const s of schichten) {
          const min = summe([s]).gerundet;
          if (!min) continue;
          (proTag[s.work_date] ||= {})[s.staff_id] = (proTag[s.work_date][s.staff_id] || 0) + min;
        }
        for (const t of toepfe) {
          if (!t.amount_cent) continue;
          const leuteTag = Object.entries(proTag[t.day] || {}).map(([sid, minuten]) => ({ id: sid, minuten }));
          trinkgeldCent += verteileTrinkgeld(t.amount_cent, leuteTag)[m.id] || 0;
        }
      } catch { /* Tabelle tips fehlt — dann eben kein Anteil */ }
    }

    let letzte = [];
    if (reiter === 'zeit') {
      try {
        letzte = (await db.prepare(
          `SELECT work_date,start_at,end_at,break_min,corrected FROM shifts
            WHERE staff_id=? ORDER BY work_date DESC, start_at DESC LIMIT 5`).bind(m.id).all()).results || [];
      } catch { /* egal */ }
    }

    let abwesenheiten = [];
    try {
      abwesenheiten = (await db.prepare(
        `SELECT * FROM absences WHERE staff_id=? ORDER BY von DESC`).bind(m.id).all()).results || [];
    } catch { /* Migration 0025 fehlt — der Reiter sagt es dann selbst */ }

    return karteSeite({
      url, user: data?.user, m, reiter, neu: team.neu, lohn: team.lohn, abw: team.abw,
      heute, monat,
      meine: schichten.filter(x => x.staff_id === m.id),
      letzte, trinkgeldCent, laeuft: laeuft[m.id] || null, abwesenheiten,
    });
  }

  /* Wer ist heute nicht da, und was wartet auf eine Entscheidung? */
  let heuteFrei = {}, antraege = [];
  try {
    const f = (await db.prepare(
      `SELECT staff_id, art, von, bis FROM absences
        WHERE status='genehmigt' AND von <= ? AND bis >= ?`).bind(heute, heute).all()).results || [];
    heuteFrei = Object.fromEntries(f.map(a => [a.staff_id, a]));
    antraege = (await db.prepare(
      `SELECT id, staff_id, von, bis, tage FROM absences
        WHERE status='beantragt' ORDER BY von`).all()).results || [];
  } catch { /* Migration 0025 fehlt */ }

  const chefPinGesetzt = !!await gespeicherterPin(db);
  return listeSeite({
    url, user: data?.user, leute: team.leute, hinweis: team.hinweis,
    offen, laeuft, schichten, heute, chefPinGesetzt, lohn: team.lohn,
    heuteFrei, antraege,
  });
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env, data }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  /* Die Adresse der offenen Stempeluhr — steht auf der Karte, die der Chef dem
     Mitarbeiter mit der PIN in die Hand gibt. Aus der Anfrage abgeleitet, damit
     sie auch nach dem Domainumzug stimmt. */
  const uhrAdresse = new URL(request.url).host + '/zeit';
  const db = env.DB;
  const id = clean(d.id, 40);
  const zurueck = (t, ok) => redirect(
    `/admin/personal?id=${encodeURIComponent(id)}&t=${t}` + (ok ? '&ok=' + encodeURIComponent(ok) : ''));
  const fehler = m => redirect((id ? `/admin/personal?id=${encodeURIComponent(id)}&err=` : '/admin/personal?err=')
    + encodeURIComponent(m));
  if (!db) return fehler('Keine Datenbankverbindung.');

  const name = clean(d.name, 60);
  const role = ROLLEN.includes(clean(d.role, 20)) ? clean(d.role, 20) : null;
  const pin  = clean(d.pin, 8).replace(/\D/g, '');
  if (pin && pin.length !== 4) return fehler('Die PIN muss aus genau vier Ziffern bestehen.');

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
      if (neu.length < 4 || neu.length > 6) return fehler('Die Chef-PIN braucht vier bis sechs Ziffern.');
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

  /* Seit es die offene Stempeluhr unter /zeit gibt, ist die PIN nicht mehr nur
     ein Passwort, sondern der Ausweis: Sie sucht die Person. Zwei Leute mit
     derselben PIN wären dort nicht auseinanderzuhalten — deshalb wird beim
     Vergeben geprüft. `wer` ist die Person, die sie behalten darf. */
  const pinVergeben = async (klar, wer) => {
    try {
      const h = await pinHash(klar, env.IP_SALT);
      const r = await db.prepare(
        `SELECT id FROM staff WHERE pin_hash=? AND active=1 AND id<>?`
      ).bind(h, wer || '').first();
      return !!r;
    } catch { return false; }
  };

  try {
    /* --- Anlegen --- */
    if (d.do === 'add') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      const wage = 'wage' in d ? centAus(d.wage) : null;
      if ('wage' in d && String(d.wage || '').trim() && wage === null) {
        return fehler('Stundenlohn bitte als Zahl angeben, z. B. 14,50.');
      }
      let neu = pin;
      if (neu) {
        if (await pinVergeben(neu, null)) {
          return fehler('Diese PIN hat schon jemand. Bitte eine andere wählen.');
        }
      } else {
        /* Zufällig, aber garantiert frei — sonst wäre die Uhr unter /zeit
           nicht mehr eindeutig. */
        for (let i = 0; i < 40 && !neu; i++) {
          const k = String(Math.floor(1000 + Math.random() * 9000));
          if (!await pinVergeben(k, null)) neu = k;
        }
        if (!neu) return fehler('Es ist gerade keine freie PIN zu finden. Bitte eine von Hand vergeben.');
      }
      const max = await db.prepare(`SELECT COALESCE(MAX(sort),0) m FROM staff`).first();
      const nid = crypto.randomUUID();
      const hash = await pinHash(neu, env.IP_SALT);
      const srt = (Number(max?.m) || 0) + 10;
      const jetzt = new Date().toISOString();
      try {
        await db.prepare(
          `INSERT INTO staff (id,name,role,pin_hash,active,sort,created_at,wage_cent)
           VALUES (?,?,?,?,1,?,?,?)`).bind(nid, name, role, hash, srt, jetzt, wage).run();
      } catch {
        await db.prepare(
          `INSERT INTO staff (id,name,role,pin_hash,active,sort,created_at) VALUES (?,?,?,?,1,?,?)`
        ).bind(nid, name, role, hash, srt, jetzt).run();
      }
      return geheimnis({
        user: data?.user, titel: `${name} ist angelegt`,
        zeilen: [['Name', name], ['PIN für die Stempeluhr', neu]],
        hinweis: 'Die PIN wird verschlüsselt gespeichert und lässt sich nicht wieder anzeigen. '
               + 'Vergessen? Einfach eine neue vergeben. Alles Weitere steht auf der Karte. '
               + `Gestempelt wird am Tablet in der Küche — oder mit dem eigenen Telefon unter `
               + `${uhrAdresse} (am besten als Lesezeichen einrichten).`,
        zurueck: `/admin/personal?id=${nid}`,
      });
    }

    if (!id) return fehler('Mitarbeiter nicht gefunden.');

    /* --- Reiter „Person" --- */
    if (d.do === 'person') {
      if (name.length < 2) return fehler('Bitte einen Namen angeben.');
      const sortZahl = parseInt(d.sort, 10);
      const srt = Number.isFinite(sortZahl) ? Math.min(999, Math.max(0, sortZahl)) : 0;
      for (const [k, v] of [['birthday', d.birthday], ['start_date', d.start_date]]) {
        if (String(v || '').trim() && !datumAus(v)) {
          return fehler(`Bitte ein gültiges Datum angeben (${k === 'birthday' ? 'Geburtstag' : 'Eintritt'}).`);
        }
      }
      try {
        await db.prepare(
          `UPDATE staff SET name=?, role=?, sort=?, art=?, phone=?, birthday=?, start_date=?,
                            nk_name=?, nk_phone=? WHERE id=?`
        ).bind(name, role, srt,
          ARTEN.includes(clean(d.art, 20)) ? clean(d.art, 20) : null,
          clean(d.phone, 40) || null, datumAus(d.birthday), datumAus(d.start_date),
          clean(d.nk_name, 80) || null, clean(d.nk_phone, 40) || null, id).run();
      } catch {
        /* Migration 0020 fehlt — dann wenigstens das Alte speichern. */
        await db.prepare(`UPDATE staff SET name=?, role=?, sort=? WHERE id=?`)
          .bind(name, role, srt, id).run();
        return zurueck('person', 'Gespeichert — die zusätzlichen Felder fehlen noch in der Datenbank.');
      }
      return zurueck('person', `${name} gespeichert.`);
    }

    /* --- Reiter „Zeit & Lohn" --- */
    if (d.do === 'zeit') {
      const wage = 'wage' in d ? centAus(d.wage) : undefined;
      if ('wage' in d && String(d.wage || '').trim() && wage === null) {
        return fehler('Stundenlohn bitte als Zahl angeben, z. B. 14,50.');
      }
      if (wage !== undefined) {
        /* Leeres Feld heißt „kein Stundenlohn hinterlegt", nicht „0 €". */
        try { await db.prepare(`UPDATE staff SET wage_cent=? WHERE id=?`).bind(wage, id).run(); }
        catch { /* Spalte fehlt noch */ }
      }
      if (pin) {
        if (await pinVergeben(pin, id)) {
          return fehler('Diese PIN hat schon jemand. Bitte eine andere wählen.');
        }
        const m = await db.prepare(`SELECT name FROM staff WHERE id=?`).bind(id).first();
        await db.prepare(`UPDATE staff SET pin_hash=? WHERE id=?`)
          .bind(await pinHash(pin, env.IP_SALT), id).run();
        return geheimnis({
          user: data?.user, titel: `${m?.name || 'Mitarbeiter'}: neue PIN`,
          zeilen: [['Name', m?.name || ''], ['PIN für die Stempeluhr', pin],
                   ['Stempeln im Netz', uhrAdresse]],
          hinweis: 'Die bisherige PIN gilt nicht mehr.',
          zurueck: `/admin/personal?id=${encodeURIComponent(id)}&t=zeit`,
        });
      }
      const warnung = wage && wage < MINDESTLOHN_CENT
        ? ` Achtung: ${euro(wage)} € liegt unter dem Mindestlohn von ${euro(MINDESTLOHN_CENT)} €.` : '';
      return zurueck('zeit', `Gespeichert.${warnung}`);
    }

    /* --- Reiter „Nachweise & Notizen" --- */
    if (d.do === 'nachweis') {
      for (const [k, l] of [['belehrung_am', 'die Belehrung'], ['vertrag_am', 'den Arbeitsvertrag'],
                            ['titel_bis', 'die Arbeitserlaubnis']]) {
        if (String(d[k] || '').trim() && !datumAus(d[k])) {
          return fehler(`Bitte ein gültiges Datum für ${l} angeben.`);
        }
      }
      const notiz = String(d.notiz ?? '').replace(/\r/g, '').slice(0, 600).trim() || null;
      try {
        await db.prepare(`UPDATE staff SET belehrung_am=?, notiz=?, vertrag_am=?, titel_bis=? WHERE id=?`)
          .bind(datumAus(d.belehrung_am), notiz, datumAus(d.vertrag_am), datumAus(d.titel_bis), id).run();
      } catch {
        /* Migration 0025 fehlt — wenigstens das Alte sichern, statt gar nichts. */
        try {
          await db.prepare(`UPDATE staff SET belehrung_am=?, notiz=? WHERE id=?`)
            .bind(datumAus(d.belehrung_am), notiz, id).run();
          return zurueck('nachweis', 'Gespeichert — Vertrag und Arbeitserlaubnis fehlen noch in der Datenbank.');
        } catch {
          return fehler('Die Felder fehlen noch in der Datenbank — bitte Migration 0020 einspielen.');
        }
      }
      return zurueck('nachweis', 'Gespeichert.');
    }

    /* --- Urlaub und Ausfall ------------------------------------------ */
    if (d.do === 'abw_konto') {
      const zahl = (v, max) => {
        const s = String(v ?? '').trim();
        if (!s) return null;
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : null;
      };
      try {
        await db.prepare(`UPDATE staff SET urlaub_tage=?, urlaub_rest_vj=? WHERE id=?`)
          .bind(zahl(d.urlaub_tage, 60), zahl(d.urlaub_rest_vj, 60), id).run();
      } catch { return fehler('Bitte Migration 0025_abwesenheiten.sql einspielen.'); }
      return zurueck('frei', 'Urlaubskonto gespeichert.');
    }

    if (d.do === 'abw_neu') {
      const art = clean(d.art, 16);
      if (!istArt(art)) return fehler('Unbekannte Art der Abwesenheit.');
      const von = datumAus(d.von), bis = datumAus(d.bis);
      if (!von || !bis) return fehler('Bitte Beginn und Ende angeben.');
      if (bis < von) return fehler('Das Ende liegt vor dem Beginn.');
      /* Eine Grenze gegen Vertipper: „bis 2036" ist kein Urlaub, sondern eine
         verrutschte Jahreszahl — und würde die Jahresübersicht zerlegen. */
      if (werktage(von, bis) > 200) return fehler('Der Zeitraum ist unrealistisch lang — bitte prüfen.');

      const eigen = String(d.tage ?? '').trim();
      const tage = eigen ? Math.min(200, Math.max(0, parseInt(eigen, 10) || 0)) : werktage(von, bis);

      /* Ein Anlassfeld ist kein Diagnosefeld. Der Hinweis steht auf der Seite;
         hier wird die Länge begrenzt, damit niemand einen Arztbericht hineinschreibt. */
      const notiz = clean(d.notiz, 80) || null;

      try {
        const doppelt = await db.prepare(
          `SELECT id FROM absences WHERE staff_id=? AND status IN ('genehmigt','beantragt')
             AND von <= ? AND bis >= ? LIMIT 1`).bind(id, bis, von).first();
        if (doppelt) return fehler('In diesem Zeitraum steht schon eine Abwesenheit. Bitte erst die alte stornieren.');

        await db.prepare(
          `INSERT INTO absences (id,staff_id,art,von,bis,tage,status,notiz,au_bis,au_da,quelle,
                                 entschieden_von,entschieden_am,created_at)
           VALUES (?,?,?,?,?,?, 'genehmigt', ?, NULL, 0, 'chef', ?, ?, ?)`
        ).bind(crypto.randomUUID(), id, art, von, bis, tage, notiz,
               data?.user?.name || 'Chef', new Date().toISOString(), new Date().toISOString()).run();
      } catch { return fehler('Bitte Migration 0025_abwesenheiten.sql einspielen.'); }

      const nachsatz = art === 'krank'
        ? ` Die Arbeitsunfähigkeitsbescheinigung ist ab dem ${(auFrist(von) || '').slice(8)}.`
          + `${(auFrist(von) || '').slice(5, 7)}. fällig (§ 5 EntgFG).`
        : '';
      return zurueck('frei', `${artLabel(art)} vom ${zeitraum(von, bis)} eingetragen.${nachsatz}`);
    }

    if (d.do === 'abw_status') {
      const aid = clean(d.aid, 40);
      const st = clean(d.status, 16);
      if (!['genehmigt', 'abgelehnt', 'storniert'].includes(st)) return fehler('Unbekannter Stand.');
      try {
        await db.prepare(
          `UPDATE absences SET status=?, entschieden_von=?, entschieden_am=?, updated_at=?
            WHERE id=? AND staff_id=?`
        ).bind(st, data?.user?.name || 'Chef', new Date().toISOString(),
               new Date().toISOString(), aid, id).run();
      } catch { return fehler('Das hat nicht geklappt.'); }
      return zurueck('frei', st === 'genehmigt' ? 'Genehmigt.'
        : st === 'abgelehnt' ? 'Abgelehnt. Der Eintrag bleibt stehen, damit man sieht, dass gefragt wurde.'
        : 'Storniert.');
    }

    if (d.do === 'abw_au') {
      const aid = clean(d.aid, 40);
      try {
        await db.prepare(`UPDATE absences SET au_da=1, updated_at=? WHERE id=? AND staff_id=?`)
          .bind(new Date().toISOString(), aid, id).run();
      } catch { return fehler('Das hat nicht geklappt.'); }
      return zurueck('frei', 'Vermerkt: Bescheinigung liegt vor.');
    }

    /* --- Aus- und wieder eintreten --- */
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
      return zurueck('person', an
        ? `${m?.name || 'Mitarbeiter'} ist wieder aktiv.`
        : `${m?.name || 'Mitarbeiter'} ist ausgeschieden. Die Zeiten bleiben gespeichert.${offenerHinweis}`);
    }
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }

  return redirect('/admin/personal');
}
