const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../og-tip.html'),'utf8');
const source=html.match(/<script id="physics">([\s\S]*?)<\/script>/)[1];
const E=vm.runInNewContext(source+'\nOGEngine;',{Intl,Date});
const dt=1/120;
function run(seed,{jump=1.6,charge=.42,tip=true,move=true}={}){
 const s=E.create(seed);let begun=false,released=false,window=0;
 while(!['miss','won'].includes(s.phase)&&s.t<6){
  if(!begun&&s.t>=jump-charge){E.begin(s);begun=true;}
  if(!released&&s.t>=jump){E.release(s);released=true;}
  if(E.canTip(s)){window+=dt;if(tip)E.tip(s);}
  const dx=s.target.x-s.og.x,dy=s.target.y-s.og.y;
  E.step(s,dt,move?{x:Math.max(-1,Math.min(1,dx/1.5)),y:Math.max(-1,Math.min(1,dy/1.5))}:{});
 }
 return {s,window};
}
test('same date and seed produce identical rebounds, tomorrow changes them',()=>{
 assert.equal(E.day(new Date('2026-10-17T03:59:59Z')),'2026-10-16');
 assert.equal(E.day(new Date('2026-10-17T04:00:00Z')),'2026-10-17');
 assert.deepEqual(E.rebound(113),E.rebound(113));assert.notDeepEqual(E.rebound(113),E.rebound(114));
});
test('unplayed rebounds never make themselves across 365 seeds',()=>{
 for(let seed=0;seed<365;seed++){const {s}=run(seed,{tip:false,move:false});assert.equal(s.phase,'miss');assert.equal(s.score,105);}
});
test('every simulation rebound in a 365-seed sweep can be reached through ordinary movement and jump input',()=>{
 let min=1;
 for(let seed=0;seed<365;seed++){
  let success;
  for(const jump of [1.6,1.5,1.7,1.4,1.8]){const r=run(seed,{jump});if(r.s.phase==='won'){success=r;break;}}
  assert.ok(success,`Unreachable rebound ${seed}`);assert.equal(success.s.score,107);assert.ok(success.s.contact.time<4.4);
 }
});
test('position and height both matter; tapping from the starting spot cannot score',()=>{
 const s=E.create(123);s.phase='rebound';s.og.z=3;s.ball.z=12;assert.equal(E.tip(s),false);assert.equal(s.score,105);assert.match(s.reason,/closer/);
 const t=E.create(123);t.phase='rebound';t.og.x=t.ball.x;t.og.y=t.ball.y;t.og.z=.2;t.ball.z=14;assert.equal(E.tip(t),false);assert.equal(t.score,105);
});
test('a valid contact scores once, and repeated input cannot add baskets',()=>{
 const {s}=run(42);assert.equal(s.phase,'won');for(let i=0;i<100;i++){E.begin(s);E.release(s);E.tip(s);E.step(s,dt,{});}assert.equal(s.score,107);
});
test('a tip released before the horn can finish after zero; a late tip is rejected',()=>{
 const s=E.create(42);s.phase='rebound';s.t=4.35;s.clock=.05;s.og.x=0;s.og.y=5.25;s.og.z=3;s.ball={x:0,y:5.25,z:12,vx:0,vy:0,vz:0};assert.equal(E.tip(s),true);for(let i=0;i<70;i++)E.step(s,dt,{});assert.equal(s.phase,'won');assert.equal(s.clock,0);
 const t=E.create(42);Object.assign(t,{phase:'rebound',clock:0});t.og.x=t.ball.x;t.og.y=t.ball.y;t.og.z=1;assert.equal(E.tip(t),false);
});
test('cancelled charge does not jump; diagonal movement is normalized',()=>{
 const s=E.create(42);E.begin(s);s.og.charge=null;E.release(s);assert.equal(s.og.vz,0);
 for(let i=0;i<120;i++)E.step(s,dt,{x:1,y:1});assert.ok(Math.hypot(s.og.vx,s.og.vy)<=E.C.speed+.001);
});
test('all ten players are represented and the nine other players move',()=>{
 const before=E.npc(0),after=E.npc(2);assert.equal(before.length,9);assert.equal(before.filter(p=>p.home).length,4);assert.equal(new Set(before.map(p=>p.name)).size,9);for(let i=0;i<9;i++)assert.notDeepEqual([before[i].x,before[i].y],[after[i].x,after[i].y]);
});

// Run the actual page controller with a minimal DOM and a deterministic clock.
// Hooks are injected in this test only; the shipped page has no automation API.
function page({storage=new Map(),clipboard=null,reducedMotion=true,width=1100,height=620,YT=null,fullPlay=false,AudioContext=null}={}){
 const elements=new Map(),listeners=new Map(),noop=()=>{};let now=1000,raf;const timers=new Map();let timerID=0;
 const context2d=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>({addColorStop:noop}):noop,set:()=>true});
 function el(id){if(elements.has(id))return elements.get(id);const classes=new Set();const node={id,tagName:id==='court'?'CANVAS':'BUTTON',textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},dataset:{},attrs:{},value:'',
 classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,b)=>b?classes.add(c):classes.delete(c)},
 setAttribute:(k,v)=>node.attrs[k]=v,addEventListener:(type,fn)=>{const key=id+':'+type;listeners.set(key,[...(listeners.get(key)||[]),fn]);},
 getContext:()=>context2d,getBoundingClientRect:()=>({left:0,top:0,width:id==='.dpad'?108:width,height:id==='.dpad'?93:height}),
 focus:noop,scrollIntoView:noop,select:noop,setPointerCapture:noop,append:noop,appendChild:noop,replaceChildren:noop,remove:noop,contains:other=>other?.id!=='outside',querySelectorAll:()=>['up','down','left','right'].map(d=>el('dir-'+d))};elements.set(id,node);return node;}
 for(const d of ['up','down','left','right'])el('dir-'+d).dataset.dir=d;
 const document={hidden:false,head:el('head'),getElementById:el,querySelector:el,querySelectorAll:selector=>selector==='.held'?[...elements.values()].filter(e=>e.classList.contains('held')):[],createElement:()=>el('created-'+elements.size),addEventListener:(t,f)=>el('document').addEventListener(t,f)};
 const window={YT,AudioContext,addEventListener:(t,f)=>el('window').addEventListener(t,f)};
 const context={document,window,matchMedia:()=>({matches:reducedMotion,addEventListener:noop}),devicePixelRatio:1,Image:class{complete=false;},URL,URLSearchParams,location:{search:'',href:'http://localhost:8742/og-tip.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{clipboard},requestAnimationFrame:f=>{raf=f;},Intl,Date,console,setTimeout:(fn,ms)=>{const id=++timerID;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 let controller=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
 controller=controller.replace('if(!document.hidden)draw();','/* Canvas rendering is verified in browser; simulation tests skip per-frame raster work. */');
 controller=controller.replace(/\}\)\(\);\s*$/,`globalThis.api={get run(){return run},get career(){return career},get impactAge(){return impactAge},get freeze(){return contactFreeze},get state(){return s},get mode(){return mode},get record(){return record},get seed(){return seed},get best(){return best},get camera(){return camera},get history(){return history},get practiceSpeed(){return practiceSpeed},get setupTime(){return setupTime},get callSource(){return callSource},celebrityPose,fanPose,movement,shareText,tick,point,drawCard};})();`);
 vm.runInNewContext(source+'\n'+controller,context);
 function emit(id,type,extra={}){return Promise.all((listeners.get(id+':'+type)||[]).map(fn=>fn({target:el(id),preventDefault:noop,button:0,pointerId:1,clientX:0,clientY:0,stopPropagation:noop,...extra})));}
 function advance(sec){const stop=now+sec*1000;while(now<stop-.001){now=Math.min(stop,now+1000/120);raf(now);for(const [id,t]of timers)if(t.at<=now){timers.delete(id);t.fn();}}}
 function key(type,code){emit('window',type,{target:el('court'),code});}
 function playWinner(observe=()=>{}){emit('start','click');let begun=false,released=false;while(!['result','celebrating'].includes(context.api.mode)&&context.api.state.t<4){const s=context.api.state;for(const [code,on]of [['KeyD',s.target.x-s.og.x>.3],['KeyA',s.target.x-s.og.x<-.3],['KeyW',s.target.y-s.og.y<-.3],['KeyS',s.target.y-s.og.y>.3]])key(on?'keydown':'keyup',code);if(!begun&&s.t>1.18){key('keydown','Space');begun=true;}if(!released&&s.t>1.6){key('keyup','Space');released=true;}advance(1/120);observe();}}
 if(!fullPlay)emit('full-play','click');
 return {api:context.api,el,emit,key,advance,playWinner,document,storage};
}
test('page start, pause, resume and background handling preserve the clock',()=>{
 const p=page();p.emit('start','click');p.advance(.8);p.emit('pause','click');const t=p.api.state.t;p.advance(30);assert.equal(p.api.state.t,t);assert.equal(p.api.mode,'paused');p.emit('start','click');p.advance(.3);assert.ok(p.api.state.t>t);p.document.hidden=true;p.emit('document','visibilitychange');assert.equal(p.api.mode,'paused');
});
test('page pointer cancellation drops the charge and the drag pad supports diagonal movement',()=>{
 const p=page();p.emit('start','click');p.emit('action','pointerdown');p.advance(.3);assert.ok(p.api.state.og.charge>0);p.emit('action','pointercancel');p.emit('action','pointerup');assert.equal(p.api.state.og.vz,0);p.emit('.dpad','pointerdown',{clientX:90,clientY:5});assert.ok(p.api.movement().x>0&&p.api.movement().y<0);p.emit('.dpad','pointercancel');assert.equal(p.api.movement().x,0);
});
test('a winner returns quickly to results, with replay and film only on request',()=>{
 const p=page();p.playWinner();assert.equal(p.api.mode,'celebrating');assert.equal(p.api.state.score,107);p.advance(1.2);assert.equal(p.api.mode,'result');p.emit('real-film','click');assert.equal(p.api.mode,'film');p.emit('film-skip','click');assert.equal(p.api.mode,'result');assert.equal(p.api.record.results.length,1);assert.equal(p.api.record.results[0].made,true);assert.match(p.api.shareText(),/NYK 107–106/);p.emit('replay','click');assert.equal(p.api.mode,'replay');p.advance(10);assert.equal(p.api.mode,'result');assert.equal(p.api.record.attempts,1);assert.equal(p.api.record.results.length,1);const reloaded=page({storage:p.storage});assert.equal(reloaded.api.record.results[0].made,true);
});
test('daily retry keeps the seed, abandoned attempts count, practice cannot alter daily records',()=>{
 const p=page();p.emit('start','click');const seed=p.api.seed;p.advance(.5);p.emit('retry','click');assert.equal(p.api.seed,seed);assert.equal(p.api.record.attempts,2);assert.equal(p.api.record.results.length,2);p.emit('practice','click');p.emit('start','click');p.advance(4);assert.equal(p.api.record.attempts,2);p.emit('daily','click');assert.equal(p.api.seed,seed);
});
test('failed clipboard access offers a selectable result instead of losing the share',async()=>{
 const p=page({clipboard:{writeText:()=>Promise.reject(new Error('denied'))}});p.emit('start','click');p.advance(4);p.emit('share','click');await new Promise(resolve=>setImmediate(resolve));assert.equal(p.el('share-output').hidden,false);assert.match(p.el('share-output').value,/ONE TOUCH/);
});

test('practice runs at half speed without slowing or altering the daily challenge',()=>{
 const p=page();p.emit('practice','click');const seed=p.api.seed;p.emit('start','click');p.advance(1);assert.ok(p.api.state.t>.45&&p.api.state.t<.55);p.el('practice-speed').value='1';p.emit('practice-speed','change');assert.equal(p.api.practiceSpeed,.5);p.emit('daily','click');p.emit('start','click');p.advance(1);assert.ok(p.api.state.t>.9);assert.equal(p.api.seed,seed);
});
test('a best-attempt ghost persists per seed and a weaker attempt cannot replace it',()=>{
 const p=page();p.playWinner();const quality=p.api.best.quality;assert.ok(quality>=1000);assert.ok(p.api.best.frames.length>20);p.emit('retry','click');p.advance(4);assert.equal(p.api.best.quality,quality);const reloaded=page({storage:p.storage});assert.equal(reloaded.api.best.quality,quality);p.emit('practice','click');assert.equal(p.api.best.quality,quality);assert.equal(p.api.seed,20260610);
});
test('grading separates positioning from vertical timing and diagnoses early and late jumps',()=>{
 const s=E.create(42);s.phase='rebound';s.og.x=s.ball.x;s.og.y=s.ball.y;s.og.z=2;s.og.vz=-2;s.ball.z=14;assert.match(E.diagnose(s),/Early jump/);s.og.vz=2;s.ball.z=9;assert.match(E.diagnose(s),/Late jump/);s.attemptTouch={flat:0,height:3,jumped:true};const a=E.assessment(s);assert.equal(a.position,100);assert.ok(a.timing<5);s.attemptTouch={flat:5,height:0,jumped:true};const b=E.assessment(s);assert.equal(b.position,0);assert.equal(b.timing,100);
});
test('Vassell holds a lane, collisions cost momentum, and Harper follows the rebound',()=>{
 const s=E.create(77);E.step(s,dt,{});const v=s.players.find(n=>n.name==='vassell');s.og.x=v.x-1;s.og.y=v.y;s.og.vx=20;E.step(s,dt,{x:1});assert.equal(s.blockedBy,'vassell');assert.ok(s.og.vx<20);assert.ok(s.blockedUntil>s.t);
 const t=E.create(77);for(let i=0;i<260;i++)E.step(t,dt,{});const harper=t.players.find(n=>n.name==='harper');assert.ok(Math.hypot(harper.x-t.ball.x,harper.y-t.ball.y)<6);assert.ok(harper.x<6);
});
test('the follow camera keeps OG and the rim on screen, with a fixed reduced-motion alternative',()=>{
 for(const width of [390,1100]){const p=page({width,reducedMotion:false});p.emit('start','click');p.key('keydown','KeyD');p.key('keydown','KeyW');p.advance(1.6);const c=p.api.camera;assert.ok(c.zoom>1.1&&c.zoom<=1.21);const vw=width<700?700:1100,vh=width<700?750:620;for(const point of [p.api.point(p.api.state.og.x,p.api.state.og.y),p.api.point(0,5.25,10)]){const x=(point.x-c.x)*c.zoom+vw/2,y=(point.y-c.y)*c.zoom+vh/2;assert.ok(x>0&&x<vw&&y>0&&y<vh);}}
 const p=page();p.emit('start','click');p.advance(1.5);assert.equal(p.api.camera.zoom,1);
});
test('replay records actual defender positions, freezes scores, and has a larger camera',()=>{
 const p=page({reducedMotion:false});p.playWinner();assert.ok(p.api.history.every(f=>f.players.length===9));p.advance(1.2);p.emit('replay','click');assert.equal(p.api.mode,'replay');p.advance(.6);assert.ok(p.api.camera.zoom>1.6);assert.equal(p.api.state.score,107);assert.equal(p.api.record.results.length,1);
});
test('film loading can be skipped or restarted without stale callbacks reopening it',async()=>{
 let options;const YT={Player:class{constructor(m,o){options=o;}destroy(){}}};const p=page({YT});p.emit('preview-film','click');await Promise.resolve();assert.equal(p.api.mode,'film');assert.equal(options.videoId,'sOQKRjP3ZJk');p.emit('film-skip','click');assert.equal(p.api.mode,'intro');options.events.onStateChange({data:0});assert.equal(p.api.mode,'intro');p.emit('preview-film','click');await Promise.resolve();p.emit('retry','click');options.events.onError();assert.equal(p.api.mode,'playing');
});
test('film autoplay retries muted, exposes manual play, and failure leaves a way back',async()=>{
 let options,muted=0,plays=0;const YT={Player:class{constructor(m,o){options=o;}destroy(){}}};const p=page({YT});p.emit('preview-film','click');await Promise.resolve();const target={mute:()=>muted++,playVideo:()=>plays++,getIframe:()=>({setAttribute(){}})};options.events.onReady({target});assert.equal(plays,1);options.events.onAutoplayBlocked({target});assert.equal(muted,1);options.events.onAutoplayBlocked({target});assert.equal(p.el('film-play').hidden,false);options.events.onError();assert.match(p.el('film-status').textContent,/YouTube/);assert.equal(p.api.mode,'film');p.emit('film-skip','click');assert.equal(p.api.mode,'intro');
});
test('share card contains the actual score and separate grades at export dimensions',()=>{
 const p=page();p.playWinner();const words=[],g=new Proxy({fillText:t=>words.push(String(t)),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>{o[k]=v;return true;}}),card={getContext:()=>g};p.api.drawCard(card);assert.equal(card.width,1200);assert.equal(card.height,630);assert.ok(words.includes('NYK 107 — SAS 106'));assert.ok(words.includes('POSITIONING'));assert.ok(words.includes('TIMING'));
});


test('the fixed possession is identical across modes and retries, independent of OG movement',()=>{
 const p=page();const fixed=p.api.seed;assert.equal(fixed,20260610);let initial;
 for(const id of ['daily','practice','garden']){p.emit(id,'click');p.emit('start','click');const s=p.api.state;const state=JSON.stringify({target:s.target,rb:s.rb,ball:s.ball,score:s.score,clock:s.clock,og:s.og,rules:s.rules});if(!initial)initial=state;else assert.equal(state,initial);p.advance(.3);p.emit('retry','click');assert.equal(p.api.seed,fixed);assert.equal(p.api.state.clock,4.4);}
 const a=E.create(fixed),b=E.create(fixed);for(let i=0;i<240;i++){E.step(a,dt,{x:1,y:-1});E.step(b,dt,{x:-1,y:1});assert.deepEqual(a.ball,b.ball);assert.deepEqual(a.players,b.players);}assert.notEqual(a.og.x,b.og.x);
});
test('moving and releasing a jump is sufficient; no midair button is required',()=>{
 const {s}=run(20260610,{tip:false});assert.equal(s.phase,'won');assert.equal(s.grade,'PERFECT');assert.ok(s.contact.quality>.68);
 const late=run(20260610,{tip:false,jump:2.3});assert.equal(late.s.phase,'miss');
 const p=page();p.playWinner();assert.equal(p.api.state.phase,'won');assert.equal(p.api.state.score,107);
});
test('three missed finishes end a run, retry costs a life, and a new run resets cleanly',()=>{
 const p=page();p.emit('garden','click');p.emit('start','click');p.advance(4);assert.equal(p.api.run.lives,2);assert.equal(p.api.mode,'result');p.emit('court','pointerdown');assert.equal(p.api.mode,'playing');p.advance(.4);p.emit('retry','click');assert.equal(p.api.run.lives,1);p.advance(4);assert.equal(p.api.run.lives,0);assert.equal(p.api.run.over,true);assert.match(p.el('result-title').textContent,/RUN ENDS/);assert.equal(p.api.record.attempts,0);p.emit('start','click');assert.equal(p.api.run.lives,3);assert.equal(p.api.run.made,0);assert.equal(p.api.run.attempts,1);
});
test('five successful copies of the same play clear a run and save the best streak only once',()=>{
 const p=page();p.emit('garden','click');for(let i=1;i<=5;i++){p.playWinner();assert.equal(p.api.run.made,i);assert.equal(p.api.seed,20260610);p.advance(1.2);assert.equal(p.api.mode,'result');assert.equal(p.api.run.lives,3);}
 assert.equal(p.api.run.over,true);assert.equal(p.api.career.best,5);assert.equal(p.api.career.clears,1);p.emit('replay','click');p.advance(10);assert.equal(p.api.career.clears,1);assert.match(p.api.shareText(),/5\/5/);const q=page({storage:p.storage});assert.equal(q.api.career.best,5);assert.equal(q.api.career.clears,1);assert.equal(p.api.record.attempts,0);
});
test('a miss breaks the current streak without erasing made finishes',()=>{
 const p=page();p.emit('garden','click');p.playWinner();p.advance(1.2);p.playWinner();p.advance(1.2);p.emit('start','click');p.advance(4);assert.equal(p.api.run.streak,0);assert.equal(p.api.run.made,2);assert.equal(p.api.career.best,2);assert.equal(p.api.run.lives,2);
});
test('miss feedback and retry are immediate, and optional review does not consume lives',()=>{
 const p=page();p.emit('garden','click');p.emit('start','click');while(p.api.mode==='playing')p.advance(dt);assert.equal(p.api.mode,'result');assert.match(p.el('result-body').textContent,/closer/);p.emit('replay','click');p.advance(10);assert.equal(p.api.run.lives,2);p.emit('overlay','pointerdown');assert.equal(p.api.mode,'playing');assert.equal(p.api.state.clock,4.4);assert.equal(p.api.run.lives,2);
});
test('impact feedback freezes briefly while reduced motion omits the freeze',()=>{
 for(const reducedMotion of [false,true]){const p=page({reducedMotion});let frozenFrames=0,lastT=null;p.playWinner(()=>{if(p.api.freeze>0&&lastT===p.api.state.t)frozenFrames++;lastT=p.api.state.t;});assert.equal(p.api.state.phase,'won');assert.equal(frozenFrames>0,!reducedMotion);assert.ok(p.api.impactAge<1);p.advance(1.2);assert.equal(p.api.mode,'result');assert.equal(p.api.record.results.length,1);}
});

test('extra midair presses cannot turn the automatic contact into an early miss',()=>{
 const s=E.create(20260610);s.og.z=1;s.phase='rebound';E.begin(s);assert.equal(s.og.tapped,false);assert.equal(s.reason,'');
});


test('fan movement varies by person and event, while reduced-motion poses stay still',()=>{
 const p=page({reducedMotion:false}),fan={q:.6,phase:.3,style:1};const idle=p.api.fanPose(fan,1,false),later=p.api.fanPose(fan,2,false),other=p.api.fanPose({...fan,phase:2},1,false);assert.notEqual(idle.bounce,later.bounce);assert.notEqual(idle.arm,other.arm);p.playWinner();p.advance(.4);const cheer=p.api.fanPose(fan,2,true);assert.ok(cheer.rise>idle.rise);assert.equal(cheer.up,true);const q=page({reducedMotion:true});for(const pose of [q.api.fanPose(fan,1,false),q.api.fanPose(fan,10,true)]){assert.equal(pose.bounce,0);assert.equal(pose.arm,0);assert.equal(pose.clap,0);}
});


test('inbound develops on the right, ball dribbles, and every player joins the playable state continuously',()=>{
 const start=E.setup(0),dribble=E.setup(1.3),later=E.setup(1.5),end=E.setup(E.setupDuration),play=E.create(20260610);
 assert.equal(start.players.length,9);assert.ok(start.players.find(p=>p.name==='bridges').x>25);assert.ok(dribble.players.find(p=>p.name==='brunson').x>10);assert.notEqual(dribble.ball.z,later.ball.z);
 for(const player of E.npc(0)){const n=end.players.find(p=>p.name===player.name);for(const axis of ['x','y','z'])assert.equal(n[axis],player[axis]);}
 for(const axis of ['x','y','z'])assert.equal(end.ball[axis],play.ball[axis]);assert.ok(Math.abs(end.clock-play.clock)<1e-9);assert.deepEqual(end.og,play.og);assert.deepEqual(E.setup(2.1),E.setup(2.1));
});
test('full possession pauses and resumes setup, ignores movement until handoff, then enables OG',()=>{
 const p=page({fullPlay:true});p.emit('start','click');assert.equal(p.api.mode,'setup');p.key('keydown','KeyD');p.advance(1);assert.equal(p.api.state.og.x,-22);const at=p.api.setupTime;
 p.emit('pause','click');p.advance(.5);assert.equal(p.api.setupTime,at);p.emit('start','click');p.advance(3);assert.equal(p.api.mode,'ready');assert.equal(p.api.state.t,0);p.advance(10);assert.equal(p.api.state.clock,4.4);assert.equal(p.api.state.og.x,-22);
 p.key('keydown','KeyD');p.advance(.2);assert.ok(p.api.state.og.x>-22);assert.equal(p.api.record.attempts,1);
});
test('skip setup and shot-only mode preserve the fixed finish; a full-play attempt is winnable',()=>{
 const p=page({fullPlay:true});p.emit('start','click');p.emit('action','pointerdown');assert.equal(p.api.mode,'ready');assert.equal(p.api.state.t,0);assert.equal(p.api.state.og.charge,null);
 const q=page({fullPlay:true});q.playWinner();assert.equal(q.api.state.phase,'won');assert.equal(q.api.record.attempts,1);
});
test('courtside cameos have distinct celebrations and honor reduced motion',()=>{
 const p=page({reducedMotion:false});assert.ok(p.api.celebrityPose('spike',.1,true).jump>0);assert.equal(p.api.celebrityPose('taylor',.1,true).arms,true);assert.equal(p.api.celebrityPose('jerry',.1,true).arms,false);
 const q=page();for(const name of ['spike','taylor','jerry'])assert.equal(q.api.celebrityPose(name,1,true).jump,0);
});
function audioMock(){
 const calls=[];const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){}});
 class AudioContext{state='running';currentTime=0;sampleRate=100;destination={};resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}createBuffer(){return {getChannelData:()=>new Float32Array(300)};}decodeAudioData(){return Promise.resolve({duration:5,kind:'call'});}createGain(){return {gain:param(),connect(){}};}createBiquadFilter(){return {frequency:param(),Q:param(),connect(){}};}createOscillator(){return {frequency:param(),connect(){},start(){},stop(){}};}createBufferSource(){const n={buffer:null,connect(){},start(...args){if(this.buffer?.kind==='call')calls.push({node:this,args});},stop(){this.stopped=true;}};return n;}}
 return {AudioContext,calls};
}
test('real clip fires once on the make with the chosen offset, stops on retry/mute, and stays absent on misses',async()=>{
 const m=audioMock(),p=page({AudioContext:m.AudioContext});p.el('call-file').files=[{name:'real-call.wav',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];await p.emit('call-file','change');p.el('call-offset').value='1.2';assert.equal(m.calls.length,0);
 p.playWinner();assert.equal(m.calls.length,1);assert.deepEqual(m.calls[0].args,[0,1.2,3.8]);p.advance(1.2);assert.equal(m.calls.length,1);p.emit('retry','click');assert.equal(m.calls[0].node.stopped,true);p.advance(4);assert.equal(m.calls.length,1);
 await p.emit('call-preview','click');assert.equal(m.calls.length,2);p.emit('sound','click');assert.equal(m.calls[1].node.stopped,true);await p.emit('call-preview','click');assert.equal(m.calls.length,2);p.emit('call-clear','click');assert.equal(p.el('call-preview').disabled,true);
});
test('clearing a pending decode cannot resurrect a removed clip',async()=>{
 const m=audioMock();let complete;class Delayed extends m.AudioContext{decodeAudioData(){return new Promise(r=>complete=r);}}
 const p=page({AudioContext:Delayed});p.el('call-file').files=[{name:'call.wav',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];const loading=p.emit('call-file','change');await new Promise(setImmediate);p.emit('call-clear','click');complete({duration:5,kind:'call'});await loading;p.playWinner();assert.equal(m.calls.length,0);assert.equal(p.el('call-preview').disabled,true);
});


test('held keys survive the inbound handoff and movement works when another button has focus',()=>{
 const p=page({fullPlay:true});p.emit('start','click');p.emit('window','keydown',{target:p.el('sound'),code:'ArrowRight'});p.advance(3.9);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>-22);p.key('keyup','ArrowRight');assert.equal(p.api.movement().x,0);
});
test('click-to-move starts a waiting possession and respects the camera projection on desktop and phone',()=>{
 for(const [width,height] of [[1100,620],[390,418]]){const p=page({width,height,fullPlay:true,reducedMotion:false});p.emit('start','click');p.advance(4);assert.equal(p.api.mode,'ready');const originalX=p.api.state.og.x;
 const target=p.api.point(-8,18),c=p.api.camera,vw=width<700?700:1100,vh=width<700?750:620;
 p.emit('court','pointerdown',{clientX:((target.x-c.x)*c.zoom+vw/2)/vw*width,clientY:((target.y-c.y)*c.zoom+vh/2)/vh*height});p.emit('court','pointerup');p.advance(.4);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>originalX);assert.ok(p.api.state.og.y<28);
 // A subsequent keyboard command overrides the tap target, rather than fighting it.
 p.key('keydown','KeyA');assert.equal(p.api.movement().x,-1);p.key('keyup','KeyA');p.advance(.2);assert.equal(p.api.movement().x,0);
 }
});
test('direction pad starts an idle game immediately and cancellation stops movement',()=>{
 const p=page({fullPlay:true});p.emit('.dpad','pointerdown',{clientX:90,clientY:45});assert.equal(p.api.mode,'playing');p.advance(.3);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>-22);p.emit('.dpad','pointercancel');assert.equal(p.api.movement().x,0);
});
test('typing in audio fields never moves OG, and blur clears queued movement',()=>{
 const p=page({fullPlay:true});p.emit('start','click');p.advance(4);p.el('call-offset').tagName='INPUT';p.emit('window','keydown',{target:p.el('call-offset'),code:'ArrowRight'});p.advance(.2);assert.equal(p.api.mode,'ready');p.key('keydown','KeyD');p.emit('window','blur');assert.equal(p.api.mode,'paused');p.emit('start','click');p.advance(.2);assert.equal(p.api.mode,'playing');assert.equal(p.api.movement().x,0);assert.equal(p.api.state.og.x,-22);
});



test('right-thumb jump is independent of left-thumb steering, including pointer cancellation',()=>{
 const p=page({fullPlay:true});p.emit('start','click');p.advance(4);assert.equal(p.api.mode,'ready');
 p.emit('.dpad','pointerdown',{target:p.el('dir-right'),pointerId:31,pointerType:'touch'});p.emit('action','pointerdown',{pointerId:32,pointerType:'touch'});p.advance(.42);assert.ok(p.api.state.og.x>-20);assert.ok(p.api.state.og.charge>=.4);
 p.emit('action','pointerup',{pointerId:32,pointerType:'touch'});assert.ok(p.api.state.og.vz>0);assert.equal(p.api.movement().x,1);p.emit('.dpad','pointercancel',{pointerId:31});assert.equal(p.api.movement().x,0);
 const q=page();q.emit('start','click');q.emit('.dpad','pointerdown',{target:q.el('dir-right'),pointerId:1});q.emit('action','pointerdown',{pointerId:2});q.advance(.3);q.emit('action','pointercancel',{pointerId:2});assert.equal(q.api.state.og.vz,0);assert.equal(q.api.state.og.charge,null);assert.equal(q.api.movement().x,1);
});
test('a tap shorter than one animation frame visibly moves OG in every pad direction',()=>{
 for(const [dir,axis,sign] of [['right','x',1],['left','x',-1],['up','y',-1],['down','y',1]]){const p=page({fullPlay:true});p.emit('start','click');p.advance(4);const before=p.api.state.og[axis];p.emit('.dpad','pointerdown',{target:p.el('dir-'+dir)});p.emit('.dpad','pointerup');p.emit('.dpad','lostpointercapture');p.advance(.3);assert.ok((p.api.state.og[axis]-before)*sign>.5,dir);assert.equal(p.api.movement()[axis],0);}
});
test('keyboard arrows work from the initial page, even when the canvas was never focused',()=>{
 const p=page({fullPlay:true});p.emit('window','keydown',{target:p.el('daily'),code:'ArrowRight'});p.emit('window','keyup',{code:'ArrowRight'});p.advance(.3);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>-21);assert.equal(p.api.record.attempts,1);
});
test('pressing a direction resumes a paused game and moves OG',()=>{
 for(const input of ['pad','keyboard']){const p=page({fullPlay:true});p.emit('start','click');p.advance(4);p.emit('pause','click');assert.equal(p.api.mode,'paused');if(input==='pad'){p.emit('.dpad','pointerdown',{target:p.el('dir-right')});p.emit('.dpad','pointerup');}else{p.key('keydown','ArrowRight');p.key('keyup','ArrowRight');}p.advance(.3);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>-21);assert.equal(p.el('overlay').hidden,true);}
});
test('accessible direction-button activation moves OG without pointer events',()=>{
 const p=page({fullPlay:true});p.emit('dir-right','click',{detail:0});p.advance(.3);assert.equal(p.api.mode,'playing');assert.ok(p.api.state.og.x>-21);
});
test('a long hold stops on release without an extra tap burst',()=>{
 const p=page();p.emit('start','click');p.emit('.dpad','pointerdown',{target:p.el('dir-right')});p.advance(.5);p.emit('.dpad','pointerup');assert.equal(p.api.movement().x,0);
});
