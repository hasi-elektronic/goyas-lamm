/**
 * Stempeluhr für die Mitarbeiter — eigene Adresse: /zeit
 *
 * Warum es diese Seite zusätzlich zu `/admin/stempel` gibt: Die Uhr im Panel
 * setzt eine angemeldete Sitzung voraus. Das passt für das Tablet in der Küche,
 * das dauerhaft angemeldet bleibt — aber nicht für jemanden, der die Adresse
 * auf dem eigenen Telefon als Lesezeichen hat. Deshalb hier eine Seite, die
 * ohne Panel-Anmeldung auskommt und trotzdem nichts preisgibt:
 *
 *   **Vor der PIN steht kein einziger Name auf dem Bildschirm.** Die PIN ist
 *   die Anmeldung, sie sucht die Person. Erst danach erscheint „Hallo …".
 *   Wer die Adresse zufällig aufruft, sieht eine Uhr und ein Zahlenfeld —
 *   nicht, wer hier arbeitet und wer gerade im Dienst ist.
 *
 * Gebremst wird pro Anschluss (IP-Hash, siehe `_lib/pinbremse.js`): fünf
 * Fehlversuche, dann zehn Minuten Ruhe.
 *
 * Gestempelt wird mit der **Uhrzeit des Servers** (Europe/Berlin), nie mit der
 * des Geräts — eine falsch gestellte Handyuhr soll keine Arbeitszeit erzeugen.
 * Die Uhr auf dem Bildschirm läuft aus derselben Serverzeit weiter.
 *
 * Nach dem Stempeln wird umgeleitet (POST → 303 → GET). Das verhindert, dass
 * ein Neuladen ein zweites Mal stempelt. In der Adresse steht dabei nur, *was*
 * passiert ist und wann — kein Name.
 */
import { clean, esc, nowBerlin, formatDateDE, hashIp } from './_lib/core.js';
import { pinHash, brutto, hhmm } from './_lib/zeit.js';
import { bremseFrei, bremseFehler, bremseOk } from './_lib/pinbremse.js';

const CSS = `
@font-face{font-family:'Inter';font-style:normal;font-weight:400;font-display:swap;
  src:url(/assets/fonts/inter-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:600;font-display:swap;
  src:url(/assets/fonts/inter-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:600;font-display:swap;
  src:url(/assets/fonts/playfair-display-latin-600-normal.woff2) format('woff2')}
*,*::before,*::after{box-sizing:border-box}
:root{--wine:#6D1826;--ink:#14120F;--nacht:#1C1815;--creme:#F4F7EA;--sand:#E4DED0;
  --gold:#C0A062;--ok:#2E6B4F;--matt:rgba(244,247,234,.6)}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--creme);min-height:100svh;
  font:17px/1.55 'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.wrap{width:min(100% - 1.8rem,460px);margin:0 auto;padding:1.8rem 0 2.4rem;
  min-height:100svh;display:flex;flex-direction:column}
h1,h2{font-family:'Playfair Display',Georgia,serif;font-weight:600;margin:0;letter-spacing:-.01em}

.marke{text-align:center;margin-bottom:1.6rem}
.marke img{width:180px;max-width:56%;height:auto;display:inline-block}
.uhr{text-align:center;margin-bottom:1.8rem}
.uhr .t{font-size:3.4rem;font-weight:600;line-height:1;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums}
.uhr .d{color:var(--matt);font-size:.86rem;margin-top:.45rem}

.karte{background:var(--nacht);border:1px solid rgba(244,247,234,.13);border-radius:4px;
  padding:1.5rem 1.3rem 1.6rem}
.karte h2{font-size:1.6rem;margin-bottom:.15rem}
.rolle{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);
  margin-bottom:1.2rem}
.lab{display:block;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--matt);margin-bottom:.6rem;text-align:center}

input.pin{width:100%;font:inherit;font-size:2.1rem;font-weight:600;letter-spacing:.55em;
  text-align:center;text-indent:.55em;padding:.75rem .4rem;border-radius:3px;
  border:1px solid rgba(244,247,234,.22);background:#0F0D0C;color:#fff;
  font-variant-numeric:tabular-nums}
input.pin:focus{outline:0;border-color:var(--gold)}

.feld{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-top:.9rem}
.feld button{font:inherit;font-size:1.5rem;font-weight:600;padding:.85rem 0;cursor:pointer;
  border-radius:3px;border:1px solid rgba(244,247,234,.16);background:#0F0D0C;color:var(--creme);
  font-variant-numeric:tabular-nums;min-height:60px}
.feld button:active{background:var(--wine);border-color:var(--wine)}
.feld .weg{font-size:1.1rem;color:var(--matt)}

.b{display:block;width:100%;font:inherit;font-size:.92rem;letter-spacing:.14em;
  text-transform:uppercase;font-weight:600;padding:1.15rem 1rem;border-radius:3px;
  border:1px solid transparent;cursor:pointer;text-align:center;text-decoration:none;
  margin-top:.7rem}
.b.weiter{background:var(--gold);color:#20180C}
.b[hidden]{display:none}
.b.kommen{background:var(--ok);color:#fff}
.b.gehen{background:var(--wine);color:#fff}
.b.still{background:none;color:var(--matt);border-color:rgba(244,247,234,.2)}

select.pause{width:100%;font:inherit;font-size:1.05rem;padding:.85rem .8rem;border-radius:3px;
  border:1px solid rgba(244,247,234,.24);background:#0F0D0C;color:#fff;margin-bottom:.2rem}

.stand{border-left:3px solid var(--ok);background:rgba(46,107,79,.16);padding:.9rem 1rem;
  margin-bottom:1.2rem;font-size:.95rem;line-height:1.55}
.stand b{font-weight:600}
.warn{border-left:3px solid var(--gold);background:rgba(192,160,98,.14);padding:.9rem 1rem;
  margin-bottom:1.2rem;font-size:.95rem;line-height:1.55}

.haken{width:64px;height:64px;border-radius:50%;background:var(--ok);color:#fff;
  display:grid;place-items:center;font-size:2rem;margin:0 auto 1.1rem}
.fertig{text-align:center}
.fertig h2{font-size:1.7rem;margin-bottom:.5rem}
.fertig p{color:var(--matt);margin:0}
.gross{font-size:2.2rem;font-weight:600;font-variant-numeric:tabular-nums;
  letter-spacing:-.01em;margin:.6rem 0 .2rem}

.fuss{margin-top:auto;padding-top:2rem;text-align:center;color:rgba(244,247,234,.4);
  font-size:.78rem;line-height:1.7}
.fuss a{color:rgba(244,247,234,.55)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const seite = (inhalt, { titel = 'Stempeluhr', jetzt = '', zurueckNach = 0 } = {}) => new Response(
`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titel)} — Goya´s Lamm</title>${
  /* Das Gerät hängt in der Küche und wird selten bewusst verlassen. Nach
     einer Weile geht der Bildschirm von selbst auf den neutralen Anfang
     zurück, damit dort kein Name stehen bleibt. */
  zurueckNach ? `\n<meta http-equiv="refresh" content="${zurueckNach};url=/zeit">` : ''}
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#14120F">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<style>${CSS}</style></head><body>
<div class="wrap">
  <div class="marke">
    <img src="/assets/logo-white.png" alt="Goya´s Lamm Horrheim" width="1600" height="737">
  </div>
  ${inhalt}
  <p class="fuss">Stempeluhr für unser Team.<br>
     PIN vergessen oder Zeit falsch erfasst? Beim Chef melden.</p>
</div>
<script>
(function(){
  /* Die Uhr läuft aus der Serverzeit weiter, nicht aus der des Geräts. */
  var el = document.getElementById('uhr');
  if (el) {
    var basis = ${JSON.stringify(jetzt)}, start = Date.now();
    var p = basis.split(':'), sek = (+p[0]) * 3600 + (+p[1]) * 60;
    setInterval(function(){
      var s = sek + Math.floor((Date.now() - start) / 1000);
      var h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
      el.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }, 5000);
  }

  /* Zahlenfeld: große Tasten statt der Systemtastatur. Ohne JavaScript bleibt
     das normale Eingabefeld stehen und der Knopf „Weiter" tut dasselbe. */
  var pin = document.getElementById('pin');
  if (!pin) return;
  var feld = document.querySelector('.feld');
  if (feld) {
    /* Mit Tastenfeld ist das Eingabefeld nur noch Anzeige — so springt auf dem
       Telefon keine zweite Tastatur über den Bildschirm. Ohne JavaScript
       bleibt es ein ganz normales Feld. */
    pin.readOnly = true;
    /* Mit Tastenfeld genügt die OK-Taste unten rechts; der zweite Knopf wäre
       nur eine weitere Stelle, an der man tippen könnte. Ohne JavaScript
       bleibt er stehen — dann ist er der einzige Weg. */
    var w = document.getElementById('weiter'); if (w) w.hidden = true;
    feld.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v');
      if (v === 'weg') pin.value = pin.value.slice(0, -1);
      else if (pin.value.length < 4) pin.value += v;
      if (pin.value.length === 4) setTimeout(function(){ pin.form.submit(); }, 120);
    });
  }
  pin.focus();
})();
</script>
</body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const kopfUhr = now => `<div class="uhr">
  <div class="t" id="uhr">${esc(now.time)}</div>
  <div class="d">${esc(formatDateDE(now.date))}</div>
</div>`;

const tastenfeld = `<div class="feld">
  ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-v="${n}">${n}</button>`).join('')}
  <button type="button" class="weg" data-v="weg">Löschen</button>
  <button type="button" data-v="0">0</button>
  <button type="submit" class="weiter" style="background:var(--gold);color:#20180C;
    font-size:.8rem;letter-spacing:.12em;text-transform:uppercase">OK</button>
</div>`;

/** Startbildschirm: Uhr und Zahlenfeld, sonst nichts. */
function start(now, hinweis) {
  return seite(`${kopfUhr(now)}
    <form class="karte" method="post" action="/zeit">
      <input type="hidden" name="do" value="pruefen">
      ${hinweis ? `<div class="warn">${esc(hinweis)}</div>` : ''}
      <span class="lab" id="l">Deine PIN</span>
      <input class="pin" id="pin" name="pin" type="text" inputmode="numeric" pattern="[0-9]*"
             maxlength="4" autocomplete="off" aria-labelledby="l" required>
      ${tastenfeld}
      <button class="b weiter" id="weiter" type="submit">Weiter</button>
    </form>`, { jetzt: now.time });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const now = nowBerlin();

  /* Bestätigung nach dem Stempeln. In der Adresse steht kein Name — nur was
     passiert ist und wann. */
  const art = url.searchParams.get('k') ? 'kommen' : url.searchParams.get('g') ? 'gehen' : null;
  if (art) {
    const zeit = clean(url.searchParams.get('t'), 5);
    const dauer = clean(url.searchParams.get('d'), 8);
    return seite(`${kopfUhr(now)}
      <div class="karte fertig">
        <div class="haken" aria-hidden="true">&#10003;</div>
        <h2>${art === 'kommen' ? 'Dienstbeginn erfasst.' : 'Feierabend erfasst.'}</h2>
        <div class="gross">${esc(zeit)} Uhr</div>
        <p>${art === 'kommen'
              ? 'Guten Dienst.'
              : dauer ? `${esc(dauer)} Stunden für heute. Schönen Feierabend.`
                      : 'Schönen Feierabend.'}</p>
        <a class="b still" href="/zeit">Fertig</a>
      </div>`, { titel: 'Erfasst', jetzt: now.time, zurueckNach: 25 });
  }

  return start(now, clean(url.searchParams.get('hinweis'), 160));
}

export async function onRequestPost({ request, env }) {
  const now = nowBerlin();
  const db = env.DB;
  let d = {};
  try { d = Object.fromEntries(await request.formData()); } catch { /* leer */ }

  const pin = clean(d.pin, 8).replace(/\D/g, '');
  const zurStart = h => new Response(null, { status: 303, headers: {
    location: '/zeit?hinweis=' + encodeURIComponent(h), 'cache-control': 'no-store' } });

  if (!db) return zurStart('Die Zeiterfassung ist gerade nicht erreichbar.');
  if (pin.length < 4) return zurStart('Bitte die vierstellige PIN eingeben.');

  /* Gebremst wird pro Anschluss: Hier ist die PIN die Anmeldung, es gibt noch
     keine Person, auf die man zählen könnte. */
  const schluessel = 'zeit:' + await hashIp(request.headers.get('cf-connecting-ip') || '', env.IP_SALT);
  const gesperrt = await bremseFrei(db, schluessel);
  if (gesperrt) {
    return zurStart(`Zu viele Fehlversuche. Bitte in ${gesperrt} ${
      gesperrt === 1 ? 'Minute' : 'Minuten'} noch einmal — oder beim Chef melden.`);
  }

  /* Die PIN sucht die Person: gespeichert ist nur der Hash, und der ist für
     dieselbe PIN immer derselbe. */
  let treffer = [];
  try {
    treffer = (await db.prepare(
      `SELECT id,name,role FROM staff WHERE active=1 AND pin_hash=?`
    ).bind(await pinHash(pin, env.IP_SALT)).all()).results || [];
  } catch {
    return zurStart('Die Zeiterfassung ist noch nicht eingerichtet.');
  }

  if (!treffer.length) {
    await bremseFehler(db, schluessel);
    await new Promise(r => setTimeout(r, 700));
    return zurStart('Diese PIN kennen wir nicht.');
  }
  if (treffer.length > 1) {
    /* Darf nicht vorkommen — beim Vergeben wird auf Eindeutigkeit geprüft.
       Falls doch: nicht raten, sondern ehrlich abbrechen. */
    return zurStart('Diese PIN gehört zu mehreren Personen. Bitte beim Chef melden.');
  }
  await bremseOk(db, schluessel);
  const m = treffer[0];

  const offen = await db.prepare(
    `SELECT id,work_date,start_at FROM shifts WHERE staff_id=? AND end_at IS NULL
      ORDER BY work_date DESC, start_at DESC LIMIT 1`).bind(m.id).first();

  /* --- Schritt 1: PIN stimmt, jetzt der eine Knopf --- */
  if (d.do === 'pruefen') {
    const seit = offen
      ? `<div class="stand">Im Dienst seit <b>${esc(offen.start_at)} Uhr</b>${
          offen.work_date !== now.date
            ? ` (${esc(offen.work_date.slice(8))}.${esc(offen.work_date.slice(5, 7))}.)` : ''
          } — bisher ${esc(hhmm(brutto(offen.start_at, now.time)))} Stunden.</div>`
      : '';
    const pausen = [0,5,10,15,20,25,30,35,40,45,50,55,60,75,90]
      .map(n => `<option value="${n}">${n === 0 ? 'keine Pause' : n + ' Minuten'}</option>`).join('');

    return seite(`${kopfUhr(now)}
      <form class="karte" method="post" action="/zeit">
        <input type="hidden" name="pin" value="${esc(pin)}">
        <h2>Hallo ${esc(m.name.split(' ')[0])}.</h2>
        <div class="rolle">${esc(m.role || 'Team')}</div>
        ${seit}
        ${offen ? `<span class="lab" style="text-align:left">Pause</span>
          <select class="pause" name="pause">${pausen}</select>
          <button class="b gehen" name="do" value="gehen" type="submit">Feierabend</button>`
                : `<button class="b kommen" name="do" value="kommen" type="submit">Kommen</button>`}
        <a class="b still" href="/zeit">Abbrechen</a>
        <p class="fuss" style="padding-top:1.4rem;margin:0">${offen
          ? 'Pause bitte ehrlich eintragen — sie wird von der Arbeitszeit abgezogen.'
          : 'Die Zeit läuft ab dem Moment, in dem du auf „Kommen" tippst.'}</p>
      </form>`, { titel: 'Stempeluhr', jetzt: now.time, zurueckNach: 120 });
  }

  /* --- Schritt 2: stempeln --- */
  if (d.do === 'kommen') {
    if (offen) return zurStart('Du bist bereits eingestempelt.');
    await db.prepare(
      `INSERT INTO shifts (id,staff_id,work_date,start_at,break_min,source,created_at)
       VALUES (?,?,?,?,0,'stempel',?)`
    ).bind(crypto.randomUUID(), m.id, now.date, now.time, new Date().toISOString()).run();
    return new Response(null, { status: 303, headers: {
      location: `/zeit?k=1&t=${encodeURIComponent(now.time)}`, 'cache-control': 'no-store' } });
  }

  if (d.do === 'gehen') {
    if (!offen) return zurStart('Du bist gar nicht eingestempelt.');
    const pause = Math.max(0, Math.min(600, parseInt(d.pause, 10) || 0));
    const dauer = Math.max(0, brutto(offen.start_at, now.time) - pause);
    await db.prepare(
      `UPDATE shifts SET end_at=?, break_min=?, updated_at=? WHERE id=?`
    ).bind(now.time, pause, new Date().toISOString(), offen.id).run();
    return new Response(null, { status: 303, headers: {
      location: `/zeit?g=1&t=${encodeURIComponent(now.time)}&d=${encodeURIComponent(hhmm(dauer))}`,
      'cache-control': 'no-store' } });
  }

  return zurStart('Das hat nicht geklappt. Bitte noch einmal.');
}
