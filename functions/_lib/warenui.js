/**
 * Oberfläche für den Wareneingang — Stil und die Bausteine, die nur hier
 * gebraucht werden.
 *
 * Getrennt von `ware.js`, weil dort ausschließlich rechenbare Logik steht, die
 * sich ohne Browser prüfen lässt. Hier liegt alles, was Aussehen ist.
 *
 * Die Gestaltung folgt einer einzigen Annahme: **Das wird an der Hintertür mit
 * dem Handy in einer Hand bedient**, während die andere die Kiste hält. Also
 * große Flächen, wenig Tippen, und die Temperaturampel groß genug, dass man
 * ohne Lesebrille sieht, ob sie grün ist.
 */

export const WARE_CSS = `
/* Lieferanten als Kacheln — antippen statt aus einer Liste suchen */
.lkacheln{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.5rem}
.lkachel{display:flex;flex-direction:column;justify-content:center;gap:.2rem;
  background:#fff;border:1px solid var(--sand);border-radius:var(--r);
  padding:.85rem .9rem;text-align:left;font:inherit;cursor:pointer;min-height:64px;
  -webkit-tap-highlight-color:transparent}
.lkachel b{font-size:.98rem;line-height:1.2}
.lkachel span{font-size:.72rem;color:var(--muted)}
.lkachel:hover{border-color:var(--wine)}
.lkachel.on{background:var(--wine);border-color:var(--wine);color:#fff}
.lkachel.on span{color:rgba(255,255,255,.72)}

/* Temperaturampel */
.ampel{display:flex;align-items:center;gap:.9rem;padding:.9rem 1rem;border-radius:var(--r);
  border:1px solid var(--sand);background:#fff;margin-top:.7rem}
.ampel .pkt{width:26px;height:26px;border-radius:50%;background:var(--sand);flex:0 0 auto}
.ampel b{font-size:1.02rem;display:block;line-height:1.25}
.ampel span{font-size:.82rem;color:var(--muted);display:block}
.ampel.gut{border-color:var(--ok);background:#EDF5F0}
.ampel.gut .pkt{background:var(--ok)}
.ampel.schlecht{border-color:var(--wine);background:#F8EEF0}
.ampel.schlecht .pkt{background:var(--wine)}
.ampel.schlecht b{color:var(--wine)}

/* Belegfoto */
.foto{border:1px dashed var(--sand);border-radius:var(--r);background:#fff;padding:1.1rem;
  text-align:center}
.foto label.knopf{display:inline-flex;align-items:center;gap:.5rem;background:var(--ink);color:var(--cream);
  padding:.75rem 1.2rem;border-radius:var(--r);font-size:.74rem;letter-spacing:.14em;
  text-transform:uppercase;font-weight:700;cursor:pointer}
.foto label.knopf:hover{background:var(--wine)}
.foto input[type=file]{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
.foto img{max-height:230px;width:auto;margin:0 auto .8rem;border:1px solid var(--sand)}
.foto .stand{font-size:.84rem;color:var(--muted);margin:.7rem 0 0}

/* Positionszeile */
.prow{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1.15fr) minmax(0,.85fr)
  auto minmax(0,.95fr) minmax(0,.95fr) auto;gap:.5rem;align-items:end;padding:.7rem 0;
  border-bottom:1px solid var(--sand)}
.prow:last-of-type{border-bottom:0}
.prow .f label{margin-bottom:.2rem;font-size:.6rem}
.prow .f input,.prow .f select{padding:.55rem .6rem}
.prow .weg{background:none;border:1px solid var(--sand);border-radius:var(--r);color:var(--muted);
  font:inherit;font-size:1rem;line-height:1;padding:.55rem .7rem;cursor:pointer;height:38px}
.prow .weg:hover{border-color:var(--wine);color:var(--wine)}
.prow .neuname{display:none}
.prow.istneu .neuname{display:block}
.psum{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
  padding:.9rem 0 0;border-top:2px solid var(--ink);margin-top:.6rem;font-weight:700}
.psum span{font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
.psum b{font-size:1.25rem;font-variant-numeric:tabular-nums}

/* Artikelzeile im Lager. Eigene Spaltenbreiten statt der geerbten aus der
   Speisekarte: dort steht in der letzten Spalte eine Zahl, hier ein Auswahlfeld
   mit Beschriftungen wie „Milch & Milchprodukte" — bei .4fr stand davon nur
   noch „Milch" da. */
.irow.lager{grid-template-columns:minmax(0,1.7fr) minmax(0,1.35fr) minmax(0,.8fr)
  minmax(0,1.35fr) auto}
@media(max-width:720px){
  .irow.lager{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}

/* Mengenschild in der Artikelliste.
   Dort stand vorher nur „7× geliefert" — also wie oft, nie wie viel. Die Menge
   ist das, wonach in dieser Liste gesucht wird; sie bekommt deshalb eine eigene
   Fläche statt einer weiteren grauen Kleinzeile. */
.mschild{display:inline-flex;flex-direction:column;line-height:1.2;
  background:var(--cream);border:1px solid var(--sand);border-radius:var(--r);
  padding:.32rem .6rem;min-width:6.6rem}
.mschild b{font-size:1rem;font-variant-numeric:tabular-nums}
.mschild span{font-size:.66rem;letter-spacing:.06em;color:var(--muted)}
.mschild.leer b{color:var(--muted);font-weight:400}

/* Positionszeile: Einheit als lesbares Etikett neben dem Feld, Zeilensumme
   rechts. Vorher stand die Einheit als hellgrauer Hinweistext unter dem Feld
   und war beim Tippen praktisch unsichtbar — man wusste nicht, ob „12" jetzt
   zwölf Stück oder zwölf Kilo sind. */
.prow .ehz{display:flex;gap:.35rem;align-items:stretch}
.prow .ehz input{flex:1 1 auto;min-width:0}
.prow .eh{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
  min-width:3.6rem;padding:0 .5rem;background:var(--cream);border:1px solid var(--sand);
  border-radius:var(--r);font-size:.8rem;font-weight:700;color:var(--ink);white-space:nowrap}
.prow .eh.leer{color:var(--muted);font-weight:400}
.prow .zsumf{min-width:4.6rem}
.prow .zsum{font-size:.9rem;font-weight:700;font-variant-numeric:tabular-nums;
  color:var(--muted);white-space:nowrap;text-align:right;padding:.55rem 0}
.prow .zsum.hat{color:var(--ink)}

/* Lieferungszeile in der Liste */
.abweich{color:var(--wine);font-weight:700}
td.temp{font-variant-numeric:tabular-nums;white-space:nowrap}

@media(max-width:720px){
  .prow{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.45rem .5rem;
    padding:.8rem 0;position:relative}
  .prow .f.artikel{grid-column:1 / -1}
  .prow .zsumf{grid-column:1 / -1;display:flex;justify-content:space-between;align-items:baseline}
  .prow .zsumf label{margin:0}
  .prow .zsum{padding:0}
  .prow .weg{position:absolute;top:.55rem;right:0;height:auto;padding:.25rem .55rem;font-size:.85rem}
  .lkacheln{grid-template-columns:repeat(auto-fill,minmax(46%,1fr))}
  .ampel .pkt{width:22px;height:22px}
}
`;

/**
 * Wert für ein `<script type="application/json">`.
 *
 * `esc()` wäre hier falsch: Der Inhalt eines `<script>`-Elements wird **nicht**
 * als HTML geparst, ein `&quot;` bliebe also als Text stehen und `JSON.parse`
 * scheitert still. Zu schützen ist nur die Zeichenfolge, die das Element
 * vorzeitig beenden könnte.
 */
export const jsonBlock = v => JSON.stringify(v).replace(/</g, '\\u003c');
