/**
 * /admin/stempel — gibt es nur noch als Weiterleitung auf /zeit.
 *
 * Es gab zwei Stempeluhren, und das war eine zu viel. Diese hier war die
 * ältere: eine Kachelwand mit allen Namen, dahinter je eine PIN. Sie lief nur
 * mit angemeldeter Panel-Sitzung und zeigte schon vor der PIN, wer im Haus
 * arbeitet und wer gerade im Dienst ist.
 *
 * `/zeit` kann alles, was diese Seite konnte, und drei Dinge besser:
 *
 * 1. **Vor der PIN steht kein Name auf dem Bildschirm.** Die PIN sucht die
 *    Person, sie ist die Anmeldung. Wer die Adresse zufällig aufruft, sieht
 *    eine Uhr und ein Zahlenfeld.
 * 2. **Keine Panel-Anmeldung nötig.** Damit taugt sie auch als Lesezeichen auf
 *    dem eigenen Telefon, nicht nur auf dem Tablet in der Küche.
 * 3. **Großes Zahlenfeld** statt Systemtastatur — bedienbar mit einer Hand.
 *
 * Die Adresse bleibt trotzdem bestehen: Auf dem Küchen-Tablet liegt sie
 * womöglich als Startseite oder auf dem Homescreen, und ein Lesezeichen, das
 * ins Leere läuft, ist ein Anruf am Freitagabend. 302 und nicht 301, damit
 * eine spätere Entscheidung nicht in den Browsern der Küche festhängt.
 */
export const onRequest = () => new Response(null, {
  status: 302,
  headers: { location: '/zeit', 'cache-control': 'no-store' },
});
