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
  let state = '', epoch = 0, frame = 0, pose = 'normal', greeted = false, wasOpen = false, pending = false, lastRect = null;
  const shown = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const listen = (el, event, fn, opts) => { if (!el) return; el.addEventListener(event,fn,opts); cleanups.push(()=>el.removeEventListener(event,fn,opts)); };
  const later = (fn, ms) => { const token = epoch; const t = setTimeout(()=>{timers.delete(t); if(token===epoch) fn();},ms); timers.add(t); };
  function cancel() { epoch++; timers.forEach(clearTimeout); timers.clear(); }
  function setPose(name) {
    pose = name;
    const selected = assets[name]?.ready ? name : 'normal';
    Object.entries(assets).forEach(([key,a])=>{a.img.style.visibility=key===selected?'visible':'hidden';});
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
    cancel(); state=next; bot.dataset.state=next; bot.hidden=next==='hidden';
    stage.style.setProperty('--mascot-lean','0deg'); say('');
    if(next==='hidden') {if(frame) cancelAnimationFrame(frame);frame=0;return;}
    const poses={idle:'normal',typing:'normal',privacy:'shy',verifying:'normal',error:'concerned',hello:'wave',success:'happy'};
    setPose(poses[next]||'normal');
    if(next==='hello'){say('Hi!');later(()=>{greeted=true;sync();},1800);}
    if(next==='verifying') say('One moment…');
    if(next==='success'){say(patient?'Welcome!':'Welcome back!');if(!patient)later(()=>transition('hidden'),3000);}
    queuePlace();
  }
  function sync(){
    if(document.hidden){transition('hidden');return;}
    const open=shown(gate);
    if(!open){
      if(!patient && wasOpen && lastRect && window.__authUser){wasOpen=false;transition('success');return;}
      wasOpen=false;greeted=false;if(state!=='success'||patient)transition('hidden');return;
    }
    if(!wasOpen){greeted=false;wasOpen=true;}
    const active=document.activeElement;
    const screen=patient?gate.querySelector('[data-pa]:not([hidden])')?.dataset.pa:'';
    const busy=patient?(screen==='verifying'||(screen==='phone'&&$('paSend')?.disabled)):(shown($('authChecking'))||$('loginSubmit')?.disabled||$('mfaVerifyBtn')?.disabled);
    const errors=(patient?['paPhoneErr','paPassErr','paOtpErr','paNameErr','paSetPassErr']:['authAlert','mfaAlert']).some(id=>{const e=$(id);return shown(e)&&e.textContent.trim()&&!e.classList.contains('info')&&!e.classList.contains('ok');});
    const privacy=(patient&&screen==='pass')||(gate.contains(active)&&active.matches('input[type=password],input[autocomplete=one-time-code],input[autocomplete=current-password],input[autocomplete=new-password]'));
    const typing=gate.contains(active)&&active.matches('input,textarea,select');
    if(busy||errors||privacy||typing||screen==='done'||(patient&&screen!=='phone'))greeted=true;
    transition(busy?'verifying':errors?'error':privacy?'privacy':screen==='done'?'success':typing?'typing':!greeted&&!motion.matches?'hello':'idle');
  }
  function schedule(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;sync();});}
  const observer=new MutationObserver(records=>{if(records.some(r=>!bot.contains(r.target)))schedule();});
  observer.observe(gate,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','disabled','type']});
  cleanups.push(()=>observer.disconnect());
  const ro=new ResizeObserver(queuePlace);ro.observe(card);cleanups.push(()=>ro.disconnect());
  ['resize','scroll'].forEach(e=>listen(window,e,queuePlace,{passive:true}));
  listen(window,'load',queuePlace);listen(card,'animationend',queuePlace);listen(card,'transitionend',queuePlace);
  if(window.visualViewport){listen(visualViewport,'resize',queuePlace);listen(visualViewport,'scroll',queuePlace);}
  ['focusin','focusout','input'].forEach(e=>listen(gate,e,schedule));
  listen(document,'visibilitychange',sync);listen(motion,'change',()=>{greeted=true;sync();});
  listen(window,'pointermove',e=>{if(motion.matches||!['idle','typing'].includes(state))return;const r=bot.getBoundingClientRect();stage.style.setProperty('--mascot-lean',Math.max(-3,Math.min(3,(e.clientX-r.left-r.width/2)/90))+'deg');},{passive:true});
  listen(window,'pagehide',()=>{cancel();transition('hidden');});listen(window,'pageshow',sync);
  // Available for SPA teardown if needed.
  bot.destroyMascot=()=>{cancel();transition('hidden');cleanups.forEach(fn=>fn());};
  sync();
})();
