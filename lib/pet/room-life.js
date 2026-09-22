/* Dependency-free room lifecycle. Tile positions are centers; height is SVG pixels.
   One controller owns one pet. Host apps retain purchases, saves, rig and rendering. */
(function(root){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t,key=(x,y)=>`${x},${y}`;
function seeded(seed=19){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function rotation(item){const r=item.rotation??0;if(![0,90,180,270].includes(r))throw Error('rotation must be degrees: 0/90/180/270');return r;}
function dimensions(item,catalog){const f=catalog[item.assetId]?.footprint;if(!f)throw Error('Unknown furniture '+item.assetId);return rotation(item)%180?f.slice().reverse():f.slice();}
function localToWorld(item,catalog,x,y){const [w,d]=catalog[item.assetId].footprint;switch(rotation(item)){case 90:return{x:item.x+d-y,y:item.y+x};case 180:return{x:item.x+w-x,y:item.y+d-y};case 270:return{x:item.x+y,y:item.y+w-x};default:return{x:item.x+x,y:item.y+y};}}
function blockedCells(items,catalog){const out=new Set();for(const it of items){const a=catalog[it.assetId];if(it.wallId||a.blocksMovement===false||a.layer==='floor')continue;const[w,d]=dimensions(it,catalog);for(let x=it.x;x<it.x+w;x++)for(let y=it.y;y<it.y+d;y++)out.add(key(x,y));}return out;}
function validWorld(size,items,catalog){
 if(!Number.isInteger(size)||size<4||size>64)throw Error('room size must be an integer from 4 to 64');
 const ids=new Set(),occupied=new Set();
 for(const it of items){if(!it.uid||ids.has(it.uid))throw Error('furniture uid must be unique');ids.add(it.uid);if(!catalog[it.assetId])throw Error('Unknown furniture '+it.assetId);rotation(it);
  if(it.wallId){if(!['left','right'].includes(it.wallId)||!Number.isFinite(it.u)||it.u<0||it.u>1)throw Error('Invalid wall placement');continue;}
  const[w,d]=dimensions(it,catalog);if(!Number.isInteger(it.x)||!Number.isInteger(it.y)||it.x<0||it.y<0||it.x+w>size||it.y+d>size)throw Error('Furniture outside room');
  const a=catalog[it.assetId];if(a.blocksMovement===false||a.layer==='floor')continue;
  for(let x=it.x;x<it.x+w;x++)for(let y=it.y;y<it.y+d;y++){const k=key(x,y);if(occupied.has(k))throw Error('Blocking furniture overlap');occupied.add(k);}
 }
}
function findPath(start,goals,size,blocked){
 const sx=Math.floor(start.x),sy=Math.floor(start.y),inside=(x,y)=>x>=0&&y>=0&&x<size&&y<size;
 if(!inside(sx,sy)||blocked.has(key(sx,sy)))return null;
 const targets=new Map(goals.filter(p=>inside(Math.floor(p.x),Math.floor(p.y))&&!blocked.has(key(Math.floor(p.x),Math.floor(p.y)))).map(p=>[key(Math.floor(p.x),Math.floor(p.y)),p]));
 const queue=[[sx,sy]],prev=new Map([[key(sx,sy),null]]);let found=null;
 for(let i=0;i<queue.length;i++){const[x,y]=queue[i],k=key(x,y);if(targets.has(k)){found=k;break;}for(const[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]]){const nx=x+dx,ny=y+dy,nk=key(nx,ny);if(inside(nx,ny)&&!blocked.has(nk)&&!prev.has(nk)){prev.set(nk,k);queue.push([nx,ny]);}}}
 if(found===null)return null;
 const end=targets.get(found),points=[];let p=found;while(p!==null){const[x,y]=p.split(',').map(Number);points.push({x:x+.5,y:y+.5});p=prev.get(p);}points.reverse();
 // First center keeps a replan from cutting diagonally through a blocked corner.
 if(Math.hypot(start.x-points[0].x,start.y-points[0].y)<.001)points.shift();
 return{points,end:{...end,x:Math.floor(end.x)+.5,y:Math.floor(end.y)+.5}};
}
function approaches(it,a,profile,size,catalog){
 if(it.wallId){const along=clamp(Math.floor(it.u*size),0,size-1)+.5;return[it.wallId==='left'?{x:.5,y:along}:{x:along,y:.5}];}
 const[w,d]=a.footprint,out=[],sides=profile.entry&&profile.entry!=='any'?[profile.entry]:['front','right','left','back'];
 for(const side of sides){const count=['front','back'].includes(side)?w:d;const indices=Number.isInteger(profile.entryIndex)?[clamp(profile.entryIndex,0,count-1)]:Array.from({length:count},(_,i)=>i).sort((i,j)=>Math.abs(i+.5-count/2)-Math.abs(j+.5-count/2));for(const i of indices){let p;if(side==='front')p=[i+.5,d+.5];if(side==='back')p=[i+.5,-.5];if(side==='left')p=[-.5,i+.5];if(side==='right')p=[w+.5,i+.5];out.push(localToWorld(it,catalog,...p));}}
 return out;
}
const fingerprint=it=>JSON.stringify([it.uid,it.assetId,it.x,it.y,it.rotation||0,it.wallId,it.u,it.height]);
class Controller{
 constructor(options){
  this.catalog=copy(options.catalog);this.profiles=copy(options.profiles);this.size=options.size;this.items=copy(options.items);validWorld(this.size,this.items,this.catalog);
  this.random=options.random||seeded(options.seed??19);this.onEvent=options.onEvent||(()=>{});this.canUse=options.canUse||(()=>true);this.speed=options.speed||2.1;
  this.auto=options.auto!==false;this.reduced=!!options.reducedMotion;this.paused=false;this.clock=0;this.cooldowns=new Map();this.pending=null;this.active=null;this.path=[];this.phase='idle';this.phaseTime=0;this.source='auto';this.idleWait=8;this.seq=0;
  this.pet={x:options.pet?.x??this.size-.5,y:options.pet?.y??this.size-.5,z:0};this.lastSafe={...this.pet};this._recover();
 }
 _emit(type,extra={}){this.onEvent({type,time:this.clock,sequence:++this.seq,uid:this.active?.item.uid||null,source:this.source,...extra});}
 _blocked(){return blockedCells(this.items,this.catalog);}
 _profile(item){return this.profiles[item.assetId]||null;}
 _safe(p,blocked=this._blocked()){return p.x>=0&&p.y>=0&&p.x<this.size&&p.y<this.size&&!blocked.has(key(Math.floor(p.x),Math.floor(p.y)));}
 _recover(){const blocked=this._blocked();if(this._safe(this.pet,blocked)){this.pet.z=0;this.lastSafe={...this.pet};return true;}const all=[];for(let x=0;x<this.size;x++)for(let y=0;y<this.size;y++)if(!blocked.has(key(x,y)))all.push({x:x+.5,y:y+.5,z:0});all.sort((a,b)=>Math.hypot(a.x-this.pet.x,a.y-this.pet.y)-Math.hypot(b.x-this.pet.x,b.y-this.pet.y));if(all.length){this.pet=all[0];this.lastSafe={...this.pet};return true;}this.phase='blocked';return false;}
 _idle(){this.phase='idle';this.phaseTime=0;this.path=[];this.idleWait=8+this.random()*12;this._recover();this._emit(this.phase);}
 _release(reason){if(this.active){this.cooldowns.set(this.active.item.uid,this.clock+20);this._emit('release',{reason});}this.active=null;}
 setAutomatic(value){this.auto=!!value;this.idleWait=5+this.random()*5;}
 setReducedMotion(value){this.reduced=!!value;}
 setPaused(value){this.paused=!!value;}
 setWorld({size=this.size,items}){
  validWorld(size,items,this.catalog);const next=copy(items);this.size=size;this.items=next;
  if(this.active){const target=next.find(it=>it.uid===this.active.item.uid);if(!target||fingerprint(target)!==this.active.signature){this.pending=null;this._release('layout-changed');this._idle();this._emit('interrupted',{reason:'layout-changed'});return;}}
  if(this.phase==='walking')this._replan();else if(['idle','blocked'].includes(this.phase)){const wasBlocked=this.phase==='blocked';if(this._recover()&&wasBlocked)this._idle();}
 }
 _candidate(uid){
  const it=this.items.find(a=>a.uid===uid);if(!it)return{ok:false,reason:'missing'};const p=this._profile(it);if(!p)return{ok:false,reason:'decorative'};if(!this.canUse(it))return{ok:false,reason:'busy'};
  const goals=approaches(it,this.catalog[it.assetId],p,this.size,this.catalog),blocked=this._blocked();let route=findPath(this.pet,goals,this.size,blocked);
  if(route&&p.preferredEntry){const preferred=findPath(this.pet,approaches(it,this.catalog[it.assetId],{...p,entry:p.preferredEntry},this.size,this.catalog),this.size,blocked);if(preferred&&preferred.points.length<=route.points.length+3)route=preferred;}
  return route?{ok:true,item:it,profile:p,route}:{ok:false,reason:'unreachable'};
 }
 request(uid,{source='user'}={}){
  if(this.phase==='blocked')return{ok:false,reason:'no-free-tile'};
  const it=this.items.find(a=>a.uid===uid);if(!it||!this._profile(it))return{ok:false,reason:it?'decorative':'missing'};
  if(this.active&&['entering','using','exiting'].includes(this.phase)){
   this.pending=uid===this.active.item.uid?null:{uid,source};if(this.phase!=='exiting')this._exit('new-request');return{ok:true,queued:!!this.pending};
  }
  const c=this._candidate(uid);if(!c.ok){this._emit('unavailable',{uid,reason:c.reason});return c;}
  this.pending=null;this._release('new-request');this.source=source;this.active={item:copy(c.item),profile:c.profile,signature:fingerprint(c.item),approach:c.route.end};this.path=c.route.points;this.phase='walking';this.phaseTime=0;this._emit('requested');if(!this.path.length)this._arrive();return{ok:true};
 }
 /* 앱 추가: 바닥을 눌렀을 때 그 칸까지 걸어간다.
    자율행동의 산책과 같은 흐름이라 도착하면 그냥 idle 이 된다. */
 goTo(x,y){
  if(this.phase==='blocked')return{ok:false,reason:'no-free-tile'};
  const goal={x:Math.floor(x)+.5,y:Math.floor(y)+.5},blocked=this._blocked();
  if(!this._safe(goal,blocked))return{ok:false,reason:'unreachable'};
  const route=findPath(this.pet,[goal],this.size,blocked);
  if(!route)return{ok:false,reason:'unreachable'};
  this.pending=null;this._release('new-request');this.active=null;this.source='user';
  this.path=route.points;this.phase='walking';this.phaseTime=0;this.idleWait=8+this.random()*12;
  this._emit('requested');if(!this.path.length)this._idle();
  return{ok:true};
 }
 wake(){this.pending=null;if(['entering','using'].includes(this.phase)){this._exit('wake');return;}if(this.phase==='exiting')return;this._release('cancel');this._idle();}
 _replan(){if(!this.active){this.path=[];this._idle();return;}const c=this._candidate(this.active.item.uid);if(!c.ok){this._release('route-blocked');this._idle();this._emit('unavailable',{reason:c.reason});return;}this.path=c.route.points;this.active.approach=c.route.end;}
 _arrive(){
  if(!this.active){this._idle();return;}if(!this.canUse(this.active.item)){this._release('busy');this._idle();return;}
  this.pet.x=this.active.approach.x;this.pet.y=this.active.approach.y;this.lastSafe={...this.pet,z:0};const p=this.active.profile;
  if(p.mount){const a=this.catalog[this.active.item.assetId],[w,d]=a.footprint;const target=localToWorld(this.active.item,this.catalog,(p.target?.[0]??.5)*w,(p.target?.[1]??.55)*d);this.transition={from:{...this.pet},to:{...target,z:p.height||0},duration:p.enterSeconds||.95};this.phase='entering';this.phaseTime=0;this._emit('enter');}
  else this._use();
 }
 _use(){this.phase='using';this.phaseTime=0;const p=this.active.profile;this.useDuration=this.source==='user'&&p.holdOnClick?null:(this.source==='auto'?p.autoSeconds:p.useSeconds)||5;this._emit('use',{mode:p.mode});}
 _exit(reason){
  if(!this.active){this._idle();return;}
  const p=this.active.profile;
  if(!p.mount){this._finish(reason);return;}
  const approach=this.active.approach;this.transition={from:{...this.pet},to:{...approach,z:0},duration:p.exitSeconds||.8};this.phase='exiting';this.phaseTime=0;this.exitReason=reason;this._emit('exit',{reason});
 }
 _finish(reason){const queued=this.pending;this.pending=null;this._release(reason||'finished');this._idle();if(queued)this.request(queued.uid,{source:queued.source});}
 _chooseAutomatic(){
  const choices=[];for(const it of this.items){const p=this._profile(it);if(!p||this.cooldowns.get(it.uid)>this.clock||p.automatic===false)continue;const c=this._candidate(it.uid);if(c.ok)choices.push({uid:it.uid,weight:(p.weight||1)/(1+c.route.points.length*.12)});}
  // Sometimes take a short walk between furniture visits.
  if(!choices.length||this.random()<.22){const blocked=this._blocked(),goals=[];for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){const q={x:Math.floor(this.pet.x)+dx+.5,y:Math.floor(this.pet.y)+dy+.5};if(Math.abs(dx)+Math.abs(dy)>=2&&Math.abs(dx)+Math.abs(dy)<=4&&this._safe(q,blocked))goals.push(q);}if(goals.length){const goal=goals[Math.floor(this.random()*goals.length)],r=findPath(this.pet,[goal],this.size,blocked);if(r?.points.length){this.path=r.points;this.active=null;this.source='auto';this.phase='walking';this._emit('wander');return;}}}
  if(choices.length){let n=this.random()*choices.reduce((s,c)=>s+c.weight,0);let chosen=choices[choices.length-1];for(const c of choices){n-=c.weight;if(n<=0){chosen=c;break;}}this.request(chosen.uid,{source:'auto'});}else this.idleWait=8;
 }
 tick(seconds){
  if(this.paused)return this.snapshot();if(!Number.isFinite(seconds)||seconds<0)throw Error('tick requires non-negative seconds');const dt=Math.min(seconds,.2);this.clock+=dt;this.phaseTime+=dt;
  if(this.phase==='walking'){
   let travel=dt*this.speed;
   while(this.path.length&&travel>0){const next=this.path[0];if(!this._safe(next)){this._replan();break;}const dx=next.x-this.pet.x,dy=next.y-this.pet.y,len=Math.hypot(dx,dy);this.direction={x:dx,y:dy};if(len<=travel+.0001){this.pet={...next,z:0};this.lastSafe={...this.pet};this.path.shift();travel-=len;}else{this.pet.x+=dx/len*travel;this.pet.y+=dy/len*travel;travel=0;}}
   if(this.phase==='walking'&&!this.path.length)this._arrive();
  }else if(this.phase==='entering'||this.phase==='exiting'){
   const tr=this.transition,u=clamp(this.phaseTime/tr.duration,0,1),v=smooth(u),p=this.active.profile;
   this.pet={x:mix(tr.from.x,tr.to.x,v),y:mix(tr.from.y,tr.to.y,v),z:mix(tr.from.z,tr.to.z,v)+(this.reduced||p.mode==='hide'||p.entryStyle==='climb'?0:Math.sin(Math.PI*u)*11)};
   if(u>=1){if(this.phase==='entering')this._use();else this._finish(this.exitReason);}
  }else if(this.phase==='using'&&this.useDuration!==null&&this.phaseTime>=this.useDuration)this._exit('finished');
  else if(this.phase==='idle'&&this.auto){this.idleWait-=dt;if(this.idleWait<=0)this._chooseAutomatic();}
  return this.snapshot();
 }
 snapshot(){
  const p=this.active?.profile,phase=this.phase,t=this.phaseTime;let pose='idle',opacity=1,peek=false;
  if(phase==='walking')pose='walk';
  if(['entering','exiting'].includes(phase))pose=p?.mode==='hide'?'rest':p?.entryStyle==='climb'?'climb':'hop';
  if(phase==='using')pose=['rest','hide'].includes(p.mode)?'rest':p.mode==='sit'?'sit':['ball','feather','puzzle','sniff'].includes(p.mode)?'play':'look';
  if(p?.mode==='hide'){
   if(phase==='entering')opacity=1-smooth(clamp((t/this.transition.duration-.45)/.55,0,1));
   // [앱 수정] 원래는 14초 중 2초만 얼굴을 내밀었다 — 얼굴이 보였다 안 보였다
   // 깜빡여서 고장처럼 보였다. 들어간 뒤 잠깐(0.9초) 몸을 숨기고, 그다음부터는
   // 계속 얼굴을 내민 채로 둔다. 숨숨집의 재미는 빼꼼한 얼굴이다.
   if(phase==='using'){peek=t>.9;opacity=peek?1:0;if(peek)pose='peek';}
   if(phase==='exiting')opacity=smooth(clamp(t/this.transition.duration/.65,0,1));
  }
  let displayPosition={...this.pet};
  if(peek&&p.peekTarget){const it=this.active.item,[w,d]=this.catalog[it.assetId].footprint;displayPosition={...localToWorld(it,this.catalog,p.peekTarget[0]*w,p.peekTarget[1]*d),z:p.peekHeight||0};}
  return{position:{...this.pet},displayPosition,phase,phaseTime:t,clock:this.clock,pose,mode:p?.mode||null,host:this.active?copy(this.active.item):null,hostProfile:p?copy(p):null,progress:['entering','exiting'].includes(phase)?clamp(t/this.transition.duration,0,1):0,source:this.source,remaining:phase==='using'?(this.useDuration===null?null:Math.max(0,this.useDuration-t)):null,path:copy(this.path),opacity,peek,reducedMotion:this.reduced,automatic:this.auto,paused:this.paused,direction:this.direction||{x:0,y:1}};
 }
}
const api={Controller,findPath,blockedCells,dimensions,localToWorld,approaches,seeded,validWorld};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NSPetRoomLife=api;
})(typeof window==='undefined'?globalThis:window);
