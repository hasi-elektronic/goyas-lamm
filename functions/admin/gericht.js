/**
 * Ein Gericht im Detail pflegen — Kennzeichnung und Erzählung.
 *
 * Aufruf: `/admin/gericht?id=steak-1-2`, verlinkt aus der Speisekarte.
 *
 * ── Warum die Freigabe ein eigener Schritt ist ────────────────────────
 * Häkchen setzen und Freigeben sind zwei verschiedene Dinge. Man kann eine
 * Liste anfangen, unterbrochen werden und morgen weitermachen — solange die
 * Freigabe fehlt, sieht der Gast **nichts** davon. Erst wer bestätigt „ich
 * habe das gegen die Rezeptur und die Produktangaben geprüft", schaltet die
 * Angabe für den Gast frei.
 *
 * Das ist keine Förmlichkeit. Wer Erdnuss oder Gluten nicht verträgt,
 * verlässt sich auf diese Angabe. Eine halbfertige Liste, die schon öffentlich
 * ist, wäre schlimmer als gar keine, weil sie Sicherheit vortäuscht.
 *
 * Wird nach der Freigabe etwas geändert, erlischt sie automatisch und muss
 * neu erteilt werden — sonst würde eine alte Bestätigung eine neue Aussage
 * decken.
 *
 * ── Was hier NICHT steht ──────────────────────────────────────────────
 * Nährwerte. Für Gastronomie nicht vorgeschrieben, ohne Rezeptur mit
 * Gramm-Mengen nicht seriös zu rechnen — und auf der Karte eines Steakhauses
 * ein Fremdkörper. Bewusst weggelassen, nicht vergessen.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash, redirect } from '../_lib/ui.js';
import {
  ALLERGENE, ZUSATZSTOFFE, MARKEN,
  allergenListe, zusatzListe, markenListe,
} from '../_lib/kennzeichnung.js';

const MIGRATION = 'Die Detailspalten fehlen noch — bitte Migration '
  + '0016_gericht_details.sql einspielen.';

const SPALTEN = `id,group_id,name,descr,price,active,bild,
  allergene,zusatz,marken,kennz_ok,kennz_am,kennz_von,
  herkunft,herkunft_en,reifung,reifung_en,garstufe,garstufe_en,
  wein,geschichte,geschichte_en`;

/* ------------------------------------------------------------------ */

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;
  const id = clean(url.searchParams.get('id'), 60);
  if (!id) return redirect('/admin/karte', 'Kein Gericht angegeben.');

  let g = null, gruppe = null, tab = null, fehler = '';
  try {
    g = await db.prepare(`SELECT ${SPALTEN} FROM menu_items WHERE id = ?`).bind(id).first();
    if (g) {
      gruppe = await db.prepare(
        `SELECT g.title, g.tab_id, t.title AS tab FROM menu_groups g
           JOIN menu_tabs t ON t.id = g.tab_id WHERE g.id = ?`).bind(g.group_id).first();
      tab = gruppe?.tab_id || null;
    }
  } catch { fehler = MIGRATION; }

  if (!g && !fehler) return redirect('/admin/karte', 'Dieses Gericht gibt es nicht (mehr).');
  if (!g) g = { id, name: '—' };

  const al = new Set(allergenListe(g.allergene));
  const zu = new Set(zusatzListe(g.zusatz));
  const mk = new Set(markenListe(g.marken));

  const kaestchen = (feld, wert, label, an) => `
    <label class="check"><input type="checkbox" name="${feld}" value="${esc(String(wert))}"
      ${an ? 'checked' : ''}><span>${label}</span></label>`;

  const textfeld = (feld, label, wert, hinweis, lang = false) => `
    <div class="f${lang ? ' full' : ''}"><label for="${feld}">${esc(label)}</label>
      ${lang
        ? `<textarea id="${feld}" name="${feld}" maxlength="600"
             placeholder="${esc(hinweis || '')}">${esc(wert || '')}</textarea>`
        : `<input id="${feld}" name="${feld}" maxlength="200" value="${esc(wert || '')}"
             placeholder="${esc(hinweis || '')}">`}
    </div>`;

  const zurueck = `/admin/karte${tab ? '?t=' + encodeURIComponent(tab) : ''}`;

  const body = `
    <h1>${esc(g.name)}</h1>
    <p class="sub">${gruppe ? esc(gruppe.tab) + ' · ' + esc(gruppe.title) : ''}${
      g.descr ? ' — ' + esc(g.descr) : ''}</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="${esc(zurueck)}">← Speisekarte</a>
      <a class="btn ghost" href="/karte" target="_blank" rel="noopener">Karte ansehen</a>
      <span class="spacer"></span>
      ${g.kennz_ok
        ? `<span class="pill web">Kennzeichnung freigegeben${
            g.kennz_am ? ' am ' + esc(g.kennz_am) : ''}${
            g.kennz_von ? ' von ' + esc(g.kennz_von) : ''}</span>`
        : '<span class="pill walk">Noch nicht freigegeben — der Gast sieht nichts davon</span>'}
    </div>

    <form method="post" action="/admin/gericht">
      <input type="hidden" name="id" value="${esc(g.id)}">

      <div class="card">
        <h2>Kennzeichen <em>freiwillig, ohne rechtliche Wirkung</em></h2>
        <div class="body">
          ${Object.entries(MARKEN).map(([k, v]) =>
            kaestchen('marke', k, `${v.zeichen} <b>${esc(v.de)}</b>`, mk.has(k))).join('')}
          <p class="hint" style="margin-top:.8rem">Erscheinen als kleines Zeichen am Gericht
            und ausgeschrieben in der Detailtafel. <b>„Glutenfrei" und „laktosefrei" gibt es
            hier bewusst nicht</b> — das sind rechtlich geschützte Aussagen mit Grenzwerten,
            die eine Küche ohne getrennte Zubereitung nicht halten kann.</p>
        </div>
      </div>

      <div class="card">
        <h2>Allergene <em>die 14 kennzeichnungspflichtigen</em></h2>
        <div class="body">
          <div class="grid">
            ${Object.entries(ALLERGENE).map(([k, v]) =>
              `<div>${kaestchen('allergen', k,
                `<b>${k.toUpperCase()}</b> ${esc(v.de)}`, al.has(k))}</div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Zusatzstoffe <em>die 14 Funktionsklassen</em></h2>
        <div class="body">
          <div class="grid">
            ${Object.entries(ZUSATZSTOFFE).map(([k, v]) =>
              `<div>${kaestchen('zusatz', k,
                `<b>${k}</b> ${esc(v.de)}`, zu.has(Number(k)))}</div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Erzählung <em>was das Gericht besonders macht</em></h2>
        <div class="body">
          <div class="grid">
            ${textfeld('herkunft', 'Herkunft', g.herkunft,
              'z. B. Rind aus Baden-Württemberg, zerlegt von der Metzgerei Seyb')}
            ${textfeld('herkunft_en', 'Herkunft (englisch)', g.herkunft_en, '')}
            ${textfeld('reifung', 'Reifung', g.reifung, 'z. B. 28 Tage am Knochen gereift')}
            ${textfeld('reifung_en', 'Reifung (englisch)', g.reifung_en, '')}
            ${textfeld('garstufe', 'Empfehlung', g.garstufe, 'z. B. medium rare')}
            ${textfeld('garstufe_en', 'Empfehlung (englisch)', g.garstufe_en, '')}
            ${textfeld('wein', 'Dazu passt', g.wein,
              'z. B. Lemberger, Weingut Allmendinger — Name, wird nicht übersetzt')}
            <div class="f"></div>
            ${textfeld('geschichte', 'Aus unserer Küche', g.geschichte,
              'Zwei, drei Sätze — woher das Rezept kommt, was daran von Hand gemacht ist.', true)}
            ${textfeld('geschichte_en', 'Aus unserer Küche (englisch)', g.geschichte_en, '', true)}
          </div>
          <p class="hint" style="margin-top:.9rem">Leere Felder erscheinen gar nicht.
            Fehlt die englische Fassung, steht dort der deutsche Text — besser als eine
            leere Zeile.</p>
        </div>
      </div>

      <div class="card">
        <h2>Freigabe</h2>
        <div class="body">
          <label class="check"><input type="checkbox" name="freigabe" value="1"
            ${g.kennz_ok ? 'checked' : ''}>
            <span><b>Ich habe Allergene und Zusatzstoffe gegen Rezeptur und
              Produktangaben geprüft.</b> Erst damit sieht der Gast sie.</span></label>
          <div class="f" style="max-width:280px;margin-top:.8rem">
            <label for="wer">Geprüft von</label>
            <input id="wer" name="wer" maxlength="60" value="${esc(g.kennz_von || '')}"
                   placeholder="Name oder „Küche"">
          </div>
          <p class="hint" style="margin-top:.9rem"><b>Ohne Freigabe zeigt die Karte den
            Satz „Fragen Sie uns bitte"</b> — und keine Liste. Das ist Absicht: Wer
            Erdnuss oder Gluten nicht verträgt, verlässt sich auf die Angabe. Eine
            halbfertige Liste, die schon öffentlich ist, wäre schlimmer als gar keine.</p>
          <p class="hint"><b>Jede spätere Änderung an den Häkchen hebt die Freigabe auf.</b>
            Dann bitte erneut prüfen und wieder freigeben — sonst würde eine alte
            Bestätigung eine neue Aussage decken.</p>
        </div>
      </div>

      <div class="row end" style="margin-bottom:2rem">
        <a class="btn ghost" href="${esc(zurueck)}">Abbrechen</a>
        <button class="btn" type="submit">Speichern</button>
      </div>
    </form>

    <details class="card">
      <summary>Was rechtlich dahintersteht</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Allergene</b> — die 14 aus VO (EU) 1169/2011, in
          Deutschland umgesetzt durch die LMIDV. Bei loser Ware, also allem, was aus der
          Küche kommt, darf die Auskunft auch <b>mündlich</b> erfolgen. Dann muss aber eine
          schriftliche oder <b>elektronische</b> Dokumentation auf Nachfrage leicht
          zugänglich sein und ein deutlicher Hinweis im Betrieb hängen. Genau diese
          elektronische Fassung kann die QR-Karte sein.</p>
        <p style="margin:0 0 .6rem"><b>Zusatzstoffe</b> — die 14 Funktionsklassen nach der
          Zusatzstoff-Zulassungsverordnung. Die müssen <b>schriftlich</b> kenntlich gemacht
          werden: auf der Karte, per Aushang oder auf einem leicht zugänglichen Blatt.
          Angegeben wird die Klasse („mit Farbstoff"), die E-Nummer ist freiwillig.</p>
        <p style="margin:0 0 .6rem"><b>Woher die Angaben kommen.</b> Aus der eigenen
          Rezeptur und aus den Produktspezifikationen der Lieferanten — nicht aus dem
          Namen des Gerichts. Dass Käsespätzle Milch enthalten, ist offensichtlich; ob im
          Dressing Senf steckt, weiß nur, wer es anrührt.</p>
        <p style="margin:0">⚠️ Vor dem Scharfschalten einmal mit der Lebensmittelüberwachung
          des Landkreises abgleichen. Diese Seite ist eine Umsetzungshilfe, keine
          Rechtsauskunft.</p>
      </div>
    </details>`;

  return layout({ user: data?.user, title: g.name, active: '/admin/karte', body });
}

/* ------------------------------------------------------------------ */

export async function onRequestPost({ request, env, data }) {
  const db = env.DB;
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }

  const id = clean(form.get('id'), 60);
  const zurueck = `/admin/gericht?id=${encodeURIComponent(id)}`;
  const fehler = m => redirect(`${zurueck}&err=${encodeURIComponent(m)}`);
  if (!db) return fehler('Keine Datenbankverbindung.');
  if (!id) return redirect('/admin/karte', 'Kein Gericht angegeben.');

  const alt = await db.prepare(
    `SELECT allergene, zusatz, kennz_ok FROM menu_items WHERE id = ?`).bind(id).first()
    .catch(() => null);
  if (!alt) return redirect('/admin/karte', 'Dieses Gericht gibt es nicht (mehr).');

  const allergene = allergenListe(form.getAll('allergen').join(',')).join(',') || null;
  const zusatz = zusatzListe(form.getAll('zusatz').join(',')).join(',') || null;
  const marken = markenListe(form.getAll('marke').join(',')).join(',') || null;

  /* Eine bestehende Freigabe deckt nur die Angaben, die zum Zeitpunkt der
     Freigabe dastanden.
     Die Falle: Ist das Gericht schon freigegeben, kommt das Häkchen bereits
     gesetzt aus dem Formular zurück. Wer dann ein Allergen ändert und
     speichert, würde die neue Aussage mit der alten Bestätigung decken —
     ohne es zu merken. Deshalb erlischt die Freigabe bei jeder Änderung an
     Allergenen oder Zusatzstoffen und muss bewusst neu erteilt werden.
     Ein Speichern mehr, dafür keine ungeprüfte Allergenangabe. */
  const geaendert = (allergene || '') !== (alt.allergene || '')
                 || (zusatz || '') !== (alt.zusatz || '');
  const willFrei = !!form.get('freigabe');
  const erloschen = geaendert && alt.kennz_ok && willFrei;
  const frei = willFrei && !erloschen ? 1 : 0;

  const wer = clean(form.get('wer'), 60) || null;
  const t = (n, max = 200) => clean(form.get(n), max) || null;

  try {
    await db.prepare(
      `UPDATE menu_items SET
         allergene=?, zusatz=?, marken=?,
         kennz_ok=?, kennz_am=?, kennz_von=?,
         herkunft=?, herkunft_en=?, reifung=?, reifung_en=?,
         garstufe=?, garstufe_en=?, wein=?, geschichte=?, geschichte_en=?
       WHERE id=?`)
      .bind(allergene, zusatz, marken,
            frei, frei ? nowBerlin().date : null, frei ? wer : null,
            t('herkunft'), t('herkunft_en'), t('reifung'), t('reifung_en'),
            t('garstufe'), t('garstufe_en'), t('wein'),
            t('geschichte', 600), t('geschichte_en', 600), id).run();
  } catch {
    return fehler(`Das hat nicht geklappt. ${MIGRATION}`);
  }

  if (erloschen) {
    return redirect(zurueck, 'Gespeichert. Weil sich Allergene oder Zusatzstoffe geändert '
      + 'haben, ist die Freigabe erloschen — bitte die Liste noch einmal durchsehen und '
      + 'unten neu freigeben. Bis dahin zeigt die Karte „Fragen Sie uns bitte".');
  }
  return redirect(zurueck, frei
    ? 'Gespeichert und freigegeben — die Angaben stehen jetzt in der Karte.'
    : 'Gespeichert. Ohne Freigabe zeigt die Karte weiterhin „Fragen Sie uns bitte".');
}
