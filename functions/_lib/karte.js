/**
 * Speisekarte aus der Datenbank lesen und in genau das HTML gießen,
 * das die Website vorher fest eingebaut hatte. Dadurch bleibt das Design
 * unverändert und die Karte steht trotzdem im Quelltext (wichtig für Google).
 */

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
          mitExtra ? `,bild,name_en,descr_en,highlight,
             allergene,zusatz,marken,kennz_ok,
             herkunft,herkunft_en,reifung,reifung_en,
             garstufe,garstufe_en,wein,geschichte,geschichte_en` : ''}
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

/** Zählt, was in der Karte steht — für das Admin-Dashboard. */
export function zaehle(karte) {
  const gruppen = karte.reduce((s, t) => s + t.groups.length, 0);
  const items = karte.reduce((s, t) => s + t.groups.reduce((x, g) => x + g.items.length, 0), 0);
  const aus = karte.reduce((s, t) =>
    s + t.groups.reduce((x, g) => x + g.items.filter(i => !i.active).length, 0), 0);
  return { tabs: karte.length, gruppen, items, aus };
}

