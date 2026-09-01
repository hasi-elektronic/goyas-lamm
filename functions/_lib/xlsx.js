/**
 * Ein minimaler .xlsx-Schreiber (SpreadsheetML) für den Worker.
 *
 * Erzeugt eine Arbeitsmappe mit einem Blatt je Tabelle: fette Kopfzeile,
 * eingefrorene erste Zeile, Autofilter, brauchbare Spaltenbreiten. Genug,
 * damit Gökhan die Datei doppelklickt, sortiert und weiterschickt.
 *
 * Zwei Entscheidungen, die den Code kurz halten:
 *
 * **Kein sharedStrings.xml.** Texte stehen als `t="inlineStr"` direkt in der
 * Zelle. Die Datei wird dadurch etwas größer, aber es entfällt der ganze
 * Zwischenspeicher samt Indexverwaltung — und die Größe fängt das ZIP wieder
 * ein.
 *
 * **Nur zwei Zellformate.** Eins normal, eins fett für die Kopfzeile. Alles
 * andere (Datumsformate, Zahlenformate) überlässt die Datei Excel: die Werte
 * kommen aus SQLite als Text bzw. Zahl, und ein Datum als `2026-08-30` liest
 * jede Tabellenkalkulation richtig.
 */
import { zipBauen } from './zip.js';

const xmlEsc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  /* Steuerzeichen sind in XML 1.0 nicht erlaubt. Excel öffnet eine Datei mit
     einem einzigen davon gar nicht erst — lieber wegwerfen als die ganze
     Mappe unbrauchbar machen. Tab, Zeilenumbruch und Wagenrücklauf bleiben. */
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

/** A, B, … Z, AA, AB … — Excels Spaltennamen. */
export function spalte(n) {
  let s = '';
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
  return s;
}

/* Excel verbietet in Blattnamen : \ / ? * [ ] und mehr als 31 Zeichen. Ein
   Verstoß bringt keine Fehlermeldung, sondern eine Datei, die sich nicht
   öffnen lässt — deshalb wird hier hart zurechtgeschnitten. */
function blattName(roh, vergeben) {
  let n = String(roh || 'Blatt').replace(/[:\\/?*[\]]/g, '_').slice(0, 31).trim() || 'Blatt';
  if (!vergeben.has(n.toLowerCase())) { vergeben.add(n.toLowerCase()); return n; }
  for (let i = 2; i < 1000; i++) {
    const k = `${n.slice(0, 31 - String(i).length - 1)}_${i}`;
    if (!vergeben.has(k.toLowerCase())) { vergeben.add(k.toLowerCase()); return k; }
  }
  return n;
}

const EXCEL_MAX = 32767;   // Zeichen je Zelle, harte Grenze des Formats

function zelle(bezug, wert, stil) {
  const s = stil ? ` s="${stil}"` : '';
  if (wert === null || wert === undefined || wert === '') return `<c r="${bezug}"${s}/>`;
  if (typeof wert === 'number' && Number.isFinite(wert)) return `<c r="${bezug}"${s}><v>${wert}</v></c>`;
  if (typeof wert === 'boolean') return `<c r="${bezug}"${s} t="b"><v>${wert ? 1 : 0}</v></c>`;
  let t = typeof wert === 'object' ? JSON.stringify(wert) : String(wert);
  if (t.length > EXCEL_MAX) t = t.slice(0, EXCEL_MAX - 1) + '…';
  return `<c r="${bezug}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(t)}</t></is></c>`;
}

function blattXml(spalten, zeilen) {
  const breiten = spalten.map((k, i) => {
    let b = String(k).length;
    for (const z of zeilen) {
      const w = z[i];
      if (w === null || w === undefined) continue;
      const l = String(w).length;
      if (l > b) b = l;
      if (b >= 60) break;
    }
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(9, b + 2))}" customWidth="1"/>`;
  }).join('');

  const kopf = `<row r="1">${spalten.map((k, i) => zelle(`${spalte(i)}1`, k, 1)).join('')}</row>`;
  const rumpf = zeilen.map((z, r) =>
    `<row r="${r + 2}">${z.map((w, i) => zelle(`${spalte(i)}${r + 2}`, w)).join('')}</row>`).join('');
  const letzte = spalte(Math.max(0, spalten.length - 1));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${breiten}</cols>
<sheetData>${kopf}${rumpf}</sheetData>
${spalten.length ? `<autoFilter ref="A1:${letzte}${zeilen.length + 1}"/>` : ''}
</worksheet>`;
}

/* Genau zwei Formate: 0 = normal, 1 = fett. Mehr braucht diese Datei nicht,
   und jedes zusätzliche Element in styles.xml ist eine Gelegenheit, die
   Mappe unlesbar zu machen. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Baut die Arbeitsmappe.
 *
 * `blaetter`: `[{ name, spalten: [string], zeilen: [[wert]] }]`
 * Rückgabe: Uint8Array mit der fertigen .xlsx.
 */
export async function xlsxBauen(blaetter, stand = new Date()) {
  const vergeben = new Set();
  const b = blaetter.map((x, i) => ({
    datei: `sheet${i + 1}.xml`,
    id: i + 1,
    name: blattName(x.name, vergeben),
    xml: blattXml(x.spalten || [], x.zeilen || []),
  }));

  const eintraege = [
    { name: '[Content_Types].xml', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${b.map(s => `<Override PartName="/xl/worksheets/${s.datei}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>` },
    { name: '_rels/.rels', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: 'xl/workbook.xml', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${b.map(s => `<sheet name="${xmlEsc(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets>
</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${b.map(s => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${s.datei}"/>`).join('')}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: 'xl/styles.xml', daten: STYLES },
    ...b.map(s => ({ name: `xl/worksheets/${s.datei}`, daten: s.xml })),
  ];

  return zipBauen(eintraege, stand);
}
