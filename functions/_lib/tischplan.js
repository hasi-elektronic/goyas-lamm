/**
 * Tischplan — die Tische als Kärtchen auf einem Raster, je Bereich eine Fläche.
 *
 * Verschieben mit Finger oder Maus, das Kärtchen rastet beim Loslassen ein und
 * wird sofort gespeichert (POST /admin/tischplan). Antippen ohne Verschieben öffnet
 * die Bearbeitung darunter: Name, Plätze, Bereich, Form.
 *
 * Bewusst ohne Reservierungszuweisung („Gast X sitzt an Tisch 3") — der Plan ist
 * die Stammdatenpflege, nicht der Abendbetrieb. Siehe goyas-lamm-adminpanel.md.
 */

export const PLAN_COLS = 24;
export const PLAN_ROWS = 14;
export const PLAN_MAX  = 8;   // größte Kantenlänge eines Tischs in Feldern

export const TISCHPLAN_CSS = `
.tp{--cols:${PLAN_COLS};--rows:${PLAN_ROWS}}
.tp-tabs{display:flex;gap:.3rem;flex-wrap:wrap;padding:.8rem 1.1rem 0}
.tp-tabs button{font:inherit;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;
  font-weight:700;background:none;border:1px solid var(--sand);color:var(--muted);
  padding:.5rem .85rem;cursor:pointer;border-radius:var(--r)}
.tp-tabs button em{font-style:normal;font-weight:400;letter-spacing:0;text-transform:none;
  margin-left:.4rem;opacity:.75}
.tp-tabs button.on{background:var(--ink);border-color:var(--ink);color:var(--cream)}
.tp-wrap{padding:.9rem 1.1rem 1.1rem}
.tp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.tp-canvas{position:relative;width:100%;aspect-ratio:var(--cols)/var(--rows);
  background-color:#fff;border:1px solid var(--sand);overflow:hidden;touch-action:pan-y;
  background-image:linear-gradient(to right,rgba(20,18,15,.07) 1px,transparent 1px),
    linear-gradient(to bottom,rgba(20,18,15,.07) 1px,transparent 1px);
  background-size:calc(100%/var(--cols)) calc(100%/var(--rows))}
.tp-canvas.leer::after{content:"Noch kein Tisch in diesem Bereich. Bereich beim Tisch ändern oder unten anlegen.";
  position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);
  font-size:.85rem;text-align:center;padding:1rem}
.tp-t{position:absolute;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:.1rem;border:1.5px solid var(--sand);background:var(--paper);
  border-radius:6px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;
  padding:2px;overflow:hidden;line-height:1.15;box-shadow:0 1px 0 rgba(20,18,15,.06)}
.tp-t b{font-size:.8rem;font-weight:700;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:100%}
.tp-t span{font-size:.66rem;color:var(--muted);white-space:nowrap}
.tp-t.s2{background:#F1EFE8;border-color:#B4B2A9}
.tp-t.s4{background:#EEF3EC;border-color:#2E6B4F}
.tp-t.s6{background:#FBF5E8;border-color:var(--gold)}
.tp-t.s8{background:#F8EEF0;border-color:var(--wine)}
.tp-t.rund{border-radius:50%}
.tp-t.aus{opacity:.45;border-style:dashed}
.tp-t.on{outline:3px solid var(--gold);outline-offset:1px;z-index:3}
.tp-t.drag{cursor:grabbing;z-index:5;box-shadow:0 8px 20px rgba(20,18,15,.25);opacity:.92}
.tp-t.nein{animation:tp-nein .35s}
@keyframes tp-nein{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.tp-foot{display:flex;align-items:center;justify-content:space-between;gap:1rem;
  flex-wrap:wrap;margin-top:.7rem;font-size:.8rem;color:var(--muted)}
.tp-foot .tp-leg{display:flex;gap:.9rem;flex-wrap:wrap}
.tp-foot .tp-leg i{display:inline-block;width:11px;height:11px;border:1.5px solid;
  border-radius:3px;vertical-align:-1px;margin-right:.3rem}
.tp-status{min-height:1.2em;font-variant-numeric:tabular-nums}
.tp-status.ok{color:var(--ok)}.tp-status.err{color:var(--wine)}
.tp-edit{border-top:1px solid var(--sand);padding:1rem 1.1rem;background:var(--cream)}
.tp-edit h3{margin:0 0 .7rem;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted)}
.tp-edit .tp-form{display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-end}
.tp-edit .f{margin:0}
.tp-edit .f input,.tp-edit .f select{min-width:0}
.tp-edit .tp-nn{width:11rem}.tp-edit .tp-ns{width:5rem}.tp-edit .tp-na{width:9rem}
.tp-edit .tp-form-btn{display:flex;gap:.4rem;flex-wrap:wrap}
@media (max-width:719px){
  .tp-tabs{padding:.7rem .8rem 0}.tp-wrap{padding:.7rem .8rem .9rem}
  /* Am Handy wäre ein Feld nur 14px — der Plan bleibt 720px breit und lässt sich seitlich schieben */
  .tp-canvas{width:720px}
  .tp-t b{font-size:.7rem}.tp-t span{font-size:.6rem}
  .tp-edit .tp-nn,.tp-edit .tp-ns,.tp-edit .tp-na{width:100%}
  .tp-edit .f{flex:1 1 100%}
}`;

/** Sichere Einbettung von JSON in ein Inline-Script. */
const jsonInline = v => JSON.stringify(v)
  .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * Markup und Script für die Plankarte.
 * @param rows   Tische aus der Datenbank (mit pos_x, pos_y, w, h — dürfen null sein)
 * @param areas  Liste der Bereiche in Anzeige-Reihenfolge
 * @param opts   { schreiben: bool }  — Demo darf nur schauen
 */
export function tischplanCard(rows, areas, { schreiben = true } = {}) {
  const tables = rows.map(t => ({
    id: t.id, name: t.name, seats: Number(t.seats) || 0, area: t.area || areas[0],
    active: t.active ? 1 : 0, rund: t.rund ? 1 : 0,
    x: t.pos_x == null ? null : Number(t.pos_x),
    y: t.pos_y == null ? null : Number(t.pos_y),
    /* Noch nie im Plan: länglich vorbelegen — die Breite wächst mit den Plätzen
       (2 Felder je 4 Personen, ab 6 Plätzen wird der Tisch ein Riegel), Höhe bleibt 2 */
    w: t.pos_x == null
      ? (t.rund ? Math.min(PLAN_MAX, Math.max(2, Math.ceil(Number(t.seats) / 3)))
                : Math.min(PLAN_MAX, Math.max(2, Math.ceil(Number(t.seats) / 2))))
      : Math.min(PLAN_MAX, Math.max(1, Number(t.w) || 2)),
    h: t.pos_x == null
      ? (t.rund ? Math.min(PLAN_MAX, Math.max(2, Math.ceil(Number(t.seats) / 3))) : 2)
      : Math.min(PLAN_MAX, Math.max(1, Number(t.h) || 2)),
  }));

  return `
    <div class="card tp" id="tischplan">
      <h2>Tischplan <em>ziehen zum Verschieben · antippen zum Bearbeiten</em></h2>
      <div class="tp-tabs" id="tp-tabs"></div>
      <div class="tp-wrap">
        <div class="tp-scroll"><div class="tp-canvas" id="tp-canvas"></div></div>
        <div class="tp-foot">
          <div class="tp-leg">
            <span><i style="border-color:#B4B2A9;background:#F1EFE8"></i>bis 2</span>
            <span><i style="border-color:#2E6B4F;background:#EEF3EC"></i>3–4</span>
            <span><i style="border-color:var(--gold);background:#FBF5E8"></i>5–7</span>
            <span><i style="border-color:var(--wine);background:#F8EEF0"></i>ab 8</span>
            <span><i style="border-style:dashed;border-color:#B4B2A9;opacity:.5"></i>stillgelegt</span>
          </div>
          <div class="tp-status" id="tp-status" aria-live="polite"></div>
        </div>
      </div>
      <div class="tp-edit" id="tp-edit" hidden>
        <h3>Tisch bearbeiten</h3>
        <div class="tp-form">
          <div class="f"><label for="tp-nn">Name</label>
            <input id="tp-nn" class="tp-nn" maxlength="40"></div>
          <div class="f"><label for="tp-ns">Plätze</label>
            <input id="tp-ns" class="tp-ns" type="number" min="1" max="60"></div>
          <div class="f"><label for="tp-na">Bereich</label>
            <select id="tp-na" class="tp-na">
              ${areas.map(a => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`).join('')}
            </select></div>
          <div class="f"><label>Form</label>
            <div class="tp-form-btn">
              <button class="btn sm ghost" type="button" data-tp="rundeckig" id="tp-rund">Rund</button>
              <button class="btn sm ghost" type="button" data-tp="drehen" id="tp-drehen" title="Breite und Höhe tauschen">Drehen</button>
              <button class="btn sm ghost" type="button" data-tp="groesser">Größer</button>
              <button class="btn sm ghost" type="button" data-tp="kleiner">Kleiner</button>
            </div></div>
          <div class="f"><label>&nbsp;</label>
            <div class="tp-form-btn">
              <button class="btn sm" type="button" data-tp="speichern">Speichern</button>
              <button class="btn sm ghost" type="button" data-tp="zu">Schließen</button>
            </div></div>
        </div>
      </div>
    </div>
    <script>
    (function(){
      var COLS=${PLAN_COLS}, ROWS=${PLAN_ROWS}, MAX=${PLAN_MAX};
      var T=${jsonInline(tables)}, AREAS=${jsonInline(areas)}, SCHREIBEN=${schreiben ? 'true' : 'false'};
      var canvas=document.getElementById('tp-canvas'), tabs=document.getElementById('tp-tabs'),
          status=document.getElementById('tp-status'), edit=document.getElementById('tp-edit');
      var area=null, sel=null, byId={};
      T.forEach(function(t){ byId[t.id]=t; });

      /* Bereich mit den meisten Tischen zuerst anzeigen */
      (function(){
        var best=AREAS[0], n=-1;
        AREAS.forEach(function(a){ var c=T.filter(function(t){return t.area===a;}).length;
          if(c>n){best=a;n=c;} });
        area=best;
      })();

      function inArea(a){ return T.filter(function(t){ return t.area===a; }); }
      function ueberlappt(t, x, y, w, h, a, rand){
        if(x<0||y<0||x+w>COLS||y+h>ROWS) return true;
        var r=rand||0;
        return inArea(a).some(function(o){
          if(o===t||o.x==null) return false;
          return x-r<o.x+o.w && x+w+r>o.x && y-r<o.y+o.h && y+h+r>o.y;
        });
      }
      /* Tische ohne Position: in die nächste freie Lücke, zeilenweise */
      function autoPlace(){
        var geaendert=[];
        AREAS.forEach(function(a){
          inArea(a).forEach(function(t){
            if(t.x!=null&&t.y!=null&&!ueberlappt(t,t.x,t.y,t.w,t.h,a)) return;
            outer: for(var y=1;y<=ROWS-t.h;y++) for(var x=1;x<=COLS-t.w;x++){
              if(!ueberlappt(t,x,y,t.w,t.h,a,1)){ t.x=x; t.y=y; geaendert.push(t); break outer; }
            }
            if(t.x==null){
              outer2: for(var y2=0;y2<=ROWS-t.h;y2++) for(var x2=0;x2<=COLS-t.w;x2++){
                if(!ueberlappt(t,x2,y2,t.w,t.h,a)){ t.x=x2; t.y=y2; break outer2; }
              }
              if(t.x==null){ t.x=0; t.y=0; }
              geaendert.push(t);
            }
          });
        });
        return geaendert;
      }

      function klasse(t){
        var s=t.seats<=2?'s2':t.seats<=4?'s4':t.seats<=7?'s6':'s8';
        return 'tp-t '+s+(t.rund?' rund':'')+(t.active?'':' aus')+(sel===t?' on':'');
      }
      function pos(el,t){
        el.style.left=(t.x/COLS*100)+'%'; el.style.top=(t.y/ROWS*100)+'%';
        el.style.width=(t.w/COLS*100)+'%'; el.style.height=(t.h/ROWS*100)+'%';
      }
      function render(){
        tabs.innerHTML='';
        AREAS.forEach(function(a){
          var b=document.createElement('button'); b.type='button';
          var n=inArea(a).length, p=inArea(a).reduce(function(s,t){return s+(t.active?t.seats:0);},0);
          b.innerHTML=a+'<em>'+n+' · '+p+' Pl.</em>';
          if(a===area) b.className='on';
          b.onclick=function(){ area=a; sel=null; edit.hidden=true; render(); };
          tabs.appendChild(b);
        });
        canvas.innerHTML='';
        var list=inArea(area);
        canvas.classList.toggle('leer',!list.length);
        list.forEach(function(t){
          var el=document.createElement('div'); el.className=klasse(t); el.dataset.id=t.id;
          el.innerHTML='<b></b><span></span>';
          el.firstChild.textContent=t.name; el.lastChild.textContent=t.seats+' Pers.';
          el.title=t.name+' · '+t.seats+' Plätze'+(t.active?'':' · stillgelegt');
          pos(el,t); canvas.appendChild(el);
        });
      }

      function zeige(text,cls){ status.textContent=text; status.className='tp-status '+(cls||''); }
      var timer=null;
      function speichern(items, dann){
        if(!SCHREIBEN){ zeige('Nur zum Anschauen — dieser Zugang kann nichts ändern.','err'); return; }
        var body=items.map(function(t){ return {id:t.id,x:t.x,y:t.y,w:t.w,h:t.h,
          name:t.name,seats:t.seats,area:t.area,rund:t.rund}; });
        zeige('Speichert …');
        fetch('/admin/tischplan',{method:'POST',credentials:'same-origin',
          headers:{'content-type':'application/json'},body:JSON.stringify({tables:body})})
        .then(function(r){ return r.json().catch(function(){ return {ok:false,error:'Antwort '+r.status}; }); })
        .then(function(j){
          if(j&&j.ok){ zeige('Gespeichert ✓','ok'); clearTimeout(timer);
            timer=setTimeout(function(){ zeige(''); },2500); if(dann) dann(); }
          else zeige((j&&j.error)||'Das hat nicht geklappt.','err');
        })
        .catch(function(){ zeige('Keine Verbindung — bitte noch einmal versuchen.','err'); });
      }

      /* Ziehen mit Finger oder Maus */
      var drag=null;
      canvas.addEventListener('pointerdown',function(e){
        var el=e.target.closest('.tp-t'); if(!el) return;
        var t=byId[el.dataset.id]; if(!t) return;
        e.preventDefault();
        var r=canvas.getBoundingClientRect();
        drag={t:t,el:el,sx:e.clientX,sy:e.clientY,cw:r.width/COLS,ch:r.height/ROWS,moved:false,id:e.pointerId};
        el.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove',function(e){
        if(!drag||e.pointerId!==drag.id) return;
        var dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
        if(!drag.moved && Math.abs(dx)+Math.abs(dy)<6) return;
        if(!drag.moved){ drag.moved=true; drag.el.classList.add('drag'); }
        drag.el.style.transform='translate('+dx+'px,'+dy+'px)';
      });
      function ende(e){
        if(!drag||e.pointerId!==drag.id) return;
        var d=drag; drag=null;
        d.el.classList.remove('drag'); d.el.style.transform='';
        if(!d.moved){ waehle(d.t); return; }
        if(!SCHREIBEN){ zeige('Nur zum Anschauen — dieser Zugang kann nichts ändern.','err'); return; }
        var nx=Math.round(d.t.x+(e.clientX-d.sx)/d.cw), ny=Math.round(d.t.y+(e.clientY-d.sy)/d.ch);
        nx=Math.max(0,Math.min(COLS-d.t.w,nx)); ny=Math.max(0,Math.min(ROWS-d.t.h,ny));
        if(nx===d.t.x&&ny===d.t.y) return;
        if(ueberlappt(d.t,nx,ny,d.t.w,d.t.h,d.t.area)){
          d.el.classList.add('nein'); setTimeout(function(){ d.el.classList.remove('nein'); },400);
          zeige('Da steht schon ein Tisch.','err'); return;
        }
        d.t.x=nx; d.t.y=ny; pos(d.el,d.t); speichern([d.t]);
      }
      canvas.addEventListener('pointerup',ende);
      canvas.addEventListener('pointercancel',function(e){
        if(drag&&e.pointerId===drag.id){ drag.el.classList.remove('drag'); drag.el.style.transform=''; drag=null; }
      });

      /* Bearbeiten */
      var nn=document.getElementById('tp-nn'), ns=document.getElementById('tp-ns'), na=document.getElementById('tp-na');
      var bRund=document.getElementById('tp-rund'), bDrehen=document.getElementById('tp-drehen');
      function waehle(t){
        sel=t; render();
        nn.value=t.name; ns.value=t.seats; na.value=t.area;
        bRund.textContent=t.rund?'Eckig':'Rund';
        bDrehen.disabled=!!t.rund; bDrehen.style.opacity=t.rund?'.4':'';
        edit.hidden=false;
        if(window.innerWidth<720) edit.scrollIntoView({block:'nearest',behavior:'smooth'});
      }
      function formAendern(fn){
        if(!sel) return;
        var w=sel.w,h=sel.h; fn();
        sel.w=Math.max(1,Math.min(MAX,sel.w)); sel.h=Math.max(1,Math.min(MAX,sel.h));
        if(sel.x+sel.w>COLS) sel.x=COLS-sel.w; if(sel.y+sel.h>ROWS) sel.y=ROWS-sel.h;
        if(ueberlappt(sel,sel.x,sel.y,sel.w,sel.h,sel.area)){ sel.w=w; sel.h=h; zeige('So passt er nicht — daneben steht ein Tisch.','err'); render(); return; }
        render(); speichern([sel]);
      }
      edit.addEventListener('click',function(e){
        var b=e.target.closest('button[data-tp]'); if(!b||!sel) return;
        var was=b.dataset.tp;
        if(was==='zu'){ sel=null; edit.hidden=true; render(); return; }
        if(was==='rundeckig'){
          formAendern(function(){
            sel.rund=sel.rund?0:1;
            if(sel.rund){ var d=Math.max(sel.w,sel.h); sel.w=d; sel.h=d; }
            else { sel.h=Math.min(sel.h,2); }
          });
          bRund.textContent=sel&&sel.rund?'Eckig':'Rund';
          if(sel){ bDrehen.disabled=!!sel.rund; bDrehen.style.opacity=sel.rund?'.4':''; }
          return;
        }
        if(was==='drehen'){ if(sel.rund) return; formAendern(function(){ var w=sel.w; sel.w=sel.h; sel.h=w; }); return; }
        /* Wächst nur in die Länge — quer liegende Tische werden breiter,
           hochkant gedrehte höher. Quadratisch wird nichts mehr. */
        /* Runde Tische wachsen als Kreis (beide Seiten), eckige nur in die Länge. */
        if(was==='groesser'){ formAendern(function(){ if(sel.rund){ sel.w++; sel.h++; } else if(sel.h>sel.w) sel.h++; else sel.w++; }); return; }
        if(was==='kleiner'){ formAendern(function(){ if(sel.rund){ sel.w--; sel.h--; } else if(sel.h>sel.w) sel.h--; else sel.w--; }); return; }
        if(was==='speichern'){
          var name=nn.value.trim(), seats=parseInt(ns.value,10), a=na.value;
          if(!name){ zeige('Bitte einen Namen angeben.','err'); return; }
          if(!(seats>=1&&seats<=60)){ zeige('Plätze bitte zwischen 1 und 60.','err'); return; }
          if(T.some(function(o){ return o!==sel&&o.name===name; })){ zeige('„'+name+'" gibt es schon.','err'); return; }
          var seatsAlt=sel.seats;
          sel.name=name; sel.seats=seats;
          /* Mehr oder weniger Plätze: der Tisch passt seine Länge an (Höhe bleibt),
             hochkant gedrehte behalten die Ausrichtung. Passt es nicht, bleibt die alte Form. */
          if(seats!==seatsAlt){
            var hochkant=sel.h>sel.w, lang=Math.min(MAX,Math.max(2,Math.ceil(seats/2)));
            var w0=sel.w,h0=sel.h;
            if(sel.rund){ var d=Math.min(MAX,Math.max(2,Math.ceil(seats/3))); sel.w=d; sel.h=d; }
            else { sel.w=hochkant?2:lang; sel.h=hochkant?lang:2; }
            if(sel.x+sel.w>COLS) sel.x=Math.max(0,COLS-sel.w);
            if(sel.y+sel.h>ROWS) sel.y=Math.max(0,ROWS-sel.h);
            if(ueberlappt(sel,sel.x,sel.y,sel.w,sel.h,sel.area)){ sel.w=w0; sel.h=h0; }
          }
          if(a!==sel.area){ sel.area=a; sel.x=null; sel.y=null; autoPlace(); area=a; }
          /* Plätze ändern Kennzahlen und Kapazität — danach die Seite neu laden */
          speichern([sel],function(){ location.reload(); });
          render();
        }
      });

      var neu=autoPlace(); render();
      if(neu.length&&SCHREIBEN) speichern(neu);
    })();
    </script>`;
}
