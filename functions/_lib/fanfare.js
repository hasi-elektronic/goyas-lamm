/**
 * Fanfare — die Meldung, wenn online eine Reservierung hereinkommt.
 *
 * Warum überhaupt: Das Tablet in der Küche steht den ganzen Abend auf derselben Seite.
 * Ohne Meldung merkt niemand eine Buchung, bis jemand von sich aus nachsieht. Es soll
 * Spaß machen, aber es hat einen nüchternen Zweck — kein Tisch soll untergehen.
 *
 * Gebaut mit Rücksicht auf den Service:
 *  - schließt sich nach acht Sekunden von selbst, ein Tippen reicht auch
 *  - hält den Rest der Seite bedienbar (nur die Karte selbst nimmt Klicks an)
 *  - Ton ist je Gerät abschaltbar und startet nie ungefragt laut
 *  - `prefers-reduced-motion` schaltet Konfetti und Gehüpfe ab, die Meldung bleibt
 *  - kein Konfetti bei versteckter Seite, keine Abfragen im Hintergrund
 *
 * Kein Fremd-Skript, keine Bibliothek — die CSP der Seite lässt nur eigenes zu.
 */

export const FANFARE_CSS = `
/* ---------- Fanfare ---------- */
.fanfare{position:fixed;inset:0;z-index:120;display:none;place-items:center;
  padding:1.2rem;pointer-events:none}
.fanfare.an{display:grid}
.fanfare .dunkel{position:absolute;inset:0;background:rgba(20,18,15,.55);
  backdrop-filter:blur(2px);opacity:0;animation:fdunkel .3s ease forwards}
@keyframes fdunkel{to{opacity:1}}

.fanfare .karte{position:relative;pointer-events:auto;width:min(100% - .4rem,430px);
  background:linear-gradient(165deg,#1d1a16,#14120F 58%);color:var(--cream);
  border:1px solid rgba(192,160,98,.55);border-radius:4px;overflow:hidden;
  box-shadow:0 24px 70px rgba(0,0,0,.5);text-align:center;
  padding:1.9rem 1.5rem 1.4rem;
  animation:fkarte .62s cubic-bezier(.16,1.3,.3,1) both}
@keyframes fkarte{
  0%{transform:translateY(28px) scale(.86) rotate(-2.5deg);opacity:0}
  60%{transform:translateY(0) scale(1.03) rotate(.8deg);opacity:1}
  100%{transform:translateY(0) scale(1) rotate(0)}
}
/* Goldschimmer, der einmal über die Karte läuft */
.fanfare .karte::after{content:'';position:absolute;top:0;bottom:0;width:45%;
  background:linear-gradient(100deg,transparent,rgba(192,160,98,.22),transparent);
  transform:skewX(-18deg);animation:fglanz 1.5s .35s ease-out both}
@keyframes fglanz{from{left:-60%}to{left:130%}}

.fanfare .tier{font-size:3.4rem;line-height:1;display:block;margin-bottom:.2rem;
  animation:fhuepf 1.15s .2s cubic-bezier(.3,.9,.4,1) 2 both}
@keyframes fhuepf{
  0%,100%{transform:translateY(0) rotate(0)}
  25%{transform:translateY(-19px) rotate(-9deg)}
  50%{transform:translateY(0) rotate(0)}
  72%{transform:translateY(-9px) rotate(7deg)}
}
.fanfare .spruch{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);font-weight:700;margin:0 0 .45rem}
.fanfare h2{margin:0 0 1rem;font-size:1.62rem;line-height:1.15;letter-spacing:-.01em;
  color:#fff;font-weight:800}
.fanfare .wer{font-size:1.12rem;font-weight:700;margin:0 0 .15rem;color:#fff;
  word-break:break-word}
.fanfare .wann{font-size:.95rem;color:rgba(244,247,234,.72);margin:0}
.fanfare .zahl{display:inline-flex;align-items:baseline;gap:.4rem;margin-top:1rem;
  background:rgba(192,160,98,.14);border:1px solid rgba(192,160,98,.4);
  border-radius:3px;padding:.5rem .95rem}
.fanfare .zahl b{font-size:1.7rem;line-height:1;font-weight:800;color:var(--gold);
  font-variant-numeric:tabular-nums}
.fanfare .zahl span{font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:rgba(244,247,234,.66)}
.fanfare .notiz{margin:.9rem 0 0;font-size:.84rem;color:rgba(244,247,234,.72);
  border-top:1px solid rgba(244,247,234,.13);padding-top:.75rem;word-break:break-word}
.fanfare .knopf{display:block;width:100%;margin-top:1.3rem;background:var(--gold);
  color:#14120F;border:0;border-radius:2px;padding:.9rem;font:inherit;font-weight:800;
  font-size:.76rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer}
.fanfare .knopf:hover{filter:brightness(1.08)}
.fanfare .zeigen{display:block;margin-top:.55rem;color:rgba(244,247,234,.6);
  font-size:.74rem;text-decoration:underline}
.fanfare .rest{position:absolute;left:0;bottom:0;height:3px;background:var(--gold);
  width:100%;transform-origin:left;animation:frest 8s linear forwards}
@keyframes frest{to{transform:scaleX(0)}}
.fanfare .noch{position:absolute;top:.7rem;right:.9rem;font-size:.68rem;
  letter-spacing:.12em;text-transform:uppercase;color:rgba(244,247,234,.5)}

/* Warteliste: gleiche Bühne, anderer Ton — hier wartet jemand auf einen Anruf. */
.fanfare.wl .karte{border-color:rgba(154,98,18,.6)}
.fanfare.wl .spruch,.fanfare.wl .zahl b{color:#E0A94B}
.fanfare.wl .zahl{background:rgba(224,169,75,.12);border-color:rgba(224,169,75,.4)}
.fanfare.wl .knopf{background:#E0A94B}
.fanfare.wl .rest{background:#E0A94B}

/* Konfetti */
.fanfare .konf{position:absolute;inset:0;overflow:hidden}
.fanfare .konf i{position:absolute;top:-14px;width:9px;height:14px;border-radius:1px;
  animation:ffall linear forwards}
@keyframes ffall{
  0%{transform:translateY(-10px) rotate(0);opacity:1}
  100%{transform:translateY(104vh) rotate(760deg);opacity:.9}
}

/* Tonschalter im Kopf */
.tonan{background:none;border:1px solid rgba(244,247,234,.22);color:rgba(244,247,234,.75);
  border-radius:2px;padding:.34rem .5rem;cursor:pointer;line-height:0;margin-right:.2rem}
.tonan:hover{background:rgba(244,247,234,.1);color:#fff}
.tonan svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;
  stroke-linecap:round;stroke-linejoin:round}
.tonan svg .korper{fill:currentColor;stroke-width:1.2}
.tonan .aus{display:none}
.tonan[aria-pressed="false"] .an{display:none}
.tonan[aria-pressed="false"] .aus{display:inline}

@media(max-width:480px){
  .fanfare .karte{padding:1.5rem 1.1rem 1.1rem}
  .fanfare h2{font-size:1.35rem}
  .fanfare .tier{font-size:2.8rem}
}
@media (prefers-reduced-motion:reduce){
  .fanfare .karte,.fanfare .tier,.fanfare .karte::after{animation:none}
  .fanfare .konf{display:none}
  .fanfare .rest{animation-duration:8s}
}
`;

/**
 * Der Lautsprecher-Schalter. Gehört in den Kopf der Seite, neben den Namen —
 * dort sucht man ihn, wenn es einem zu laut wird.
 *
 * Startet versteckt und wird per Skript eingeblendet: ohne JavaScript gäbe es weder
 * Ton noch Meldung, dann soll auch kein toter Knopf herumstehen.
 */
export const tonSchalter = () => `
<button class="tonan" id="tonan" type="button" aria-pressed="true" hidden
        title="Ton für neue Reservierungen">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="korper" d="M4 9v6h4l5 4V5L8 9H4z"/>
    <g class="an"><path d="M16.5 8.5a5 5 0 010 7"/><path d="M19 6a8.5 8.5 0 010 12"/></g>
    <g class="aus"><path d="M22 9l-5 6"/><path d="M17 9l5 6"/></g>
  </svg>
  <span class="sr">Ton an oder aus</span>
</button>`;

/** Die Meldung selbst samt Verhalten. Kommt direkt vor </body>. */
export const fanfareMarkup = () => `
<div class="fanfare" id="fanfare" role="alertdialog" aria-live="assertive" aria-modal="false"
     aria-labelledby="fanTitel" hidden>
  <div class="dunkel" data-zu></div>
  <div class="konf" id="fanKonf" aria-hidden="true"></div>
  <div class="karte">
    <span class="noch" id="fanNoch" hidden></span>
    <span class="tier" id="fanTier" aria-hidden="true">🐑</span>
    <p class="spruch" id="fanSpruch"></p>
    <h2 id="fanTitel">Neue Reservierung</h2>
    <p class="wer" id="fanWer"></p>
    <p class="wann" id="fanWann"></p>
    <div class="zahl"><b id="fanZahl">2</b><span id="fanZahlWort">Personen</span></div>
    <p class="notiz" id="fanNotiz" hidden></p>
    <button class="knopf" type="button" data-zu>Gesehen</button>
    <a class="zeigen" id="fanLink" href="/admin">In der Übersicht ansehen</a>
    <div class="rest" id="fanRest"></div>
  </div>
</div>

<script>
(function(){
  var box = document.getElementById('fanfare');
  if (!box) return;

  /* ---------- Ton: kurze Fanfare, ohne Tondatei ---------- */
  var TON_KEY = 'goya.ton';
  var tonAn = true;
  try { tonAn = localStorage.getItem(TON_KEY) !== 'aus'; } catch (e) {}
  var knopfTon = document.getElementById('tonan');
  if (knopfTon) {
    knopfTon.hidden = false;
    knopfTon.setAttribute('aria-pressed', tonAn ? 'true' : 'false');
    knopfTon.addEventListener('click', function(){
      tonAn = !tonAn;
      knopfTon.setAttribute('aria-pressed', tonAn ? 'true' : 'false');
      try { localStorage.setItem(TON_KEY, tonAn ? 'an' : 'aus'); } catch (e) {}
      if (tonAn) spiel();               // sofort hören, was man eingeschaltet hat
    });
  }

  var ac = null;
  function spiel(){
    if (!tonAn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ac) ac = new AC();
      if (ac.state === 'suspended') ac.resume();
      // C – E – G – C: kurz, freundlich, nicht schrill
      [523.25, 659.25, 783.99, 1046.5].forEach(function(f, i){
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.085;
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(i === 3 ? 0.20 : 0.13, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 3 ? 0.55 : 0.22));
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + 0.6);
      });
    } catch (e) { /* Ton ist Beiwerk — nie ein Grund für einen Fehler */ }
  }

  /* ---------- Konfetti ---------- */
  var FARBEN = ['#C0A062','#6D1826','#F4F7EA','#E0A94B','#2E6B4F'];
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function konfetti(){
    var k = document.getElementById('fanKonf');
    if (!k || ruhig) return;
    k.innerHTML = '';
    var teile = document.createDocumentFragment();
    for (var i = 0; i < 70; i++) {
      var s = document.createElement('i');
      s.style.left = (Math.random() * 100) + '%';
      s.style.background = FARBEN[i % FARBEN.length];
      s.style.animationDuration = (2.1 + Math.random() * 2.0) + 's';
      s.style.animationDelay = (Math.random() * 0.7) + 's';
      s.style.width = (5 + Math.random() * 7) + 'px';
      s.style.height = (9 + Math.random() * 9) + 'px';
      s.style.opacity = 0.65 + Math.random() * 0.35;
      teile.appendChild(s);
    }
    k.appendChild(teile);
    setTimeout(function(){ if (k) k.innerHTML = ''; }, 5200);
  }

  /* ---------- Sprüche ---------- */
  var SPRUCH = [
    'Der Grill freut sich.', 'Da will jemand Fleisch.', 'Tisch klarmachen!',
    'Jemand hat Hunger.', 'Der heiße Stein wird schon warm.', 'Das Lamm sagt Ja.',
    'Wieder einer, der es kapiert hat.', 'Ohne Provision. Einfach so.',
    'Schon wieder Arbeit. Gute Arbeit.', 'Bitte einmal Lächeln üben.',
    'Die Kasse klingelt später.', 'Horrheim ruft.'
  ];
  var GROSS = ['Große Runde!', 'Das wird laut.', 'Tische zusammenschieben!'];
  var WARTE = ['Jemand will noch rein.', 'Bitte zurückrufen.', 'Ein Platz gesucht.'];
  // Das Lamm ist der Hausherr — die anderen kommen seltener vorbei.
  var TIERE = ['🐑','🐑','🐑','🐑','🥩','🔥','🎉','🍷'];

  var WT = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  function datumKurz(d){
    var t = d.split('-');
    if (t.length !== 3) return d;
    var dt = new Date(Date.UTC(+t[0], +t[1] - 1, +t[2]));
    var heute = new Date(), morgen = new Date(heute.getTime() + 864e5);
    var iso = function(x){ return x.toISOString().slice(0,10); };
    if (d === iso(heute)) return 'heute';
    if (d === iso(morgen)) return 'morgen';
    return WT[dt.getUTCDay()] + '., ' + (+t[2]) + '.' + (+t[1]) + '.';
  }

  /* ---------- Warteschlange: immer nur eine Meldung auf einmal ---------- */
  var schlange = [], laeuft = false, uhr = null;

  function schliessen(){
    box.classList.remove('an'); box.hidden = true;
    clearTimeout(uhr); laeuft = false;
    var k = document.getElementById('fanKonf'); if (k) k.innerHTML = '';
    if (schlange.length) setTimeout(naechste, 420);
  }
  box.addEventListener('click', function(e){
    if (e.target.closest('[data-zu]')) schliessen();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && laeuft) schliessen();
  });

  function naechste(){
    if (laeuft || !schlange.length) return;
    var m = schlange.shift();
    laeuft = true;

    var wl = m.art === 'warteliste';
    var gross = m.gaeste >= 6;
    var liste = wl ? WARTE : (gross ? GROSS : SPRUCH);

    box.className = 'fanfare an' + (wl ? ' wl' : '');
    box.hidden = false;
    document.getElementById('fanSpruch').textContent = liste[Math.floor(Math.random() * liste.length)];
    document.getElementById('fanTier').textContent = wl ? '🔔' : TIERE[Math.floor(Math.random() * TIERE.length)];
    document.getElementById('fanTitel').textContent = wl ? 'Warteliste' : 'Neue Reservierung';
    document.getElementById('fanWer').textContent = m.name || '';
    document.getElementById('fanWann').textContent =
      datumKurz(m.datum) + (m.zeit ? ' um ' + m.zeit + ' Uhr' : ' — Uhrzeit egal');
    document.getElementById('fanZahl').textContent = m.gaeste;
    document.getElementById('fanZahlWort').textContent = m.gaeste === 1 ? 'Person' : 'Personen';

    var no = document.getElementById('fanNotiz');
    if (m.notiz) { no.textContent = m.notiz; no.hidden = false; } else { no.hidden = true; }

    var noch = document.getElementById('fanNoch');
    if (schlange.length) { noch.textContent = 'noch ' + schlange.length; noch.hidden = false; }
    else { noch.hidden = true; }

    var lnk = document.getElementById('fanLink');
    lnk.href = wl ? '/admin/warteliste' : '/admin/tag?d=' + m.datum;
    lnk.textContent = wl ? 'Auf der Warteliste ansehen' : 'Diesen Tag ansehen';

    // Fortschrittsbalken neu starten
    var rest = document.getElementById('fanRest');
    rest.style.animation = 'none'; void rest.offsetWidth; rest.style.animation = '';

    konfetti();
    spiel();
    uhr = setTimeout(schliessen, 8000);
  }

  /* ---------- Was dieses Gerät schon gesehen hat ----------
     Damit eine Buchung, die vor dem Öffnen des Panels ankam, genau einmal gemeldet wird —
     und beim nächsten Neuladen nicht noch einmal. Je Gerät eigene Liste: das Tablet in der
     Küche und das Handy vom Chef sollen beide Bescheid bekommen. */
  var GES_KEY = 'goya.gesehen';
  function gesehenListe(){
    try { return JSON.parse(localStorage.getItem(GES_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function merken(id){
    try {
      var l = gesehenListe();
      if (l.indexOf(id) > -1) return;
      l.push(id);
      if (l.length > 40) l = l.slice(-40);
      localStorage.setItem(GES_KEY, JSON.stringify(l));
    } catch (e) {}
  }

  /* ---------- Abfrage ---------- */
  var stand = null, ABSTAND = 15000, timer = null, laeuftAbfrage = false;

  function fragen(){
    if (laeuftAbfrage) return;
    laeuftAbfrage = true;
    var u = stand ? '/admin/melder?seit=' + encodeURIComponent(stand) : '/admin/melder?start=1';
    fetch(u, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d) return;                       // abgemeldet oder Fehler: still weiter
        stand = d.jetzt || stand;
        var alt = gesehenListe(), frisch = [];
        for (var i = 0; i < (d.neu || []).length; i++) {
          var m = d.neu[i];
          if (m.id && alt.indexOf(m.id) > -1) continue;   // auf diesem Gerät schon gezeigt
          if (m.id) merken(m.id);
          frisch.push(m);
        }
        if (frisch.length) {
          schlange = schlange.concat(frisch);
          if (schlange.length > 6) schlange = schlange.slice(-6);
          naechste();
        }
      })
      .catch(function(){ /* WLAN weg — beim nächsten Mal wieder */ })
      .then(function(){ laeuftAbfrage = false; });
  }

  function takt(){
    clearInterval(timer);
    if (document.visibilityState === 'visible') timer = setInterval(fragen, ABSTAND);
  }
  document.addEventListener('visibilitychange', function(){
    takt();
    if (document.visibilityState === 'visible') fragen();
  });

  fragen();   // nimmt beim Laden die letzten 20 Minuten mit, aber nichts doppelt
  takt();

  /* Zum Ausprobieren, ohne auf einen echten Gast zu warten: der Knopf „Meldung testen"
     unten auf der Übersicht, /admin?probe=1 — oder goyaProbe() in der Konsole. */
  window.goyaProbe = function(art){
    schlange.push({ art: (art === 'warteliste' ? 'warteliste' : 'reservierung'),
      name: 'Familie Müller',
      datum: new Date(Date.now() + 864e5).toISOString().slice(0,10),
      zeit: '19:00', gaeste: 4, notiz: 'Kinderstuhl, bitte am Fenster' });
    naechste();
  };
  document.addEventListener('click', function(e){
    var k = e.target.closest && e.target.closest('[data-probe]');
    if (k) { e.preventDefault(); window.goyaProbe(); }
  });
  if (location.search.indexOf('probe=1') > -1) setTimeout(function(){ window.goyaProbe(); }, 600);
})();
</script>`;
