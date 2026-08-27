/**
 * Belegfoto hochladen — getrennt vom Formular.
 *
 * Warum eine eigene Route: Das Foto geht sofort weg, während Gökhan noch die
 * Temperatur eintippt. Wenn er später auf „Speichern" drückt, ist der Beleg
 * längst oben und das Formular schickt nur noch den Schlüssel mit. Bei
 * schlechtem Netz an der Hintertür ist das der Unterschied zwischen „geht
 * schnell" und „hängt".
 *
 * Ohne JavaScript funktioniert es trotzdem: Dann bleibt die Datei im Formular
 * und wird beim Speichern mitgeschickt (siehe admin/ware.js).
 */
import { json } from '../../_lib/core.js';
import { legeBelegAb } from '../ware.js';
import { nowBerlin } from '../../_lib/core.js';

export async function onRequestPost({ request, env }) {
  if (!env.BELEGE) {
    return json({ fehler: 'Für Belegfotos fehlt der R2-Speicher (Binding BELEGE).' }, 503);
  }
  let form;
  try { form = await request.formData(); } catch { return json({ fehler: 'Kaputte Anfrage.' }, 400); }

  const datei = form.get('beleg');
  if (!datei || typeof datei !== 'object' || !datei.size) {
    return json({ fehler: 'Keine Datei dabei.' }, 400);
  }

  const key = await legeBelegAb(env, datei, nowBerlin().date);
  return key
    ? json({ key })
    : json({ fehler: 'Das Bild wurde nicht angenommen (Format oder Größe).' }, 415);
}
