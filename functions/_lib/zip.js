/**
 * Ein sehr kleiner ZIP-Schreiber für den Worker.
 *
 * Warum selbst gebaut: eine .xlsx-Datei ist nichts anderes als ein ZIP mit
 * XML darin. Für diese eine Aufgabe eine Fremdbibliothek einzubinden hieße,
 * dem Projekt eine package.json, einen Bundle-Schritt und eine Abhängigkeit
 * zu geben, die es sonst nirgends braucht. Der Teil des ZIP-Formats, den man
 * dafür kennen muss, sind drei Datensätze und eine CRC-Tabelle.
 *
 * Komprimiert wird mit `CompressionStream('deflate-raw')` — das gibt es in
 * Workern von Haus aus und liefert genau den rohen Deflate-Strom, den ZIP
 * (Methode 8) erwartet. Ohne „raw" käme ein zlib-Kopf mit und keine
 * Tabellenkalkulation der Welt würde die Datei öffnen.
 *
 * Bewusst nicht unterstützt: Zip64 (Dateien über 4 GB), Verschlüsselung,
 * Ordnereinträge, Unicode-Dateinamen. Die Namen in einer xlsx sind reines
 * ASCII, und die Datenbank ist gut ein halbes Megabyte groß.
 */

/* CRC-32 nach ISO 3309, wie ZIP ihn verlangt. Die Tabelle wird einmal je
   Isolate gebaut und dann wiederverwendet. */
let CRC_TABELLE = null;
function crcTabelle() {
  if (CRC_TABELLE) return CRC_TABELLE;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  CRC_TABELLE = t;
  return t;
}

function crc32(bytes) {
  const t = crcTabelle();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function deflate(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const strom = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/* MS-DOS-Zeitstempel. Zwei 16-Bit-Felder mit Zwei-Sekunden-Auflösung und
   einem Jahr, das 1980 anfängt — das Format ist so alt wie die Idee. */
function dosZeit(d) {
  const jahr = Math.max(1980, d.getUTCFullYear());
  return {
    zeit: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    datum: ((jahr - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/**
 * Baut ein ZIP aus `[{ name, daten }]`.
 *
 * `daten` ist ein String (wird UTF-8-kodiert) oder ein Uint8Array.
 * Rückgabe: Uint8Array, fertig zum Ausliefern.
 */
export async function zipBauen(eintraege, stand = new Date()) {
  const enc = new TextEncoder();
  const { zeit, datum } = dosZeit(stand);
  const teile = [];
  const zentral = [];
  let versatz = 0;

  for (const e of eintraege) {
    const roh = typeof e.daten === 'string' ? enc.encode(e.daten) : e.daten;
    const name = enc.encode(e.name);
    const gepackt = await deflate(roh);
    const summe = crc32(roh);

    /* Lokaler Dateikopf: 30 Byte fest, dann der Name. */
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true);   // Signatur
    kopf.setUint16(4, 20, true);           // benötigte Version (2.0)
    kopf.setUint16(6, 0, true);            // Flags
    kopf.setUint16(8, 8, true);            // Methode 8 = deflate
    kopf.setUint16(10, zeit, true);
    kopf.setUint16(12, datum, true);
    kopf.setUint32(14, summe, true);
    kopf.setUint32(18, gepackt.length, true);
    kopf.setUint32(22, roh.length, true);
    kopf.setUint16(26, name.length, true);
    kopf.setUint16(28, 0, true);           // keine Extra-Felder
    teile.push(new Uint8Array(kopf.buffer), name, gepackt);

    /* Derselbe Satz noch einmal im Inhaltsverzeichnis, plus die Stelle, an
       der der lokale Kopf steht. Erst das macht das Archiv lesbar. */
    const zk = new DataView(new ArrayBuffer(46));
    zk.setUint32(0, 0x02014b50, true);
    zk.setUint16(4, 20, true);             // erzeugt von Version 2.0
    zk.setUint16(6, 20, true);
    zk.setUint16(8, 0, true);
    zk.setUint16(10, 8, true);
    zk.setUint16(12, zeit, true);
    zk.setUint16(14, datum, true);
    zk.setUint32(16, summe, true);
    zk.setUint32(20, gepackt.length, true);
    zk.setUint32(24, roh.length, true);
    zk.setUint16(28, name.length, true);
    zk.setUint16(30, 0, true);             // Extra
    zk.setUint16(32, 0, true);             // Kommentar
    zk.setUint16(34, 0, true);             // Datenträger
    zk.setUint16(36, 0, true);             // interne Attribute
    zk.setUint32(38, 0, true);             // externe Attribute
    zk.setUint32(42, versatz, true);
    zentral.push(new Uint8Array(zk.buffer), name);

    versatz += 30 + name.length + gepackt.length;
  }

  const zGroesse = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(4, 0, true);
  ende.setUint16(6, 0, true);
  ende.setUint16(8, eintraege.length, true);
  ende.setUint16(10, eintraege.length, true);
  ende.setUint32(12, zGroesse, true);
  ende.setUint32(16, versatz, true);
  ende.setUint16(20, 0, true);

  const alle = [...teile, ...zentral, new Uint8Array(ende.buffer)];
  const gesamt = alle.reduce((s, t) => s + t.length, 0);
  const aus = new Uint8Array(gesamt);
  let p = 0;
  for (const t of alle) { aus.set(t, p); p += t.length; }
  return aus;
}
