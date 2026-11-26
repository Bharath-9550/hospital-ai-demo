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
  // A local, pre-rendered warp replaces the original eye pixels, not overlays them.
  const atlas=new Image(); atlas.src='bot-eye-motion.webp';
  Promise.all([atlas.decode(),original.decode()]).then(()=>{
    eyeOriginal=original; eyeAtlas=atlas;
    eyeCanvas=document.createElement('canvas'); eyeCanvas.width=480; eyeCanvas.height=480;
    eyeCanvas.className='mascot-pose'; eyeCanvas.setAttribute('aria-hidden','true');
    stage.append(eyeCanvas); drawEyes(12); setPose(pose); startEyes();
  }).catch(()=>{});
  function drawEyes(tile){
    if(!eyeCanvas||tile===lastTile)return; lastTile=tile;
    const c=eyeCanvas.getContext('2d'); c.clearRect(0,0,480,480);c.drawImage(original,0,0,480,480);
    c.clearRect(140,190,200,80); c.drawImage(eyeAtlas,(tile%5)*200,Math.floor(tile/5)*80,200,80,140,190,200,80);
  }
  function stopEyes(){if(gazeRAF)cancelAnimationFrame(gazeRAF);gazeRAF=0;blinkStart=0;gx=gy=tx=ty=0;drawEyes(12);}
  function startEyes(){if(gazeRAF||!eyeCanvas||motion.matches||document.hidden||!['idle','typing'].includes(state))return;nextBlink=performance.now()+1800+Math.random()*1800;lastMove=performance.now();gazeRAF=requestAnimationFrame(eyeLoop);}
  function eyeLoop(t){
    gazeRAF=0;if(motion.matches||document.hidden||!['idle','typing'].includes(state)){stopEyes();return;}
    if(t-lastMove>3500){tx=(Math.random()-.5)*1.5;ty=(Math.random()-.5);lastMove=t;}
    gx+=(tx-gx)*.14;gy+=(ty-gy)*.14;
    let tile=(Math.round(Math.max(-1,Math.min(1,gy))*2)+2)*5+Math.round(Math.max(-1,Math.min(1,gx))*2)+2;
    if(t>=nextBlink&&!blinkStart)blinkStart=t;
    if(blinkStart){const d=t-blinkStart;if(d<45)tile=25;else if(d<90)tile=26;else if(d<150)tile=27;else if(d<195)tile=26;else if(d<240)tile=25;else{blinkStart=0;nextBlink=t+2700+Math.random()*2300;}}
    drawEyes(tile);gazeRAF=requestAnimationFrame(eyeLoop);
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
    if(next==='idle'&&!motion.matches)later(()=>{if(state==='idle'&&!interacted){greeted=false;helloAttempted=false;sync();}},18000);
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
    const busy=patient?(screen==='verifying'||(screen==='phone'&&$('paSend')?.disabled)):(shown($('authChecking'))||$('loginSubmit')?.disabled||$('mfaVerifyBtn')?.disabled);
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
  listen(window,'pointermove',e=>{if(motion.matches||!['idle','typing'].includes(state))return;const r=bot.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/100));ty=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height*.48)/100));lastMove=performance.now();stage.style.setProperty('--mascot-lean',Math.max(-3,Math.min(3,(e.clientX-r.left-r.width/2)/90))+'deg');},{passive:true});
  listen(window,'pagehide',()=>{cancel();transition('hidden');});listen(window,'pageshow',sync);
  // Available for SPA teardown if needed.
  bot.destroyMascot=()=>{cancel();transition('hidden');cleanups.forEach(fn=>fn());};
  sync();
})();
