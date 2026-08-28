/**
 * Hygiene — die tägliche Eigenkontrolle.
 *
 * ── Für welche Situation das gebaut ist ───────────────────────────────
 * Jemand steht um halb fünf in der Küche, hat ein Thermometer in der einen
 * und das Tablet in der anderen Hand, und will das in zwei Minuten hinter
 * sich haben. Daraus folgt alles:
 *
 *   * **Eine Seite, ein Tag.** Kein Suchen, kein Filtern. Was heute noch
 *     offen ist, steht oben und wird mitgezählt.
 *   * **Ein Feld je Gerät, direkt in der Zeile.** Zahl eintippen, Haken.
 *     Bei der Reinigung genügt ein Knopf.
 *   * **Die Ampel entscheidet die Seite, nicht der Mensch.** Wer 8,2 °C in
 *     einen Kühlschrank mit Grenzwert 7,0 einträgt, bekommt sofort Rot — und
 *     die Seite lässt den Eintrag erst zu, wenn danebensteht, was getan wurde.
 *
 * ── Warum die Maßnahme erzwungen wird ─────────────────────────────────
 * Eine Aufzeichnung, in der nur „8,2 °C" steht, ist bei einer Kontrolle
 * schlimmer als gar keine: Sie belegt, dass die Abweichung bemerkt wurde, und
 * lässt offen, ob jemand reagiert hat. Art. 5 VO (EG) 852/2004 verlangt
 * Korrekturmaßnahmen, wenn ein kritischer Grenzwert überschritten ist.
 * Deshalb geht ein roter Wert ohne Maßnahme hier nicht in die Datenbank.
 *
 * ── Was diese Seite nicht ist ─────────────────────────────────────────
 * Kein HACCP-Konzept. Ein Konzept beschreibt Gefahren, Lenkungspunkte und
 * Grenzwerte des konkreten Betriebs; das schreibt der Betrieb, nicht eine
 * Software. Diese Seite führt die Aufzeichnungen dazu — und druckt sie aus.
 */
import { clean, esc, nowBerlin, addDays, formatDateDE } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import { WARE_CSS } from '../_lib/warenui.js';
import { tempAus, grad, kennung, istTag } from '../_lib/ware.js';
import { darfSchreiben } from '../_lib/auth.js';

const ARTEN = {
  kuehl:     { label: 'Kühlung',        gruppe: 'temp', einheit: '°C' },
  tk:        { label: 'Tiefkühlung',    gruppe: 'temp', einheit: '°C' },
  heiss:     { label: 'Heißhaltung',    gruppe: 'temp', einheit: '°C' },
  fett:      { label: 'Frittierfett',   gruppe: 'haken' },
  reinigung: { label: 'Reinigung',      gruppe: 'haken' },
};

const istTemp = p => ARTEN[p.art]?.gruppe === 'temp';

/** Montag der Woche — für Punkte, die nur wöchentlich fällig sind. */
function wochenStart(d) {
  const [y, m, t] = d.split('-').map(Number);
  const wt = new Date(Date.UTC(y, m - 1, t)).getUTCDay();
  return addDays(d, wt === 0 ? -6 : 1 - wt);
}

/**
 * Liegt der Messwert im Rahmen?
 * @returns {boolean|null} null = keine Grenze hinterlegt, also nicht beurteilbar
 */
function imRahmen(p, zehntel) {
  if (zehntel === null || zehntel === undefined) return null;
  if (p.max_zehntel !== null && p.max_zehntel !== undefined && zehntel > p.max_zehntel) return false;
  if (p.min_zehntel !== null && p.min_zehntel !== undefined && zehntel < p.min_zehntel) return false;
  if ((p.max_zehntel === null || p.max_zehntel === undefined) &&
      (p.min_zehntel === null || p.min_zehntel === undefined)) return null;
  return true;
}

const grenzText = p => {
  const hatMax = p.max_zehntel !== null && p.max_zehntel !== undefined;
  const hatMin = p.min_zehntel !== null && p.min_zehntel !== undefined;
  if (hatMax && hatMin) return `${grad(p.min_zehntel)} bis ${grad(p.max_zehntel)}`;
  if (hatMax) return `höchstens ${grad(p.max_zehntel)}`;
  if (hatMin) return `mindestens ${grad(p.min_zehntel)}`;
  return '—';
};

/* ------------------------------------------------------------------ */

const CSS = `
.hrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.8rem 1rem;
  align-items:center;padding:.85rem 1.1rem;border-bottom:1px solid var(--sand)}
.hrow:last-child{border-bottom:0}
.hrow.offen{background:rgba(154,98,18,.05)}
.hrow.rot{background:rgba(109,24,38,.06)}
.hrow .was b{display:block;line-height:1.25}
.hrow .was span{display:block;font-size:.8rem;color:var(--muted)}
.hrow form{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.hrow input[type=text]{width:5.4rem;font:inherit;text-align:right;padding:.55rem .6rem;
  border:1px solid var(--sand);border-radius:var(--r);background:#fff;font-variant-numeric:tabular-nums}
.hrow input[type=text]:focus{outline:0;border-color:var(--wine)}
.hrow .fertig{display:flex;align-items:center;gap:.6rem;font-variant-numeric:tabular-nums}
.hrow .fertig b{font-size:1.05rem}
.wert-rot{color:var(--wine)}
.massn{grid-column:1/-1;background:var(--cream);border:1px solid var(--wine);
  padding:.9rem 1rem;border-radius:var(--r)}
.massn p{margin:0 0 .7rem;font-size:.88rem}
.massn .zeile{display:flex;gap:.5rem;flex-wrap:wrap}
.massn input[name=massnahme]{flex:1;min-width:220px;font:inherit;padding:.55rem .6rem;
  border:1px solid var(--sand);border-radius:var(--r);background:#fff}
.tagleiste{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:0 0 1.2rem}
@media(max-width:560px){
  .hrow{grid-template-columns:1fr}
  .hrow form{justify-content:flex-start}
}
`;

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const rolle = data?.user?.role || 'chef';
  const darf = darfSchreiben(rolle);
  const heute = nowBerlin().date;

  const tRoh = clean(url.searchParams.get('t'), 10);
  const tag = istTag(tRoh) && tRoh <= heute ? tRoh : heute;
  const woche = wochenStart(tag);

  let punkte = [], eintraege = [], fehlt = '';
  try {
    punkte = (await db.prepare(
      `SELECT id,art,name,min_zehntel,max_zehntel,takt,sort FROM hygiene_punkte
        WHERE active=1 ORDER BY sort, name`).all()).results || [];
    /* Wöchentliche Punkte gelten für die ganze Woche — sonst stünde ab
       Dienstag „offen", obwohl montags geputzt wurde. */
    eintraege = (await db.prepare(
      `SELECT punkt_id,tag,temp_zehntel,ok,massnahme,wer FROM hygiene_log
        WHERE tag BETWEEN ? AND ?`).bind(woche, addDays(woche, 6)).all()).results || [];
  } catch {
    fehlt = 'Die Hygiene-Kontrolle fehlt noch in der Datenbank — bitte Migration '
          + '0022_hygiene.sql einspielen.';
  }

  const erledigt = p => p.takt === 'woechentlich'
    ? eintraege.find(e => e.punkt_id === p.id)
    : eintraege.find(e => e.punkt_id === p.id && e.tag === tag);

  const offen = punkte.filter(p => !erledigt(p));
  const abweichungen = eintraege.filter(e => !e.ok && (e.tag === tag || true));

  /* Ein roter Wert wartet auf seine Maßnahme: die Seite kommt mit ?fix=… und
     dem gemessenen Wert zurück und zeigt genau in dieser Zeile das Feld. */
  const fixId = clean(url.searchParams.get('fix'), 40);
  /* Der gemessene Wert kommt so zurück, wie er getippt wurde („9,1") — das
     Formular schickt ihn unverändert weiter, damit ihn niemand neu eintippen
     muss. Für die Anzeige wird er formatiert, nicht zum Speichern. */
  const fixWert = clean(url.searchParams.get('wert'), 10);
  const fixZehntel = tempAus(fixWert);

  const zeile = p => {
    const e = erledigt(p);
    const art = ARTEN[p.art] || ARTEN.reinigung;
    const rot = e && !e.ok;
    const fix = darf && fixId === p.id;
    return `<div class="hrow${fix || rot ? ' rot' : (e ? '' : ' offen')}">
      <div class="was">
        <b>${esc(p.name)}</b>
        <span>${esc(art.label)}${istTemp(p) ? ` · ${esc(grenzText(p))}` : ''}${
          p.takt === 'woechentlich' ? ' · wöchentlich' : ''}</span>
        ${e && e.massnahme ? `<span class="wert-rot">Maßnahme: ${esc(e.massnahme)}</span>` : ''}
      </div>

      ${e ? `<div class="fertig">
        ${istTemp(p) && e.temp_zehntel !== null && e.temp_zehntel !== undefined
          ? `<b class="${e.ok ? '' : 'wert-rot'}">${esc(grad(e.temp_zehntel))}</b>` : ''}
        <span class="ampel ${e.ok ? 'gut' : 'schlecht'}">${e.ok ? 'in Ordnung' : 'Abweichung'}</span>
        <span class="meta">${esc((e.tag !== tag ? e.tag.slice(8) + '.' + e.tag.slice(5, 7) + '. · ' : '')
          + (e.wer || ''))}</span>
      </div>`
      : (darf ? `<form method="post" action="/admin/hygiene">
        <input type="hidden" name="do" value="erfassen">
        <input type="hidden" name="id" value="${esc(p.id)}">
        <input type="hidden" name="t" value="${tag}">
        ${istTemp(p)
          ? `<input type="text" name="wert" inputmode="decimal" maxlength="7"
                    placeholder="°C" aria-label="Temperatur ${esc(p.name)}" required>
             <button class="btn sm" type="submit">Eintragen</button>`
          : `<button class="btn sm" type="submit" name="wert" value="">Erledigt</button>
             <button class="btn sm danger" type="submit" name="abweichung" value="1"
               >Nicht erledigt</button>`}
      </form>` : '<span class="meta">offen</span>')}

      ${fix ? `<div class="massn">
        <p><b>${fixZehntel !== null ? `${esc(grad(fixZehntel))} liegt außerhalb des Rahmens (${esc(grenzText(p))}).`
                        : 'Nicht erledigt.'}</b>
           Bitte eintragen, was daraufhin getan wurde — ohne diese Angabe wird nichts
           gespeichert. Eine Aufzeichnung, die nur die Abweichung festhält, ist bei einer
           Kontrolle schlechter als keine.</p>
        <form method="post" action="/admin/hygiene" class="zeile">
          <input type="hidden" name="do" value="erfassen">
          <input type="hidden" name="id" value="${esc(p.id)}">
          <input type="hidden" name="t" value="${tag}">
          <input type="hidden" name="wert" value="${esc(fixWert)}">
          <input type="hidden" name="abweichung" value="1">
          <input name="massnahme" maxlength="120" required autofocus
                 placeholder="z. B. Ware umgelagert, Gerät nachjustiert, Techniker bestellt">
          <button class="btn sm" type="submit">Speichern</button>
        </form>
      </div>` : ''}
    </div>`;
  };

  const gruppe = (titel, filter, hinweis) => {
    const teil = punkte.filter(filter);
    if (!teil.length) return '';
    return `<div class="card">
      <h2>${esc(titel)}<em>${teil.filter(p => !erledigt(p)).length} offen</em></h2>
      ${hinweis ? `<div class="body" style="padding-bottom:0"><p class="meta"
        style="margin:0">${hinweis}</p></div>` : ''}
      ${teil.map(zeile).join('')}
    </div>`;
  };

  const body = `<style>${WARE_CSS}${CSS}</style>
    <h1>Hygiene-Kontrolle</h1>
    <p class="sub">Die tägliche Eigenkontrolle: Temperaturen, Frittierfett, Reinigung.
       Für die Ablage: <a href="/admin/hygieneblatt?m=${tag.slice(0, 7)}">Kontrollblatt drucken</a>.</p>
    ${fehlt ? `<div class="msg err">${esc(fehlt)}</div>` : ''}
    ${flash(url)}

    <div class="tagleiste">
      <a class="btn sm ghost" href="/admin/hygiene?t=${addDays(tag, -1)}">← Vortag</a>
      ${tag !== heute ? `<a class="btn sm ghost" href="/admin/hygiene">Heute</a>
        <a class="btn sm ghost" href="/admin/hygiene?t=${addDays(tag, 1)}">Folgetag →</a>` : ''}
      <span class="meta">${esc(formatDateDE(tag))}</span>
    </div>

    <div class="stats">
      <div class="stat${offen.length ? ' hot' : ''}"><b>${offen.length}</b><span>noch offen</span></div>
      <div class="stat"><b>${punkte.length - offen.length}</b><span>erledigt</span></div>
      <div class="stat${abweichungen.length ? ' hot' : ''}"><b>${abweichungen.length}</b>
        <span>Abweichung diese Woche</span></div>
    </div>

    ${gruppe('Temperaturen', p => istTemp(p),
      'Gemessen wird im Betrieb, nicht am Anzeigedisplay — ein Thermometer im Gerät zeigt '
      + 'die Luft, nicht das Lebensmittel.')}
    ${gruppe('Frittierfett', p => p.art === 'fett', '')}
    ${gruppe('Reinigung', p => p.art === 'reinigung',
      'Wöchentliche Punkte gelten für die ganze Woche und verschwinden nach dem Eintrag '
      + 'bis Montag aus der Liste.')}

    <details class="card">
      <summary>Was rechtlich dahintersteht</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem">Nach <b>Art. 5 VO (EG) 852/2004</b> muss jeder
          Lebensmittelbetrieb ein Verfahren nach HACCP-Grundsätzen einrichten und die
          Aufzeichnungen dazu aufbewahren. Dazu gehören die Überwachung der kritischen
          Punkte — in einer Küche vor allem die Kühlkette — und <b>Korrekturmaßnahmen</b>,
          wenn ein Grenzwert überschritten ist. Genau deshalb verlangt diese Seite bei
          einer Abweichung eine Angabe, was getan wurde.</p>
        <p style="margin:0 0 .6rem">Die Grenzwerte stammen aus der <b>DIN 10508</b>
          (Temperaturen für Lebensmittel): leicht Verderbliches bei +7 °C oder kälter,
          Tiefkühlware bei −18 °C oder kälter, Heißhalten bei +65 °C oder wärmer. Eine DIN
          ist keine Rechtsnorm, sondern eine anerkannte Regel der Technik — produktbezogen
          strengere Werte stehen in der <b>VO (EG) 853/2004</b> und werden beim
          <a href="/admin/ware">Wareneingang</a> geprüft.</p>
        <p style="margin:0"><b>Diese Seite ist kein HACCP-Konzept.</b> Ein Konzept
          beschreibt die Gefahren, Lenkungspunkte und Grenzwerte dieses Betriebs; das
          schreibt der Betrieb, nicht eine Software. Hier werden die Aufzeichnungen dazu
          geführt. Die Prüfpunkte und Grenzwerte oben sind eine Startaufstellung und
          gehören einmal mit der Lebensmittelüberwachung des Landkreises abgeglichen.</p>
      </div>
    </details>`;

  return layout({ user: data?.user, title: 'Hygiene-Kontrolle',
                  active: '/admin/hygiene', body });
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env, data }) {
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }
  const db = env.DB;
  const rolle = data?.user?.role || 'chef';
  const heute = nowBerlin().date;
  const tag = istTag(clean(d.t, 10)) && clean(d.t, 10) <= heute ? clean(d.t, 10) : heute;
  const zu = (q = '') => `/admin/hygiene?t=${tag}${q}`;
  const fehler = m => redirect(zu('&err=' + encodeURIComponent(m)));

  if (!db) return fehler('Keine Datenbankverbindung.');
  if (!darfSchreiben(rolle)) return fehler('Der Demo-Zugang kann nichts speichern.');
  if (d.do !== 'erfassen') return redirect(zu());

  const id = clean(d.id, 40);
  if (!id) return fehler('Prüfpunkt nicht gefunden.');

  try {
    const p = await db.prepare(
      `SELECT id,art,name,min_zehntel,max_zehntel,takt FROM hygiene_punkte WHERE id=? AND active=1`)
      .bind(id).first();
    if (!p) return fehler('Prüfpunkt nicht gefunden.');

    let zehntel = null;
    if (istTemp(p)) {
      zehntel = tempAus(d.wert);
      if (zehntel === null) return fehler('Bitte eine Temperatur angeben, z. B. 4,5.');
      if (zehntel < -400 || zehntel > 1200) {
        return fehler('Der Wert wirkt wie ein Tippfehler — bitte prüfen.');
      }
    }

    const rahmen = istTemp(p) ? imRahmen(p, zehntel) : null;
    const abweichung = d.abweichung === '1' || rahmen === false;
    const massnahme = clean(d.massnahme, 120);

    /* Kein roter Wert ohne Maßnahme. Die Seite kommt mit dem gemessenen Wert
       zurück und fragt danach — der Wert geht dabei nicht verloren. */
    if (abweichung && !massnahme) {
      return redirect(zu(`&fix=${encodeURIComponent(p.id)}`
        + (istTemp(p) ? `&wert=${encodeURIComponent(clean(d.wert, 10))}` : '')));
    }

    /* Zweimal am selben Tag denselben Punkt: der neue Eintrag ersetzt den
       alten. Zwei Zeilen für dieselbe Messung wären im Blatt eine Frage, die
       niemand beantworten kann. */
    await db.prepare(`DELETE FROM hygiene_log WHERE punkt_id=? AND tag=?`).bind(p.id, tag).run();
    await db.prepare(
      `INSERT INTO hygiene_log (id,punkt_id,tag,temp_zehntel,ok,massnahme,wer,erfasst_at)
       VALUES (?,?,?,?,?,?,?,?)`)
      .bind(kennung('h'), p.id, tag, zehntel, abweichung ? 0 : 1,
            massnahme || null, clean(data?.user?.name, 60) || null, new Date().toISOString())
      .run();

    return redirect(zu(), abweichung
      ? `${p.name}: Abweichung mit Maßnahme festgehalten.`
      : `${p.name} eingetragen.`);
  } catch {
    return fehler('Das hat nicht geklappt. Bitte noch einmal versuchen.');
  }
}
