/* Goya´s Lamm Horrheim — gemeinsames Verhalten aller Seiten.
   Kopfzeile, Menue, Einblendungen, Reservierung, Lightbox.
   Jeder Teil prueft selbst, ob es die Elemente auf dieser Seite gibt. */
(function(){
  /* Ohne Sprungmarke immer oben starten (auch nach Reload oder Zurück-Taste). */
  function toTop(){
    if (location.hash) return;
    try { window.scrollTo({ top:0, left:0, behavior:'instant' }); }
    catch(e){ window.scrollTo(0,0); }
  }
  toTop();
  window.addEventListener('load', toTop);
  window.addEventListener('pageshow', function(e){ if(e.persisted) toTop(); });

  var hdr=document.getElementById('hdr');
  function onScroll(){ hdr.classList.toggle('solid', window.scrollY>60); }
  onScroll(); window.addEventListener('scroll',onScroll,{passive:true});

  var b=document.getElementById('burger'), m=document.getElementById('mmenu'), c=document.getElementById('mclose');
  function close(){ m.classList.remove('open'); b.setAttribute('aria-expanded','false'); document.body.style.overflow=''; }
  b.addEventListener('click',function(){ m.classList.add('open'); b.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; });
  c.addEventListener('click',close);
  m.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',close); });

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el,i){ el.style.transitionDelay=(i%3)*70+'ms'; io.observe(el); });

  /* ---------- Reservierung ---------- */
  (function(){
    var form=document.getElementById('resForm');
    if(!form) return;
    var MAXG=10, PHONE='07042 83 22 82';
    var state={guests:2,date:'',time:'',warte:false};
    var gWrap=document.getElementById('guestChips'),
        gHint=document.getElementById('guestHint'),
        dInp =document.getElementById('resDate'),
        dQuick=document.getElementById('dateQuick'),
        dHint=document.getElementById('dateHint'),
        tWrap=document.getElementById('timeChips'),
        tHint=document.getElementById('timeHint'),
        msg  =document.getElementById('resMsg'),
        btn  =document.getElementById('resSubmit'),
        wBox =document.getElementById('warteBox'),
        wHint=document.getElementById('warteHint');

    document.getElementById('resTs').value=Date.now();

    var WD=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    var MO=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    function labelDE(v){var p=v.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]);
      return WD[d.getDay()]+', '+(+p[2])+'. '+MO[+p[1]-1]+' '+p[0];}

    /* --- Personen --- */
    for(var n=1;n<=MAXG;n++){
      (function(n){
        var b=document.createElement('button');
        b.type='button'; b.className='chip'; b.textContent=n;
        b.setAttribute('aria-pressed', n===state.guests?'true':'false');
        b.addEventListener('click',function(){
          state.guests=n;
          [].forEach.call(gWrap.children,function(c){c.setAttribute('aria-pressed', c===b?'true':'false')});
          gHint.hidden=true;
          ladeMonat();                 // andere Personenzahl → andere Tage sind voll
          if(state.date) loadSlots();
        });
        gWrap.appendChild(b);
      })(n);
    }
    var more=document.createElement('button');
    more.type='button'; more.className='chip wide'; more.textContent='11+';
    more.addEventListener('click',function(){ gHint.hidden=false; });
    gWrap.appendChild(more);

    /* --- Datum: Monatskalender --- */
    var today=new Date(), maxD=new Date(); maxD.setDate(maxD.getDate()+90);
    var kalTage=document.getElementById('kalTage'),
        kalMonat=document.getElementById('kalMonat'),
        kalZurueck=document.getElementById('kalZurueck'),
        kalVor=document.getElementById('kalVor'),
        kalStand={y:today.getFullYear(), m:today.getMonth()},   // m: 0–11
        kalCache={};                                            // '2026-09' → {tag: status}

    function monatKey(y,m){ return y+'-'+String(m+1).padStart(2,'0'); }

    function quick(label,d){
      var b=document.createElement('button');
      b.type='button'; b.className='chip'; b.textContent=label;
      b.dataset.iso=iso(d); b.setAttribute('aria-pressed','false');
      b.addEventListener('click',function(){ waehle(b.dataset.iso); });
      dQuick.appendChild(b);
    }
    (function(){
      var t=new Date(), tm=new Date(); tm.setDate(tm.getDate()+1);
      if(t.getDay()!==3) quick('Heute',t);
      if(tm.getDay()!==3) quick('Morgen',tm);
      var fr=new Date(); do{fr.setDate(fr.getDate()+1);}while(fr.getDay()!==5);
      quick('Freitag',fr);
      var sa=new Date(); do{sa.setDate(sa.getDate()+1);}while(sa.getDay()!==6);
      quick('Samstag',sa);
    })();

    /* Der Kalender kennt drei Zustände je Tag: frei, ausgebucht, geschlossen.
       Sie kommen vom Server, damit Ruhetage, Urlaub und volle Abende gleich
       sichtbar sind — und zwar für die aktuell gewählte Personenzahl. */
    function ladeMonat(){
      var key=monatKey(kalStand.y,kalStand.m)+'|'+state.guests;
      kalMonat.textContent = MO[kalStand.m]+' '+kalStand.y;
      if(kalCache[key]){ zeichneMonat(kalCache[key]); return; }
      kalTage.classList.add('kal-laedt');
      zeichneMonat(null);
      fetch('/api/slots?month='+monatKey(kalStand.y,kalStand.m)+'&guests='+state.guests,
            {headers:{accept:'application/json'}})
        .then(function(r){ return r.json(); })
        .then(function(d){ kalCache[key]=d.days||{}; kalTage.classList.remove('kal-laedt'); zeichneMonat(d.days||{}); })
        .catch(function(){ kalTage.classList.remove('kal-laedt'); zeichneMonat({}); });
    }

    function zeichneMonat(tage){
      kalTage.innerHTML='';
      var erster=new Date(kalStand.y, kalStand.m, 1);
      var versatz=(erster.getDay()+6)%7;                       // Woche beginnt am Montag
      var anzahl=new Date(kalStand.y, kalStand.m+1, 0).getDate();
      var heute=iso(new Date());
      for(var i=0;i<versatz;i++){
        var l=document.createElement('span'); l.className='leer'; kalTage.appendChild(l);
      }
      for(var d=1;d<=anzahl;d++){
        (function(d){
          var v=monatKey(kalStand.y,kalStand.m)+'-'+String(d).padStart(2,'0');
          var st=tage ? (tage[v]||'past') : 'past';
          var el;
          if(st==='open'){
            el=document.createElement('button');
            el.type='button'; el.textContent=d;
            el.setAttribute('aria-pressed', v===state.date?'true':'false');
            el.setAttribute('aria-label', labelDE(v));
            el.addEventListener('click',function(){ waehle(v); });
          } else {
            el=document.createElement('span');
            el.textContent=d;
            el.className = st==='full' ? 'voll' : (st==='past' ? 'weg' : 'zu');
            el.setAttribute('title', st==='full' ? 'ausgebucht'
              : st==='ruhetag' ? 'Ruhetag' : st==='closed' ? 'geschlossen' : '');
          }
          if(v===heute) el.classList.add('heute');
          kalTage.appendChild(el);
        })(d);
      }
      var erstesImMonat=new Date(kalStand.y,kalStand.m,1);
      kalZurueck.disabled = erstesImMonat <= new Date(today.getFullYear(),today.getMonth(),1);
      kalVor.disabled = new Date(kalStand.y,kalStand.m+1,1) > maxD;
    }

    kalZurueck.addEventListener('click',function(){
      if(--kalStand.m<0){ kalStand.m=11; kalStand.y--; } ladeMonat();
    });
    kalVor.addEventListener('click',function(){
      if(++kalStand.m>11){ kalStand.m=0; kalStand.y++; } ladeMonat();
    });

    function waehle(v){
      state.date=v; state.time='';
      document.getElementById('resDate').value=v;
      var p=v.split('-');
      kalStand.y=+p[0]; kalStand.m=+p[1]-1;
      [].forEach.call(dQuick.children,function(c){
        c.setAttribute('aria-pressed', c.dataset.iso===state.date ? 'true' : 'false');
      });
      dHint.textContent=labelDE(v); dHint.className='res-hint';
      ladeMonat();
      loadSlots();
    }

    ladeMonat();

    /* --- Zeiten --- */
    function setTimeHint(txt,warn){ tHint.textContent=txt; tHint.className='res-hint'+(warn?' warn':''); }

    function loadSlots(){
      tWrap.innerHTML=''; state.time=''; wBox.hidden=true;
      if(state.warte) warteAus();
      if(!state.date){ setTimeHint('Bitte wählen Sie zuerst ein Datum.'); return; }
      setTimeHint('Freie Zeiten werden geladen …');
      fetch('/api/slots?date='+encodeURIComponent(state.date)+'&guests='+state.guests,{headers:{accept:'application/json'}})
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d.closed){ setTimeHint(d.reason==='Ruhetag'
            ? 'Mittwoch ist unser Ruhetag. Bitte wählen Sie einen anderen Tag.'
            : 'An diesem Tag haben wir geschlossen ('+d.reason+').', true); return; }
          if(!d.slots || !d.slots.length){
            setTimeHint('Für '+state.guests+' Personen ist an diesem Tag leider nichts mehr frei.', true);
            wBox.hidden=false; return; }
          setTimeHint('');
          d.slots.forEach(function(sl){
            var b=document.createElement('button');
            b.type='button'; b.className='chip'; b.textContent=sl.time;
            b.setAttribute('aria-pressed','false');
            b.addEventListener('click',function(){
              state.time=sl.time;
              [].forEach.call(tWrap.children,function(c){c.setAttribute('aria-pressed', c===b?'true':'false')});
              msg.textContent=''; msg.className='res-msg';
            });
            tWrap.appendChild(b);
          });
        })
        .catch(function(){
          setTimeHint('Die Zeiten konnten nicht geladen werden. Bitte rufen Sie uns an: '+PHONE, true);
        });
    }

    /* --- Warteliste --- */
    function warteAn(){
      state.warte=true;
      wBox.hidden=true; tWrap.innerHTML=''; setTimeHint('');
      wHint.hidden=false; document.getElementById('warteTag').textContent=dLabel(state.date);
      form.classList.add('warte');
      [].forEach.call(document.querySelectorAll('.mail-opt'),function(e){e.hidden=false});
      document.getElementById('resMail').required=false;
      btn.textContent='Auf die Warteliste setzen';
      wHint.scrollIntoView({block:'center'});
    }
    function warteAus(){
      state.warte=false;
      wHint.hidden=true; form.classList.remove('warte');
      [].forEach.call(document.querySelectorAll('.mail-opt'),function(e){e.hidden=true});
      document.getElementById('resMail').required=true;
      btn.textContent='Tisch verbindlich reservieren';
    }
    function dLabel(iso){
      if(!iso) return '';
      var t=iso.split('-');
      return WT[new Date(Date.UTC(+t[0],+t[1]-1,+t[2])).getUTCDay()]+', '+(+t[2])+'.'+(+t[1])+'.'+t[0];
    }
    var WT=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    document.getElementById('warteAn').addEventListener('click',warteAn);
    document.getElementById('warteAus').addEventListener('click',function(){ warteAus(); loadSlots(); });

    /* --- Absenden --- */
    function invalid(el,on){ el.setAttribute('aria-invalid', on?'true':'false'); }

    form.addEventListener('submit',function(e){
      e.preventDefault();
      msg.className='res-msg'; msg.textContent='';
      var name=document.getElementById('resName'),
          mail=document.getElementById('resMail'),
          tel =document.getElementById('resPhone');
      [name,mail,tel].forEach(function(el){invalid(el,false)});

      if(!state.date){ msg.className='res-msg err'; msg.textContent='Bitte wählen Sie im Kalender einen Tag.';
        document.querySelector('.kal').scrollIntoView({block:'center'}); return; }
      if(!state.warte && !state.time){ msg.className='res-msg err'; msg.textContent='Bitte wählen Sie eine Uhrzeit.'; tWrap.scrollIntoView({block:'center'}); return; }
      if(name.value.trim().length<2){ invalid(name,true); msg.className='res-msg err'; msg.textContent='Bitte geben Sie Ihren Namen an.'; name.focus(); return; }
      if((!state.warte || mail.value.trim()) &&
         !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(mail.value.trim())){ invalid(mail,true); msg.className='res-msg err'; msg.textContent='Bitte prüfen Sie Ihre E-Mail-Adresse.'; mail.focus(); return; }
      if(tel.value.replace(/[^\d]/g,'').length<6){ invalid(tel,true); msg.className='res-msg err'; msg.textContent='Bitte geben Sie eine Telefonnummer an.'; tel.focus(); return; }

      var zurueck = state.warte ? 'Auf die Warteliste setzen' : 'Tisch verbindlich reservieren';
      btn.disabled=true; btn.textContent='Wird gesendet …';
      var payload={
        date:state.date, time:state.time, guests:state.guests,
        name:name.value.trim(), email:mail.value.trim(), phone:tel.value.trim(),
        note:document.getElementById('resNote').value.trim(),
        website:form.website.value, ts:document.getElementById('resTs').value
      };
      fetch(state.warte ? '/api/warteliste' : '/api/reservierung',
            {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
        .then(function(res){
          if(!res.ok || !res.j.ok){
            btn.disabled=false; btn.textContent=zurueck;
            msg.className='res-msg err';
            msg.textContent=(res.j && res.j.message) || 'Das hat nicht geklappt. Bitte rufen Sie uns an: '+PHONE;
            if(res.j && (res.j.error==='slot_taken')) loadSlots();
            return;
          }
          if(state.warte){ wartefertig(res.j, payload); return; }
          done(res.j, payload);
        })
        .catch(function(){
          btn.disabled=false; btn.textContent=zurueck;
          msg.className='res-msg err';
          msg.textContent='Verbindung fehlgeschlagen. Bitte rufen Sie uns an: '+PHONE;
        });
    });

    function wartefertig(d,p){
      var wrap=document.getElementById('resDone');
      wrap.querySelector('h3').textContent = d.doppelt
        ? 'Sie stehen schon auf der Liste.' : 'Sie stehen auf der Warteliste.';
      document.getElementById('doneLead').textContent = d.doppelt
        ? 'Für diesen Abend haben wir Ihre Nummer bereits.'
        : 'Danke, '+p.name.split(' ')[0]+'. Wird ein Tisch frei, rufen wir Sie an.';
      document.getElementById('doneDl').innerHTML =
        '<div><span>Wunschtag</span><span>'+dLabel(p.date)+'</span></div>'+
        '<div><span>Personen</span><span>'+p.guests+'</span></div>'+
        '<div><span>Rückruf an</span><span>'+p.phone.replace(/</g,'')+'</span></div>';
      document.getElementById('doneNote').innerHTML =
        '<b>Das ist noch keine Reservierung.</b> Ein Tisch ist erst sicher, wenn wir uns bei Ihnen '+
        'gemeldet haben. Sie können uns auch direkt anrufen: '+PHONE+'.';
      form.hidden=true; wrap.hidden=false;
      wrap.scrollIntoView({behavior:'smooth',block:'center'});
    }

    function done(d,p){
      var wrap=document.getElementById('resDone');
      document.getElementById('doneLead').textContent =
        'Wir freuen uns auf Sie, '+p.name.split(' ')[0]+'.';
      document.getElementById('doneDl').innerHTML =
        '<div><span>Datum</span><span>'+d.dateLabel+'</span></div>'+
        '<div><span>Uhrzeit</span><span>'+d.time+' Uhr</span></div>'+
        '<div><span>Personen</span><span>'+d.guests+'</span></div>'+
        '<div><span>Nummer</span><span>'+d.id+'</span></div>';
      document.getElementById('doneNote').innerHTML = d.mailed
        ? 'Eine Bestätigung ist an <b>'+p.email.replace(/</g,'')+'</b> unterwegs. '+
          'Falls sich etwas ändert, genügt ein Anruf unter '+PHONE+'.'
        : 'Notieren Sie sich gerne die Nummer. Bei Änderungen erreichen Sie uns unter '+PHONE+'.';
      form.hidden=true; wrap.hidden=false;
      wrap.scrollIntoView({behavior:'smooth',block:'center'});
    }
  })();

  /* ---- Galerie: Lightbox + Mobile-Fortschritt ---- */
  // Teller-Karten hängen mit in der Lightbox, tragen aber eigene Optik —
  // deshalb hier zwei Selektoren statt einer gemeinsamen Klasse.
  var gItems=[].slice.call(document.querySelectorAll('.teller[data-src], .g-item'));
  var lb=document.getElementById('lb'), lbImg=document.getElementById('lbImg'),
      lbCap=document.getElementById('lbCap'), lbCount=document.getElementById('lbCount'),
      gi=0, lastFocus=null;
  function render(){
    var el=gItems[gi];
    lbImg.src=el.dataset.src;
    lbImg.alt=el.dataset.title+' — '+el.dataset.sub;
    lbCap.innerHTML=el.dataset.title+'<small>'+el.dataset.sub+'</small>';
    lbCount.textContent=(gi+1)+' / '+gItems.length;
  }
  function openLb(i){ gi=i; lastFocus=document.activeElement; render(); lb.classList.add('open');
    document.body.style.overflow='hidden'; document.getElementById('lbClose').focus(); }
  function closeLb(){ lb.classList.remove('open'); document.body.style.overflow='';
    if(lastFocus) lastFocus.focus(); }
  function step(n){ gi=(gi+n+gItems.length)%gItems.length; render(); }
  gItems.forEach(function(el,i){ el.addEventListener('click',function(){ openLb(i); }); });
  document.getElementById('lbClose').addEventListener('click',closeLb);
  document.getElementById('lbPrev').addEventListener('click',function(){step(-1)});
  document.getElementById('lbNext').addEventListener('click',function(){step(1)});
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.tagName==='FIGURE') closeLb(); });
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('open')) return;
    if(e.key==='Escape') closeLb();
    else if(e.key==='ArrowRight') step(1);
    else if(e.key==='ArrowLeft') step(-1);
  });
  var tsx=0,tsy=0;
  lb.addEventListener('touchstart',function(e){tsx=e.changedTouches[0].clientX;tsy=e.changedTouches[0].clientY},{passive:true});
  lb.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-tsx, dy=e.changedTouches[0].clientY-tsy;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)) step(dx<0?1:-1);
    else if(dy>90&&Math.abs(dy)>Math.abs(dx)) closeLb();
  },{passive:true});

  var gal=document.getElementById('gallery'), bar=document.querySelector('.g-progress span');
  if(gal&&bar){
    gal.addEventListener('scroll',function(){
      var max=gal.scrollWidth-gal.clientWidth;
      var p=max>0?gal.scrollLeft/max:0;
      bar.style.left=(p*78)+'%';
    },{passive:true});
  }

  /* Der heutige Tag wird hervorgehoben — auf jeder Seite, die eine
     Oeffnungszeiten-Tabelle zeigt (Startseite und /kontakt). */
  var d=new Date().getDay();
  [].forEach.call(document.querySelectorAll('.hours tr[data-d="'+d+'"]'),
    function(r){ r.classList.add('today'); });
  document.getElementById('yr').textContent=new Date().getFullYear();
})();
