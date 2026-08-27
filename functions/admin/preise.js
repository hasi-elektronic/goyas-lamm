/**
 * Preis-Radar — der Teil, der Geld zurückholt.
 *
 * Der klassische Fall in der Gastronomie: Ein Lieferant erhöht still um acht
 * Prozent, und es fällt drei Monate niemandem auf, weil man nur die Summe unten
 * auf der Rechnung sieht. Diese Seite vergleicht jeden Einkaufspreis mit dem
 * vorhergehenden und stellt nach oben, was sich bewegt hat.
 *
 * Liegt hinter der Chef-PIN — dieselbe Trennung wie bei den Löhnen: Ware
 * annehmen darf jeder, die Einkaufspreise und Monatsausgaben sieht nur Gökhan.
 *
 * Gerechnet wird ausschließlich aus dem, was beim Wareneingang erfasst wurde.
 * Ohne Preise in den Positionen bleibt die Seite leer — das ist kein Fehler,
 * sondern die ehrliche Anzeige dafür, dass die Grundlage fehlt.
 */
import { clean, esc, nowBerlin } from '../_lib/core.js';
import { layout, flash } from '../_lib/ui.js';
import { monatLabel, monatVerschieben, tagKurz } from '../_lib/zeit.js';
import {
  GRUPPEN, einheitLabel, euro, menge, positionCent, preisDelta, schwelle, istMonat,
} from '../_lib/ware.js';

const MIGRATION = 'Die Tabellen für den Wareneingang fehlen noch — '
  + 'bitte Migration 0011_ware.sql einspielen.';

/** Wie viele Monate der Rückblick umfasst. */
const MONATE = 6;

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const db = env.DB;

  const bis = istMonat(url.searchParams.get('m'))
    ? url.searchParams.get('m') : nowBerlin().date.slice(0, 7);
  const spanne = Math.min(24, Math.max(1, parseInt(url.searchParams.get('n'), 10) || MONATE));
  const von = monatVerschieben(bis, -(spanne - 1));
  const vonTag = von + '-01';
  const bisTag = bis + '-31';

  let zeilen = [], lieferanten = [], fehler = '', proz = 10;
  try {
    zeilen = (await db.prepare(
      `SELECT i.article_id, i.menge_milli, i.ep_cent, d.day, d.supplier_id,
              a.name AS artikel, a.einheit, a.gruppe, a.active
         FROM delivery_items i
         JOIN deliveries d ON d.id = i.delivery_id
         LEFT JOIN articles a ON a.id = i.article_id
        WHERE d.day >= ? AND d.day <= ?
        ORDER BY d.day, i.sort`).bind(vonTag, bisTag).all()).results || [];
    lieferanten = (await db.prepare(`SELECT id, name FROM suppliers`).all()).results || [];
    const s = await db.prepare(`SELECT v FROM settings WHERE k='ware_schwelle'`).first();
    proz = schwelle(s?.v);
  } catch { fehler = MIGRATION; }

  const liefName = Object.fromEntries(lieferanten.map(l => [l.id, l.name]));

  /* --- Zusammenfassen ------------------------------------------- */
  const proArtikel = {};
  const proMonat = {};
  const proLieferant = {};

  for (const z of zeilen) {
    const wert = positionCent(z.menge_milli, z.ep_cent);
    const m = z.day.slice(0, 7);
    proMonat[m] = (proMonat[m] || 0) + wert;
    const lk = z.supplier_id || '';
    (proLieferant[lk] ||= { cent: 0, n: 0 });
    proLieferant[lk].cent += wert;
    proLieferant[lk].n++;

    const a = (proArtikel[z.article_id] ||= {
      name: z.artikel || 'Gelöschter Artikel', einheit: z.einheit || 'kg',
      gruppe: z.gruppe, aktiv: z.active !== 0, cent: 0, mengeMilli: 0, preise: [],
    });
    a.cent += wert;
    a.mengeMilli += z.menge_milli || 0;
    if (z.ep_cent) a.preise.push({ day: z.day, cent: z.ep_cent, lief: z.supplier_id });
  }

  /* --- Preisänderungen ------------------------------------------ */
  const bewegt = [];
  for (const [id, a] of Object.entries(proArtikel)) {
    if (a.preise.length < 2) continue;
    const letzte = a.preise[a.preise.length - 1];
    /* Der Vergleichswert ist der letzte **abweichende** Preis, nicht einfach
       der vorletzte Eintrag: Bei drei Lieferungen zum selben Preis wäre die
       Änderung sonst immer 0 % und echte Sprünge verschwänden. */
    let vorher = null;
    for (let i = a.preise.length - 2; i >= 0; i--) {
      if (a.preise[i].cent !== letzte.cent) { vorher = a.preise[i]; break; }
    }
    if (!vorher) continue;
    const delta = preisDelta(vorher.cent, letzte.cent);
    if (delta === null) continue;
    bewegt.push({ id, ...a, alt: vorher, neu: letzte, delta });
  }
  bewegt.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const alarm = bewegt.filter(b => Math.abs(b.delta) >= proz);

  const gesamt = Object.values(proMonat).reduce((a, b) => a + b, 0);
  const monate = [];
  for (let i = 0; i < spanne; i++) monate.push(monatVerschieben(von, i));
  const maxMonat = Math.max(1, ...monate.map(m => proMonat[m] || 0));

  const topArtikel = Object.entries(proArtikel)
    .sort((a, b) => b[1].cent - a[1].cent).slice(0, 15);
  const maxArtikel = Math.max(1, ...topArtikel.map(([, a]) => a.cent));

  const topLief = Object.entries(proLieferant).sort((a, b) => b[1].cent - a[1].cent);
  const maxLief = Math.max(1, ...topLief.map(([, l]) => l.cent));

  /* --- Bausteine ------------------------------------------------- */
  const balken = (label, wert, max, zusatz = '') => `
    <div class="bar"><div class="bl">${esc(label)}</div>
      <div class="bt"><i style="width:${Math.round(wert / max * 100)}%"></i></div>
      <div class="bv">${euro(wert)} €${zusatz ? `<em>${esc(zusatz)}</em>` : ''}</div></div>`;

  const deltaZeile = b => {
    const hoch = b.delta > 0;
    return `<tr>
      <td class="nm"><b>${esc(b.name)}</b>
        ${b.gruppe && GRUPPEN[b.gruppe] ? `<div class="meta">${esc(GRUPPEN[b.gruppe])}</div>` : ''}
        ${b.aktiv ? '' : '<div class="meta">ausgelistet</div>'}</td>
      <td class="t">${euro(b.alt.cent)} €<div class="meta">${esc(tagKurz(b.alt.day))}</div></td>
      <td class="t">${euro(b.neu.cent)} €<div class="meta">${esc(tagKurz(b.neu.day))}</div></td>
      <td class="g" style="${hoch ? '' : 'color:var(--ok)'}">
        ${hoch ? '+' : ''}${String(b.delta).replace('.', ',')} %</td>
      <td class="hide-s meta">je ${esc(einheitLabel(b.einheit))}${
        b.neu.lief ? ' · ' + esc(liefName[b.neu.lief] || '—') : ''}</td>
      <td class="det meta show-s">${euro(b.alt.cent)} € → ${euro(b.neu.cent)} € je ${esc(einheitLabel(b.einheit))}</td>
    </tr>`;
  };

  const leer = !zeilen.length;
  const ohnePreis = zeilen.length && !zeilen.some(z => z.ep_cent);

  const body = `
    <h1>Preis-Radar</h1>
    <p class="sub">${esc(monatLabel(von))} bis ${esc(monatLabel(bis))} —
       was der Einkauf gekostet hat und was sich bewegt.</p>
    ${fehler ? `<div class="msg err">${esc(fehler)}</div>` : ''}
    ${flash(url)}

    <div class="row" style="margin-bottom:1.4rem">
      <a class="btn ghost" href="/admin/preise?m=${monatVerschieben(bis, -1)}&n=${spanne}">←</a>
      <a class="btn ghost" href="/admin/preise?n=${spanne}">Bis heute</a>
      <a class="btn ghost" href="/admin/preise?m=${monatVerschieben(bis, 1)}&n=${spanne}">→</a>
      <span class="spacer"></span>
      ${[3, 6, 12].map(n => `<a class="btn sm ${n === spanne ? '' : 'ghost'}"
        href="/admin/preise?m=${esc(bis)}&n=${n}">${n} Monate</a>`).join('')}
      <a class="btn ghost" href="/admin/ware">Wareneingang</a>
    </div>

    ${leer ? `<div class="card"><div class="empty">
        In diesem Zeitraum ist noch kein Wareneingang mit Positionen erfasst.<br>
        <span class="meta">Das Radar rechnet ausschließlich mit dem, was unter
        „Wareneingang" eingetragen wurde.</span></div></div>`
    : ohnePreis ? `<div class="msg warn">Es sind Lieferungen erfasst, aber ohne Preise.
        Ohne Preis je Einheit kann diese Seite nichts vergleichen — beim Erfassen
        bitte die Spalte „€ je Einheit" mitfüllen.</div>` : ''}

    ${!leer ? `
    <div class="stats">
      <div class="stat hot"><b>${euro(gesamt)} €</b><span>Einkauf gesamt</span></div>
      <div class="stat"><b>${euro(Math.round(gesamt / spanne))} €</b><span>Schnitt je Monat</span></div>
      <div class="stat ${alarm.length ? 'hot' : ''}"><b>${alarm.length}</b><span>über ${proz} % bewegt</span></div>
      <div class="stat"><b>${Object.keys(proArtikel).length}</b><span>Artikel im Einkauf</span></div>
    </div>

    ${alarm.length ? `<div class="card">
      <h2>Deutlich verändert <em>ab ${proz} % gegenüber dem letzten Preis</em></h2>
      <table class="stack"><thead><tr>
        <th>Artikel</th><th>vorher</th><th>zuletzt</th><th>Δ</th><th class="hide-s">Einheit</th>
      </tr></thead><tbody>${alarm.map(deltaZeile).join('')}</tbody></table>
      <div class="body meta" style="border-top:1px solid var(--sand)">
        Eine Erhöhung ist kein Vorwurf — Rohstoffe schwanken. Aber sie sollte
        besprochen und nicht übersehen werden. Bei mehreren Sprüngen beim selben
        Lieferanten lohnt ein Anruf mit diesen Zahlen in der Hand.
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Ausgaben je Monat</h2>
      <div class="body"><div class="bars">
        ${monate.map(m => balken(monatLabel(m).split(' ')[0].slice(0, 3) + ' ' + m.slice(2, 4),
          proMonat[m] || 0, maxMonat)).join('')}
      </div></div>
    </div>

    <div class="card">
      <h2>Wohin das Geld geht <em>je Lieferant</em></h2>
      <div class="body"><div class="bars">
        ${topLief.map(([id, l]) => balken(liefName[id] || 'Ohne Lieferant', l.cent, maxLief,
          `${l.n} Pos.`)).join('')}
      </div></div>
    </div>

    <div class="card">
      <h2>Größte Positionen <em>Top 15 im Zeitraum</em></h2>
      <table class="stack"><thead><tr>
        <th>Artikel</th><th class="hide-s">Menge</th><th class="hide-s">Ø Preis</th><th>Summe</th>
      </tr></thead><tbody>
      ${topArtikel.map(([id, a]) => {
        const schnitt = a.mengeMilli ? Math.round(a.cent * 1000 / a.mengeMilli) : 0;
        return `<tr>
          <td class="nm"><b>${esc(a.name)}</b>
            ${a.gruppe && GRUPPEN[a.gruppe] ? `<div class="meta">${esc(GRUPPEN[a.gruppe])}</div>` : ''}</td>
          <td class="hide-s t">${esc(menge(a.mengeMilli, a.einheit))} ${esc(einheitLabel(a.einheit))}</td>
          <td class="hide-s t">${euro(schnitt)} €</td>
          <td class="g">${euro(a.cent)} €</td>
          <td class="det meta show-s">${esc(menge(a.mengeMilli, a.einheit))} ${esc(einheitLabel(a.einheit))}
            · Ø ${euro(schnitt)} €</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>

    ${bewegt.length > alarm.length ? `<details class="card">
      <summary>Alle Preisänderungen (${bewegt.length})</summary>
      <table class="stack"><thead><tr>
        <th>Artikel</th><th>vorher</th><th>zuletzt</th><th>Δ</th><th class="hide-s">Einheit</th>
      </tr></thead><tbody>${bewegt.map(deltaZeile).join('')}</tbody></table>
    </details>` : ''}
    ` : ''}

    <details class="card">
      <summary>Wie diese Seite rechnet</summary>
      <div class="body meta">
        <p style="margin:0 0 .6rem"><b>Verglichen wird mit dem letzten
           abweichenden Preis</b>, nicht stur mit der vorletzten Lieferung. Sonst
           stünde bei drei Lieferungen zum gleichen Preis immer 0 %, und ein
           echter Sprung ginge unter.</p>
        <p style="margin:0 0 .6rem"><b>Grundlage ist der Preis je Einheit</b>, den
           jemand beim Wareneingang eingetragen hat. Steht dort nichts, taucht die
           Position in keiner Auswertung auf. Deshalb ist die Spalte beim Erfassen
           die einzige, die sich wirklich lohnt.</p>
        <p style="margin:0 0 .6rem"><b>Es sind Einkaufszahlen, keine Kosten.</b>
           Was hier steht, ist eingekauft — nicht verbraucht. Wie viel davon
           tatsächlich in die Gerichte gegangen ist, sagt erst die
           <a href="/admin/inventur">Inventur</a>.</p>
        <p style="margin:0">Die Schwelle für den Alarm steht bei ${proz} % und lässt
           sich unter <a href="/admin/lager">Lager</a> ändern.</p>
      </div>
    </details>`;

  return layout({ user: data?.user, title: 'Preis-Radar', active: '/admin/preise', body });
}
