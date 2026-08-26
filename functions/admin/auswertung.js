/**
 * Auswertung — was die Reservierungen über den Betrieb verraten.
 *
 * Bewusst nur Zahlen, die aus den vorhandenen Daten ehrlich ableitbar sind.
 * Keine Umsatzschätzungen, keine Hochrechnungen: das Reservierungssystem weiß
 * nicht, was am Tisch bestellt wurde.
 *
 * Enthält **keine personenbezogenen Daten** — nur Summen. Deshalb darf auch der
 * Demo-Zugang hier hinein; es ist die Seite, mit der sich GastrOptima zeigen lässt.
 */
import {
  esc, nowBerlin, addDays, diffDays, weekday, WEEKDAY_DE, HOURS,
} from '../_lib/core.js';
import { layout } from '../_lib/ui.js';

const ZEITRAeUME = { 30: 'Letzte 30 Tage', 90: 'Letzte 90 Tage', 365: 'Letzte 12 Monate' };
const MONAT_KURZ = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const proz = (a, b) => b ? Math.round((a / b) * 100) : 0;
const kurzDatum = (d, jahr) => `${d.slice(8)}.${d.slice(5, 7)}.${jahr ? d.slice(0, 4) : ''}`;
const dez = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

/**
 * Balken für eine einzelne Messreihe.
 * Eine Farbe, weil es eine Reihe ist — eine Legende braucht das nicht, die
 * Überschrift benennt sie. Zahlen stehen in normaler Textfarbe, nicht in Weinrot:
 * die Farbe gehört dem Balken, nicht der Schrift.
 */
function balken(zeilen, { einheit = '', leer = 'Noch keine Daten.' } = {}) {
  const werte = zeilen.map(z => z.wert);
  const max = Math.max(1, ...werte);
  if (!zeilen.some(z => z.wert > 0)) return `<div class="empty">${esc(leer)}</div>`;
  return `<div class="bars">
    ${zeilen.map(z => `<div class="bar${z.aus ? ' aus' : ''}"
        title="${esc(z.label)}: ${esc(String(z.wert))}${einheit ? ' ' + esc(einheit) : ''}">
      <span class="bl">${esc(z.label)}</span>
      <span class="bt"><i style="width:${z.wert ? Math.max(2, Math.round(z.wert / max * 100)) : 0}%"></i></span>
      <span class="bv">${z.wert ? esc(String(z.wert)) : '–'}${z.zusatz ? `<em>${esc(z.zusatz)}</em>` : ''}</span>
    </div>`).join('')}
  </div>`;
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const now = nowBerlin();

  const tage = ZEITRAeUME[url.searchParams.get('t')] ? +url.searchParams.get('t') : 90;
  const von = addDays(now.date, -tage);

  let rows = [], warte = [], zu = [];
  let fehler = '';
  try {
    rows = (await db.prepare(
      `SELECT res_date,res_time,guests,status,source,no_show,created_at
         FROM reservations WHERE res_date >= ? AND res_date <= ?
        ORDER BY res_date LIMIT 5000`).bind(von, now.date).all()).results || [];
    warte = (await db.prepare(
      `SELECT status, guests FROM waitlist WHERE res_date >= ? AND res_date <= ?`)
      .bind(von, now.date).all()).results || [];
    zu = (await db.prepare(
      `SELECT day FROM closures WHERE day >= ? AND day <= ?`)
      .bind(von, now.date).all()).results || [];
  } catch {
    fehler = 'Die Zahlen konnten nicht geladen werden.';
  }
  const geschlossen = new Set(zu.map(z => z.day));

  const aktiv = rows.filter(r => r.status === 'confirmed');
  const erschienen = aktiv.filter(r => !r.no_show);
  const gaeste = erschienen.reduce((s, r) => s + r.guests, 0);
  const noShow = aktiv.filter(r => r.no_show);
  const storno = rows.filter(r => r.status === 'cancelled');
  const online = rows.filter(r => r.source === 'web');
  const schnitt = erschienen.length ? gaeste / erschienen.length : 0;

  /* --- Wochentage --- */
  const wtGaeste = Array(7).fill(0), wtTage = Array(7).fill(0);
  for (const r of erschienen) wtGaeste[weekday(r.res_date)] += r.guests;
  /* Nur wirklich geöffnete Tage zählen — Ruhetag und Betriebsferien würden den
     Durchschnitt sonst nach unten ziehen und die Zeile wäre schlicht falsch. */
  for (let i = 0; i <= tage; i++) {
    const d = addDays(von, i);
    if (!HOURS[weekday(d)] || geschlossen.has(d)) continue;
    wtTage[weekday(d)]++;
  }
  const wochentage = [1, 2, 3, 4, 5, 6, 0].map(i => ({
    label: WEEKDAY_DE[i].slice(0, 2),
    wert: wtGaeste[i],
    aus: !HOURS[i],
    zusatz: !HOURS[i] ? 'Ruhetag' : (wtTage[i] ? `Ø ${dez(wtGaeste[i] / wtTage[i])}` : ''),
  }));

  /* --- Uhrzeiten --- */
  const zeiten = {};
  for (const r of erschienen) zeiten[r.res_time] = (zeiten[r.res_time] || 0) + r.guests;
  const uhrzeiten = Object.keys(zeiten).sort().map(t => ({ label: t, wert: zeiten[t] }));

  /* --- Monate --- */
  const monate = {};
  for (const r of erschienen) {
    const m = r.res_date.slice(0, 7);
    monate[m] = (monate[m] || 0) + r.guests;
  }
  const monatsReihe = Object.keys(monate).sort().map(m => ({
    label: `${MONAT_KURZ[+m.slice(5) - 1]} ${m.slice(2, 4)}`,
    wert: monate[m],
  }));

  /* --- Gruppengrößen --- */
  const koerbe = [[1, 2, '1–2'], [3, 4, '3–4'], [5, 6, '5–6'], [7, 99, '7 und mehr']];
  const gruppen = koerbe.map(([a, b, label]) => ({
    label, wert: erschienen.filter(r => r.guests >= a && r.guests <= b).length,
  }));

  /* --- Vorlauf: wie lange vorher wird gebucht? --- */
  const vorlaufKoerbe = [[0, 0, 'selber Tag'], [1, 2, '1–2 Tage'], [3, 7, '3–7 Tage'],
                         [8, 28, '1–4 Wochen'], [29, 9999, 'länger']];
  const vorlauf = vorlaufKoerbe.map(([a, b, label]) => ({
    label,
    wert: erschienen.filter(r => {
      const d = diffDays(String(r.created_at).slice(0, 10), r.res_date);
      return d >= a && d <= b;
    }).length,
  }));

  const wOffen = warte.filter(w => w.status === 'offen').length;
  const wErledigt = warte.filter(w => w.status === 'erledigt').length;

  const auswahl = `<div class="ktabs">
    ${Object.entries(ZEITRAeUME).map(([k, l]) =>
      `<a href="/admin/auswertung?t=${k}" class="ktab ${+k === tage ? 'on' : ''}">${esc(l)}</a>`).join('')}
  </div>`;

  const duenn = erschienen.length < 20;

  const body = `
    <h1>Auswertung</h1>
    <p class="sub">${esc(ZEITRAeUME[tage])} · ${esc(kurzDatum(von, von.slice(0, 4) !== now.date.slice(0, 4)))}
       bis ${esc(kurzDatum(now.date, true))} — spätere Reservierungen zählen erst mit, wenn ihr Tag da ist.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}

    ${auswahl}

    ${duenn ? `<div class="msg warn">
      <b>Noch zu wenig Daten für belastbare Aussagen.</b> Bisher liegen
      ${erschienen.length} ${erschienen.length === 1 ? 'Reservierung' : 'Reservierungen'} in diesem
      Zeitraum. Aussagekräftig wird die Seite nach etwa vier bis sechs Wochen im Betrieb —
      vorher sind einzelne Abende zu stark im Gewicht.</div>` : ''}

    <div class="stats">
      <div class="stat hot"><b>${gaeste}</b><span>Gäste</span></div>
      <div class="stat"><b>${erschienen.length}</b><span>Reservierungen</span></div>
      <div class="stat"><b>${dez(schnitt)}</b><span>Ø Personen je Tisch</span></div>
      <div class="stat ${noShow.length ? 'hot' : ''}"><b>${proz(noShow.length, aktiv.length)}&thinsp;%</b><span>nicht erschienen</span></div>
      <div class="stat"><b>${proz(storno.length, rows.length)}&thinsp;%</b><span>storniert</span></div>
      <div class="stat"><b>${proz(online.length, rows.length)}&thinsp;%</b><span>online gebucht</span></div>
    </div>

    <div class="card">
      <h2>Gäste nach Wochentag <em>Ø je geöffnetem Tag in Klammern</em></h2>
      <div class="body">${balken(wochentage, { einheit: 'Gäste' })}</div>
    </div>

    <div class="card">
      <h2>Gäste nach Uhrzeit <em>wann der Abend seinen Druck hat</em></h2>
      <div class="body">${balken(uhrzeiten, { einheit: 'Gäste' })}</div>
    </div>

    ${monatsReihe.length > 1 ? `<div class="card">
      <h2>Verlauf <em>Gäste je Monat</em></h2>
      <div class="body">${balken(monatsReihe, { einheit: 'Gäste' })}</div>
    </div>` : ''}

    <div class="card">
      <h2>Gruppengrößen <em>Reservierungen nach Personenzahl</em></h2>
      <div class="body">
        ${balken(gruppen)}
        <p class="hint" style="margin-top:1rem">Sagt, welche Tische wirklich gebraucht werden.
           Überwiegen Zweier- und Vierertische, bringen zwei Vierer mehr als ein Achter.</p>
      </div>
    </div>

    <div class="card">
      <h2>Vorlauf <em>wie lange vorher reserviert wird</em></h2>
      <div class="body">
        ${balken(vorlauf)}
        <p class="hint" style="margin-top:1rem">Wichtig für Erinnerungen: Wer erst am selben Tag
           bucht, braucht keine Erinnerung am Vortag.</p>
      </div>
    </div>

    <div class="card">
      <h2>Warteliste</h2>
      <div class="body">
        ${warte.length ? `<div class="stats" style="margin-bottom:0">
            <div class="stat"><b>${warte.length}</b><span>Anfragen</span></div>
            <div class="stat"><b>${wErledigt}</b><span>daraus ein Tisch geworden</span></div>
            <div class="stat"><b>${wOffen}</b><span>noch offen</span></div>
          </div>`
        : '<div class="empty">Noch niemand auf der Warteliste in diesem Zeitraum.</div>'}
      </div>
    </div>

    <div class="card">
      <h2>Wie diese Zahlen zu lesen sind</h2>
      <div class="body meta">
        <p style="margin:0 0 .6rem">Gezählt werden <b>nur Reservierungen</b> — Laufkundschaft
           ohne Tischbestellung taucht hier nicht auf. „Gäste" heißt: angemeldete Personen,
           abzüglich der als „nicht erschienen" markierten.</p>
        <p style="margin:0 0 .6rem">Es gibt hier bewusst <b>keine Umsatzzahlen</b>. Das
           Reservierungssystem weiß nicht, was am Tisch bestellt wurde — jede Hochrechnung wäre
           geraten.</p>
        <p style="margin:0">Die Seite enthält keine Namen und keine Kontaktdaten, nur Summen.</p>
      </div>
    </div>`;

  return layout({ user: data?.user, title: 'Auswertung', active: '/admin/auswertung', body });
}
