/* Shared 3D mascot: observes login UI only, never reads credentials. */
(()=>{const p=document.getElementById('paBot')?'pa':'db',patient=p==='pa',$=id=>document.getElementById(id),bot=$(p+'Bot'),gate=$(patient?'paLogin':'authGate');const card=gate?.querySelector(patient?'.pa-card':'.auth-card');if(!bot||!gate||!card)return;const stage=bot.querySelector('.'+p+'-bot-stage'),bubble=$(p+'BotBubble'),c=$(p+'BotCanvas'),msg=bubble;const fallback=$(p+'BotImg');const motion=matchMedia('(prefers-reduced-motion: reduce)');let state='',epoch=0,frame=0,greeted=false,wasOpen=false,pending=false,lastRect=null,helloAttempted=false,interacted=false;const cleanups=[],timers=new Set();let engine=null,loading=false,failed=false;const shown=el=>!!el&&!el.closest('[hidden]')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';const listen=(el,event,fn,opts)=>{if(!el)return;el.addEventListener(event,fn,opts);cleanups.push(()=>el.removeEventListener(event,fn,opts));};const later=(fn,ms)=>{const token=epoch;const t=setTimeout(()=>{timers.delete(t);if(token===epoch)fn()},ms);timers.add(t)};function cancel(){epoch++;timers.forEach(clearTimeout);timers.clear()}
const modesFor={idle:'idle',typing:'typing',privacy:'privacy',covered:'covered',verifying:'busy',error:'error',hello:'greet',success:'success'};
async function load(){if(loading||engine||failed||bot.hidden)return;loading=true;try{const gl=c.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)throw Error('WebGL2 unavailable');const res=await fetch(new URL('medicare-mascot.glb',document.baseURI));if(!res.ok)throw Error('Model HTTP '+res.status);const buf=await res.arrayBuffer();
const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw Error('Not a GLB v2 file');const n=dv.getUint32(12,true);const j=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,n)));const offset=20+n;const data=buf.slice(offset+8,offset+8+dv.getUint32(offset,true));const meta={views:j.bufferViews,count:j.accessors[3].count};if(j.accessors[0].count!==297485)throw Error('Please select the original Tripo mascot export.');
const vs=`#version 300 es
precision highp float;layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;uniform vec4 expr;uniform float antenna;uniform mat3 rot;uniform vec2 shift;uniform float aspect;out vec3 N;out vec3 P;out vec3 localP;out vec2 U;void main(){localP=p;vec3 v=p;
// Smooth, bounded deformation of the original textured surface.
float front=smoothstep(.17,.28,p.z);
vec2 m=(p.xy-vec2(0.,.211))/vec2(.115,.100);
float mw=1.-smoothstep(.55,1.25,length(m));
float x=clamp(p.x/.065,-1.,1.);
float openScale=expr.x;
v.y+=front*mw*((p.y-.244)*(openScale-1.)+expr.y*(x*x-.30)*.035);
v.x+=front*mw*p.x*expr.z*.12;
// Lift inner brow corners for sadness, raise brows for curiosity.
vec2 br=(p.xy-vec2(sign(p.x)*.193,.482))/vec2(.085,.057);
float bw=1.-smoothstep(.55,1.25,length(br));
v.y+=front*bw*(expr.w*.024+min(expr.y,0.)*.018*br.x*sign(p.x));
v.x+=antenna*smoothstep(.77,1.,p.y)*.016;P=rot*(v-vec3(0,.5,0));N=rot*n;U=uv;gl_Position=vec4((P.x*1.65+shift.x)/aspect,P.y*1.65+shift.y,-P.z*.6,1.);}`;
const fs=`#version 300 es
precision highp float;in vec3 N;in vec3 P;in vec3 localP;in vec2 U;uniform vec2 gaze;uniform float blink;uniform float blush;uniform sampler2D base;uniform sampler2D norm;uniform sampler2D rm;out vec4 col;void main(){vec3 n=normalize(N);vec3 q1=dFdx(P),q2=dFdy(P);vec2 s1=dFdx(U),s2=dFdy(U);vec3 t=q1*s2.y-q2*s1.y;vec3 b=-q1*s2.x+q2*s1.x;float det=s1.x*s2.y-s1.y*s2.x;if(abs(det)>1e-9&&length(t)>1e-6&&length(b)>1e-6){t=normalize(t*sign(det));b=normalize(b*sign(det));vec3 nm=texture(norm,U).xyz*2.-1.;nm.xy*=.35;n=normalize(mat3(t,b,n)*nm);}vec3 original=texture(base,U).rgb;
// Animate the eye surface in model-local coordinates, not screen coordinates.
vec3 faceColor=original;
if(localP.z>.17){
 for(int i=0;i<2;i++){
 float side=i==0?-1.:1.;
 vec2 e=(localP.xy-vec2(side*.175,.337))/vec2(.089,.080);
 float radius=length(e);
 float mask=1.-smoothstep(.92,1.10,radius);
 vec2 iris=e-gaze*vec2(.30,.23);
 float ir=length(iris/vec2(.76,.91));
 float a=atan(iris.y,iris.x);
 float fibers=.5+.5*sin(a*37.+ir*12.)*sin(a*19.-ir*17.);
 vec3 green=mix(vec3(.028,.13,.095),vec3(.27,.72,.43),smoothstep(.19,.82,ir)*(.65+.35*clamp(-iris.y+.5,0.,1.)));
 green*=.83+.17*fibers;
 green=mix(green,vec3(.016,.045,.043),1.-smoothstep(.48,.54,ir));
 green=mix(green,vec3(.025,.09,.07),smoothstep(.86,.99,ir));
 vec3 sclera=mix(vec3(.85,.80,.73),vec3(.99,.97,.91),1.-smoothstep(.25,1.,radius));
 vec3 eye=mix(sclera,green,1.-smoothstep(.97,1.02,ir));
 eye=mix(eye,vec3(.11,.075,.065),smoothstep(.87,.98,radius));
 float hi=1.-smoothstep(.12,.20,length(iris-vec2(.25,.42)));
 float hi2=1.-smoothstep(.035,.075,length(iris-vec2(-.32,.10)));
 eye=mix(eye,vec3(1.,.99,.97),max(hi,hi2*.75));
 // Upper and lower lids meet at a curved closure line. No scaled eye image.
 float line=-.08+.12*e.x*e.x;
 float edge=1.12-1.20*blink;
 float upper=smoothstep(edge-.035,edge+.025,e.y-line);
 float lower=1.-smoothstep(-1.12+.98*blink-.025,-1.12+.98*blink+.035,e.y-line);
 float lid=max(upper,lower);
 vec3 skin=vec3(.91,.78,.66)*(1.-.065*clamp(e.y,0.,1.));
 vec3 lidColor=mix(skin,vec3(.27,.15,.12), (1.-smoothstep(.015,.045,abs(e.y-line)))*smoothstep(.80,.98,blink)*.78);
 eye=mix(eye,lidColor,lid);
 // Keep the untouched source texture at rest whenever possible.
 float activation=smoothstep(.015,.18,length(gaze))+blink; 
 faceColor=mix(faceColor,eye,mask*clamp(activation,0.,1.));
 }
}
float cheek=exp(-3.2*pow((abs(localP.x)-.245)/.095,2.)-3.2*pow((localP.y-.245)/.075,2.))*smoothstep(.19,.30,localP.z);
faceColor=mix(faceColor,vec3(.97,.36,.37),cheek*blush*.46);
vec3 color=pow(faceColor,vec3(2.2));vec3 r=texture(rm,U).rgb;vec3 l=normalize(vec3(-.5,.7,1.));vec3 f=normalize(vec3(.8,.2,1.));float d=max(dot(n,l),0.);float fill=max(dot(n,f),0.);float rim=pow(1.-max(n.z,0.),3.);vec3 h=normalize(l+vec3(0,0,1));float sp=pow(max(dot(n,h),0.),mix(90.,8.,r.g))*.13;vec3 lit=color*(.70+.32*d+.13*fill)+sp+color*.06*rim;col=vec4(pow(clamp(lit,0.,1.),vec3(1./2.2)),1.);}`;
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}const pr=gl.createProgram();gl.attachShader(pr,shader(gl.VERTEX_SHADER,vs));gl.attachShader(pr,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);const vao=gl.createVertexArray();gl.bindVertexArray(vao);function bytes(i){const v=meta.views[i];return new Uint8Array(data,v.byteOffset,v.byteLength)}for(let i=0;i<3;i++){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,bytes(i),gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i===2?2:3,gl.FLOAT,false,0,0)}let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,bytes(3),gl.STATIC_DRAW);for(const [unit,i,name] of [[0,5,'base'],[1,4,'norm'],[2,6,'rm']]){let img=await createImageBitmap(new Blob([bytes(i)],{type:'image/jpeg'}),{colorSpaceConversion:'none'});let t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);gl.uniform1i(gl.getUniformLocation(pr,name),unit);img.close()}gl.enable(gl.DEPTH_TEST);const ur=gl.getUniformLocation(pr,'rot'),us=gl.getUniformLocation(pr,'shift'),ua=gl.getUniformLocation(pr,'aspect');const ug=gl.getUniformLocation(pr,'gaze'),ub=gl.getUniformLocation(pr,'blink');const ant=gl.getUniformLocation(pr,'antenna');const ue=gl.getUniformLocation(pr,'expr'),uc=gl.getUniformLocation(pr,'blush');let facial=[1,0,0,0,0];let lastActivity=performance.now(),lastDraw=0,headX=0,headY=0,secondBlink=false,modeEnd=0,showing=false,visible=true,quality=1.35,slowFrames=0;let ex=0,ey=0,bl=0,nextBlink=performance.now()+1800,blinkStart=0;let mode='idle',started=performance.now(),lastPointer=0,tx=0,ty=0,yaw=0,pitch=0,roll=0,bob=0,paused=false,reverse=false,last=0,raf=0,autoAt=performance.now()+3500,autoUntil=0,autoMode='curious';const reduce=matchMedia('(prefers-reduced-motion: reduce)');const modes={idle:'Idle',greet:'Greeting',privacy:'Look away',busy:'Thinking',error:'Concerned',success:'Celebrate',curious:'Curious',smile:'Smile',sad:'Sad',normal:'Normal',blush:'Blush',sleepy:'Sleepy',relieved:'Relieved'};const messages={idle:'',greet:'Hi there!',privacy:'Looking away',busy:'One moment…',error:'Let’s try again',success:'Welcome!',curious:'',smile:'Happy to see you!',sad:'',normal:'',blush:'Aww!',sleepy:'',relieved:'All set!',typing:'',covered:'No peeking'};function setMode(m){if(mode!==m){mode=m;started=performance.now();modeEnd=0;autoUntil=0;autoAt=started+4000;lastActivity=started;}wake();}function wake(){if(!raf&&!document.hidden&&!bot.hidden){last=lastDraw=0;raf=requestAnimationFrame(render)}}function sleep(){if(raf)cancelAnimationFrame(raf);raf=0;}
listen(window,'pointermove',e=>{if(bot.hidden)return;let r=c.getBoundingClientRect();if(!r.width||!r.height)return;tx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.6)));ty=Math.max(-1,Math.min(1,-(e.clientY-r.top-r.height/2)/(r.height*.6)));lastPointer=lastActivity=performance.now();},{passive:true});listen(gate,'input',()=>{lastActivity=performance.now()});listen(window,'resize',wake);listen(reduce,'change',wake);listen(c,'webglcontextlost',e=>{e.preventDefault();sleep();c.style.display='none';fallback.style.display='block';failed=true;});
function matrix(y,p,r){let a=Math.cos(y),b=Math.sin(y),d=Math.cos(p),e=Math.sin(p),f=Math.cos(r),g=Math.sin(r);return new Float32Array([f*a+g*e*b,g*a-f*e*b,-d*b,-g*d,f*d,e,f*b-g*e*a,g*b+f*e*a,d*a])}function render(now){raf=0;if(document.hidden||!visible||bot.hidden)return;const still=paused||reduce.matches;if(!still&&lastDraw&&now-lastDraw<28){raf=requestAnimationFrame(render);return}const raw=lastDraw?now-lastDraw:33;lastDraw=now;const dt=last?Math.min(80,now-last):33;last=now;if(!still){slowFrames=raw>55?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>20){quality=Math.max(.85,quality-.15);slowFrames=0}}let t=now/1000,elapsed=(now-started)/1000;if(modeEnd&&now>=modeEnd){modeEnd=0;mode='idle';msg.textContent=messages[mode]||'';}if(mode==='idle'&&!still&&now>=autoAt&&now-lastActivity>4000){autoMode=({curious:'greet',greet:'blush',blush:'relieved',relieved:'curious'})[autoMode]||'curious';autoUntil=now+2400;autoAt=now+6500}let active=mode==='idle'&&now<autoUntil?autoMode:mode;if(mode==='idle'&&now-lastActivity>30000)active='sleepy';let q=now-lastPointer<2500?tx:Math.sin(t*.85)*.55,w=now-lastPointer<2500?ty:Math.sin(t*.6)*.35;const hk=still?1:1-Math.exp(-dt/340);headX+=(q-headX)*hk;headY+=(w-headY)*hk;let Y=headX*.45,X=-headY*.22,R=.025*Math.sin(t*1.2),B=.022*Math.sin(t*2);if(active==='typing'){Y=.12;X=.22;}else if(active==='sleepy'){Y=.04;X=.18;B*=.35;}else if(active==='covered'||active==='privacy'){Y=.78;X=.08;R=0}else if(active==='busy'){Y=.25*Math.sin(t*1.4);X=.18;R=.07}else if(active==='error'){Y=0;X=.24;R=-.12}else if(active==='curious'){R=.15*Math.sin(t*1.7);Y=q*.36}else if(active==='greet'){R=.08*Math.sin(t*3);B+=.05*Math.abs(Math.sin(t*3))}else if(active==='success'){B+=.12*Math.abs(Math.sin(t*4));R=.1*Math.sin(t*3)}if(still){Y=['privacy','covered'].includes(active)?.78:0;X=R=B=0}const k=still?1:1-Math.exp(-dt/115);yaw+=(Y-yaw)*k;pitch+=(X-pitch)*k;roll+=(R-roll)*k;bob+=(B-bob)*k;const size=Math.min(720,Math.round(c.clientWidth*Math.min(devicePixelRatio,quality)));const ht=Math.min(720,Math.round(c.clientHeight*Math.min(devicePixelRatio,quality)));if(c.width!==size||c.height!==ht){c.width=size;c.height=ht}gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix3fv(ur,false,matrix(yaw+(reverse?Math.PI:0),pitch,roll));gl.uniform2f(us,0,bob);gl.uniform1f(ua,c.width/c.height);let targetX=q,targetY=w;if(active==='privacy'||active==='covered'){targetX=1.;targetY=.15;}if(active==='typing'){targetX=.20;targetY=-.65;}if(active==='blush'){targetX=-.65;targetY=-.32;}if(active==='sleepy'){targetX=0;targetY=-.2;}if(active==='busy'){targetX=.25*Math.sin(t);targetY=.65;}if(active==='error'){targetX=0;targetY=-.55;}if(still){targetX=active==='privacy'?1:0;targetY=0;}const ek=still?1:1-Math.exp(-dt/65);ex+=(targetX-ex)*ek;ey+=(targetY-ey)*ek;if(!still&&now>=nextBlink&&!blinkStart)blinkStart=now;let blinkValue=0;if(blinkStart&&!still){let d=now-blinkStart;blinkValue=d<115?d/115:d<210?1:d<365?1-(d-210)/155:0;if(d>=365){blinkStart=0;if(!secondBlink&&Math.random()<.19){secondBlink=true;nextBlink=now+140}else{secondBlink=false;nextBlink=now+2700+Math.random()*2200;}}}if(still){blinkStart=0;nextBlink=now+1600;}if(active==='success'&&!still)blinkValue=Math.max(blinkValue,.55*Math.abs(Math.sin(t*3)));if(active==='covered')blinkValue=1;if(active==='sleepy')blinkValue=Math.max(.65,blinkValue);if(active==='relieved')blinkValue=Math.max(.45,blinkValue);bl+=(blinkValue-bl)*(still?1:1-Math.exp(-dt/32));gl.uniform1f(ant,still?0:Math.sin(t*2)*.35+roll*.8);const expressions={idle:[.72,.10,0,0,.08],normal:[.12,0,-.12,0,0],smile:[1.12,.55,.55,.20,.20],greet:[1.05,.50,.30,.25,.18],sad:[.48,-1.,-.30,.32,.05],error:[.48,-1.,-.30,.32,.05],blush:[.52,.35,-.08,.10,.95],privacy:[.38,.15,-.10,0,.35],busy:[.18,-.15,-.25,.55,0],success:[1.22,.65,.65,.60,.35],curious:[.55,.10,-.10,.85,.10],typing:[.5,.15,0,.15,.06],covered:[.35,.20,0,0,.55],sleepy:[.20,.08,-.15,-.15,.04],relieved:[.85,.55,.20,.1,.25]};let ft=expressions[active]||expressions.idle;const fk=still?1:1-Math.exp(-dt/180);facial=facial.map((v,i)=>v+(ft[i]-v)*fk);gl.uniform4f(ue,...facial.slice(0,4));gl.uniform1f(uc,facial[4]);c.dataset.expression=facial.map(v=>v.toFixed(2)).join(',');gl.uniform2f(ug,ex,ey);gl.uniform1f(ub,bl);c.dataset.quality=quality.toFixed(2);c.dataset.gaze=ex.toFixed(3);c.dataset.blink=bl.toFixed(3);gl.drawElements(gl.TRIANGLES,meta.count,gl.UNSIGNED_INT,0);c.dataset.yaw=yaw.toFixed(3);c.dataset.active=active; if(!still)raf=requestAnimationFrame(render)}engine={setMode,wake,sleep};c.style.display='block';fallback.style.display='none';if(bot.hidden)sleep();else setMode(modesFor[state]||'idle');}catch(e){failed=true;c.style.display='none';fallback.style.display='block';console.warn('3D mascot fallback:',e);}finally{loading=false;}}
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
function transition(next){if(next===state){queuePlace();if(next!=='hidden')load();return;}cancel();state=next;bot.dataset.state=next;bot.hidden=next==='hidden';say('');if(next==='hidden'){engine?.sleep();if(frame)cancelAnimationFrame(frame);frame=0;return;}if(next==='hello'){helloAttempted=true;say('Hi!');later(()=>{greeted=true;sync()},1800)}if(next==='verifying')say('One moment…');if(next==='success'){say('Welcome!');if(!patient)later(()=>transition('hidden'),2200)}queuePlace();load();engine?.setMode(modesFor[next]||'idle');}
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
    const covered=privacy&&active?.tagName==='INPUT'&&active.type==='text'&&(screen==='pass'||/pass/i.test(active.id+' '+active.autocomplete));
    const typing=gate.contains(active)&&active.matches('input,textarea,select');
    if((busy&&interacted)||errors||privacy||(typing&&interacted)||screen==='done'||(patient&&screen!=='phone'))greeted=true;
    transition(busy?'verifying':errors?'error':covered?'covered':privacy?'privacy':screen==='done'?'success':!greeted&&(!helloAttempted||state==='hello')&&!motion.matches?'hello':typing&&interacted?'typing':'idle');
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
listen(document,'visibilitychange',sync);listen(motion,'change',()=>{greeted=true;sync();engine?.wake()});listen(window,'pagehide',()=>{cancel();transition('hidden')});listen(window,'pageshow',sync);sync();})();