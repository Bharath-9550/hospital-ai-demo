/* Observer-only mascot. Does not read credentials or call authentication. */
(() => {
  const p = document.getElementById('paBot') ? 'pa' : 'db';
  const patient = p === 'pa', $ = id => document.getElementById(id);
  const bot = $(p+'Bot'), gate = $(patient?'paLogin':'authGate');
  const card = gate?.querySelector(patient?'.pa-card':'.auth-card');
  if (!bot || !gate || !card) return;
  const stage = bot.querySelector('.'+p+'-bot-stage'), bubble = $(p+'BotBubble');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = {}, cleanups = [], timers = new Set();
  let gazeRAF=0, gx=0, gy=0, tx=0, ty=0, nextBlink=0, blinkStart=0, lastMove=0, eyeCanvas=null, eyeAtlas=null, eyeOriginal=null, lastTile=-1, helloAttempted=false, interacted=false;
  let state = '', epoch = 0, frame = 0, pose = 'normal', greeted = false, wasOpen = false, pending = false, lastRect = null;
  const shown = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const listen = (el, event, fn, opts) => { if (!el) return; el.addEventListener(event,fn,opts); cleanups.push(()=>el.removeEventListener(event,fn,opts)); };
  const later = (fn, ms) => { const token = epoch; const t = setTimeout(()=>{timers.delete(t); if(token===epoch) fn();},ms); timers.add(t); };
  function cancel() { epoch++; timers.forEach(clearTimeout); timers.clear(); }
  function setPose(name) {
    pose = name;
    if(eyeCanvas) { eyeCanvas.style.visibility=name==='normal'?'visible':'hidden'; eyeOriginal.style.visibility='hidden'; }
    const selected = assets[name]?.ready ? name : 'normal';
    Object.entries(assets).forEach(([key,a])=>{a.img.style.visibility=key===selected?'visible':'hidden'; if(key==='normal'&&eyeCanvas) a.img.style.visibility='hidden';});
  }
  const original = $(p+'BotImg');
  ['normal','shy','happy','wave','concerned'].forEach(name=>{
    const img = name==='normal'?original:new Image();
    img.alt=''; img.classList.add('mascot-pose'); img.draggable=false;
    const a=assets[name]={img,ready:false};
    if(name!=='normal') stage.prepend(img);
    img.src='bot-'+name+'.webp';
    img.decode().then(()=>{a.ready=true;setPose(pose);}).catch(()=>{if(name==='normal') bot.dataset.assetError='true';});
  });
  stage.querySelector('canvas')?.remove();
  // Smooth local pixel warp; no rectangular atlas swaps.
  let source, output, fc, lastPaint=0,lastTick=0;
  const X=135,Y=180,W=210,H=125;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  original.decode().then(()=>{
    eyeOriginal=original;eyeCanvas=document.createElement('canvas');eyeCanvas.width=eyeCanvas.height=480;
    eyeCanvas.className='mascot-pose';stage.append(eyeCanvas);fc=eyeCanvas.getContext('2d',{willReadFrequently:true});fc.drawImage(original,0,0,480,480);
    source=fc.getImageData(X,Y,W,H);output=fc.createImageData(W,H);setPose(pose);startEyes();
  }).catch(e=>console.warn('Mascot motion unavailable',e));
  function drawFace(gx,gy,blink,mouth){
    if(!fc)return;const src=source.data,dst=output.data;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const px=x+X,py=y+Y;let sx=x,sy=y;
      for(const cx of [184,295]){
        const dx=px-cx,dy=py-229;
        const w=1-smooth((Math.sqrt((dx/45)**2+(dy/42)**2)-.57)/.43);
        sx-=gx*9*w;sy-=gy*5*w;
        const ay=Math.abs(dy),inner=24,outer=39,k=1-.91*blink,edge=inner*k;
        const mapped=ay<=edge?ay/k:ay<outer?inner+(ay-edge)*(outer-inner)/(outer-edge):ay;
        sy+=(Math.sign(dy)*mapped-dy)*(1-smooth((Math.abs(dx)-23)/20));
      }
      const mx=px-240,my=py-269,mw=1-smooth((Math.sqrt((mx/35)**2+(my/29)**2)-.55)/.45);
      sy-=my*mouth*.26*mw;
      sx=clamp(sx,0,W-1);sy=clamp(sy,0,H-1);
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      const a=(iy*W+ix)*4,b=(iy*W+Math.min(ix+1,W-1))*4,c=(Math.min(iy+1,H-1)*W+ix)*4,d=(Math.min(iy+1,H-1)*W+Math.min(ix+1,W-1))*4,o=(y*W+x)*4;
      for(let j=0;j<4;j++)dst[o+j]=(src[a+j]*(1-fx)+src[b+j]*fx)*(1-fy)+(src[c+j]*(1-fx)+src[d+j]*fx)*fy;
    }fc.putImageData(output,X,Y);
  }
  function stopEyes(){if(gazeRAF)cancelAnimationFrame(gazeRAF);gazeRAF=0;blinkStart=0;gx=gy=tx=ty=0;lastPaint=lastTick=0;drawFace(0,0,0,0);}
  function startEyes(){if(gazeRAF||!eyeCanvas||motion.matches||document.hidden||!['idle','typing','verifying'].includes(state))return;nextBlink=performance.now()+1500;lastMove=performance.now()-3000;gazeRAF=requestAnimationFrame(eyeLoop);}
  function eyeLoop(t){
    gazeRAF=0;if(motion.matches||document.hidden||!['idle','typing','verifying'].includes(state)){stopEyes();return;}
    const dt=lastTick?Math.min(80,t-lastTick):16;lastTick=t;
    if(t-lastMove>2800){tx=(Math.random()-.5)*1.7;ty=(Math.random()-.5)*1.1;lastMove=t;}
    const ease=1-Math.exp(-dt/100);gx+=(tx-gx)*ease;gy+=(ty-gy)*ease;
    if(t>=nextBlink&&!blinkStart)blinkStart=t;
    let blink=0;if(blinkStart){const d=t-blinkStart;blink=d<100?smooth(d/100):d<165?1:d<290?1-smooth((d-165)/125):0;if(d>=290){blinkStart=0;nextBlink=t+2700+Math.random()*1900;}}
    if(t-lastPaint>=30){lastPaint=t;drawFace(gx,gy,blink,.65*Math.sin(t/620));}
    stage.style.setProperty('--mascot-lean',(gx*5+Math.sin(t/1100)*2.5)+'deg');gazeRAF=requestAnimationFrame(eyeLoop);
  }

  function say(text) { bubble.textContent=text; bubble.classList.toggle('mascot-speech',!!text); queuePlace(); }
  function place() {
    frame=0;
    if(bot.hidden) return;
    if(shown(gate)) { const r=card.getBoundingClientRect(); if(r.width) lastRect=r; }
    if(!lastRect) return;
    const r=lastRect, vw=document.documentElement.clientWidth, vh=window.innerHeight;
    const size=Math.min(vw<700?84:patient?118:108, Math.max(0,(r.top-8)/.92));
    // On extremely short viewports, hide decorative artwork rather than cover inputs.
    bot.style.opacity=size<44?'0':'1';
    bot.style.width=size+'px';
    const x=Math.max(4,Math.min(vw-size-4,r.left+r.width/2-size/2));
    const y=Math.max(4,Math.min(vh-size-4,r.top-size*.92));
    bot.style.left=x+'px'; bot.style.top=y+'px';
    bubble.style.maxWidth=Math.min(170,Math.max(60,vw-16))+'px';
    bubble.style.left='50%'; bubble.style.top='auto'; bubble.style.bottom='100%';
    const bw=bubble.offsetWidth, bh=bubble.offsetHeight;
    if(y<bh+12) { bubble.style.bottom='auto'; bubble.style.top='15%'; bubble.style.left=x+size+bw+12<vw ? (size+bw/2+8)+'px' : (-bw/2-8)+'px'; }
    const br=bubble.getBoundingClientRect();
    if(br.left<8 || br.right>vw-8) bubble.style.left=(parseFloat(getComputedStyle(bubble).left)+Math.max(0,8-br.left)-Math.max(0,br.right-vw+8))+'px';
  }
  function queuePlace(){if(!frame && !bot.hidden) frame=requestAnimationFrame(place);}
  function transition(next){
    if(next===state) {queuePlace();return;}
    cancel(); stopEyes(); state=next; bot.dataset.state=next; bot.hidden=next==='hidden';
    stage.style.setProperty('--mascot-lean','0deg'); say('');
    if(next==='hidden') {if(frame) cancelAnimationFrame(frame);frame=0;return;}
    const poses={idle:'normal',typing:'normal',privacy:'shy',verifying:'normal',error:'concerned',hello:'wave',success:'happy'};
    setPose(poses[next]||'normal');
    if(next==='hello'){helloAttempted=true;say('Hi!');later(()=>{greeted=true;sync();},1800);}
    if(next==='verifying') say('One moment…');
    if(next==='success'){say(patient?'Welcome!':'Welcome back!');if(!patient)later(()=>transition('hidden'),3000);}
    queuePlace();startEyes();
    
  }
  function sync(){
    if(document.hidden){transition('hidden');return;}
    const open=shown(gate);
    if(!open){
      if(!patient && wasOpen && lastRect && window.__authUser){wasOpen=false;transition('success');return;}
      wasOpen=false;greeted=false;if(state!=='success'||patient)transition('hidden');return;
    }
    if(!wasOpen){greeted=false;helloAttempted=false;interacted=false;wasOpen=true;}
    const active=document.activeElement;
    const screen=patient?gate.querySelector('[data-pa]:not([hidden])')?.dataset.pa:'';
    const busy=patient?(screen==='verifying'||(screen==='phone'&&$('paSend')?.disabled)):(shown($('authChecking'))||(shown($('loginSubmit'))&&$('loginSubmit')?.disabled)||(shown($('mfaVerifyBtn'))&&$('mfaVerifyBtn')?.disabled));
    const errors=(patient?['paPhoneErr','paPassErr','paOtpErr','paNameErr','paSetPassErr']:['authAlert','mfaAlert']).some(id=>{const e=$(id);return shown(e)&&e.textContent.trim()&&!e.classList.contains('info')&&!e.classList.contains('ok');});
    const privacy=(patient&&screen==='pass')||(gate.contains(active)&&active.matches('input[type=password],input[autocomplete=one-time-code],input[autocomplete=current-password],input[autocomplete=new-password]'));
    const typing=gate.contains(active)&&active.matches('input,textarea,select');
    if((busy&&interacted)||errors||privacy||(typing&&interacted)||screen==='done'||(patient&&screen!=='phone'))greeted=true;
    transition(busy?'verifying':errors?'error':privacy?'privacy':screen==='done'?'success':!greeted&&(!helloAttempted||state==='hello')&&!motion.matches?'hello':typing&&interacted?'typing':'idle');
  }
  function schedule(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;sync();});}
  const observer=new MutationObserver(records=>{if(records.some(r=>!bot.contains(r.target)))schedule();});
  observer.observe(gate,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','disabled','type']});
  cleanups.push(()=>observer.disconnect());
  const ro=new ResizeObserver(queuePlace);ro.observe(card);cleanups.push(()=>ro.disconnect());
  ['resize','scroll'].forEach(e=>listen(window,e,queuePlace,{passive:true}));
  listen(window,'load',queuePlace);listen(card,'animationend',queuePlace);listen(card,'transitionend',queuePlace);
  if(window.visualViewport){listen(visualViewport,'resize',queuePlace);listen(visualViewport,'scroll',queuePlace);}
  ['focusin','focusout'].forEach(e=>listen(gate,e,schedule));listen(gate,'input',()=>{interacted=true;schedule();});listen(gate,'pointerdown',()=>{interacted=true;greeted=true;schedule();},{passive:true});
  listen(document,'visibilitychange',sync);listen(motion,'change',()=>{greeted=true;if(motion.matches)stopEyes();sync();startEyes();});
  listen(window,'pointermove',e=>{if(motion.matches||!['idle','typing'].includes(state))return;const r=bot.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/100));ty=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height*.48)/100));lastMove=performance.now();},{passive:true});
  listen(window,'pagehide',()=>{cancel();transition('hidden');});listen(window,'pageshow',sync);
  // Available for SPA teardown if needed.
  bot.destroyMascot=()=>{cancel();transition('hidden');cleanups.forEach(fn=>fn());};
  sync();
})();
