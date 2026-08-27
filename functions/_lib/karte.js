/**
 * Speisekarte aus der Datenbank lesen und in genau das HTML gießen,
 * das die Website vorher fest eingebaut hatte. Dadurch bleibt das Design
 * unverändert und die Karte steht trotzdem im Quelltext (wichtig für Google).
 */
import { esc } from './core.js';

/** @returns {Promise<Array|null>} null = keine Karte in der Datenbank */
export async function loadKarte(db, { nurAktive = true } = {}) {
  if (!db) return null;
  try {
    const wT = nurAktive ? 'WHERE active = 1' : '';
    const liesTabs = async (mitExtra) => (await db.prepare(
      `SELECT id,title,sort,cols,active${mitExtra ? ',title_en' : ''}
         FROM menu_tabs ${wT} ORDER BY sort, title`).all()).results || [];
    let tabs;
    try { tabs = await liesTabs(true); } catch { tabs = await liesTabs(false); }
    if (!tabs.length) return null;

    /* Die englischen Spalten und `bild` kamen erst mit 0013 dazu. Fehlen sie,
       wird ohne sie gelesen — sonst wäre die Karte auf einer nicht migrierten
       Datenbank plötzlich leer, und das ist genau der Fall, den das
       Failsafe-Konzept dieser Seite verhindern soll. */
    const lies = async (mitExtra) => {
      const g = (await db.prepare(
        `SELECT id,tab_id,title,note,sort,active${mitExtra ? ',title_en,note_en' : ''}
           FROM menu_groups ${nurAktive ? 'WHERE active = 1' : ''} ORDER BY sort, title`).all()).results || [];
      const i = (await db.prepare(
        `SELECT id,group_id,name,descr,price,sort,active${
          mitExtra ? ',bild,name_en,descr_en,highlight' : ''}
           FROM menu_items ORDER BY sort, name`).all()).results || [];
      return [g, i];
    };
    let groups, items;
    try { [groups, items] = await lies(true); }
    catch { [groups, items] = await lies(false); }

    const byGroup = {};
    for (const i of items) (byGroup[i.group_id] ||= []).push(i);

    return tabs.map(t => ({
      ...t,
      groups: groups.filter(g => g.tab_id === t.id)
        .map(g => ({ ...g, items: byGroup[g.id] || [] })),
    }));
  } catch {
    return null;   // Migration 0005 noch nicht eingespielt
  }
}

const preis = p => esc(String(p ?? '')).replace(/\n/g, '<br>');

/** Zählt, was in der Karte steht — für das Admin-Dashboard. */
export function zaehle(karte) {
  const gruppen = karte.reduce((s, t) => s + t.groups.length, 0);
  const items = karte.reduce((s, t) => s + t.groups.reduce((x, g) => x + g.items.length, 0), 0);
  const aus = karte.reduce((s, t) =>
    s + t.groups.reduce((x, g) => x + g.items.filter(i => !i.active).length, 0), 0);
  return { tabs: karte.length, gruppen, items, aus };
}

/* ------------------------------------------------------------------ */
/* Schaufenster für die Startseite                                     */
/* ------------------------------------------------------------------ */

/**
 * Eine Auswahl statt der ganzen Karte.
 *
 * Die Startseite zeigte alle 132 Gerichte — ein Viertel ihres HTML. Seit die
 * Karte unter `/karte` ein eigenes Zuhause hat, reicht hier ein Schaufenster:
 * die Gerichte, für die das Haus steht, mit Preis, und ein deutlicher Weg zur
 * vollständigen Karte.
 *
 * Was im Schaufenster steht, entscheidet die Spalte `highlight` — also Gökhan
 * unter /admin/karte, nicht eine Liste im Quelltext. Ausgelistete Gerichte
 * fallen automatisch heraus.
 *
 * Reihenfolge: nach Reitern der Karte, damit Vorspeise vor Hauptgang vor
 * Nachtisch steht und nicht die Datenbankreihenfolge durchschlägt.
 *
 * @returns {string} leer, wenn nichts markiert ist — dann bleibt die
 *                   statische Fassung im HTML stehen (dasselbe Failsafe wie
 *                   bei der vollen Karte).
 */
export function schaufensterHtml(karte) {
  const zeilen = [];
  for (const tab of karte) {
    for (const g of tab.groups) {
      for (const i of g.items) {
        if (!i.active || !i.highlight) continue;
        zeilen.push({ ...i, gruppe: g.title });
      }
    }
  }
  if (!zeilen.length) return '';

  return zeilen.map(i => `<div class="schau">
          <div class="schau-txt">
            <div class="schau-kopf">
              <h3>${esc(i.name)}</h3>
              <div class="schau-preis">${preis(i.price)}</div>
            </div>
            ${i.descr ? `<p>${esc(i.descr)}</p>` : ''}
          </div>
          <span class="schau-gruppe">${esc(i.gruppe)}</span>
        </div>`).join('\n        ');
}
