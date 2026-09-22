/*
  납품 원본(생활동작 팩 integration/room-pet-motion.js) 그대로다.
  앱에서 고친 것은 import 경로 두 줄뿐 — 이 저장소는 rig-v3.js 가 아니라 rig.js 다.
  모션 수식은 한 글자도 건드리지 않는다. 다시 납품받으면 이 파일만 갈아 끼운다.
*/
/* Add beside the existing rig-v3.js and equipment.js. Does not change anchors. */
import {growth,part,around} from './rig';
import {expressionExtra,syncEquipment} from './equipment';

export function roomPoseSource(asset,stage,state){
 const current=asset.stages[stage];if(!current)throw Error('Unknown growth stage');
 // A missing rest drawing falls back to this same growth stage.
 return ['rest','peek'].includes(state.pose)?current.motionSources?.rest?.source||current.source:current.source;
}
export function animateRoomPet(svg,asset,stage,state){
 growth(svg,asset,stage);expressionExtra(svg);
 const t=state.phaseTime||0,time=state.clock||0,organic=['brain','spine'].includes(asset.breed),reduced=state.reducedMotion;
 const energy=[.6,.8,1,.9,.95][stage],pet=part(svg,'pet'),base=around(100,176,asset.stages[stage].scale);
 const limb=(id,angle=0,dy=0)=>{const el=part(svg,id);if(!el)return;const[x,y]=(el.dataset.pivot||'100,150').split(',');el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(0 ${dy.toFixed(2)}) rotate(${angle.toFixed(2)} ${x} ${y})`);};
 const head=(dy=0,angle=0)=>{for(const id of ['head','ear-l','ear-r']){const el=part(svg,id);if(el)el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(0 ${dy.toFixed(2)}) rotate(${angle.toFixed(2)} ${asset.stages[stage].headPivot.join(' ')})`);}};
 for(let i=1;i<=5;i++)part(svg,'vertebra-'+i)?.setAttribute('transform','');
 const closed=['rest'].includes(state.pose),happy=state.pose==='play';
 expressionExtra(svg,closed?'closed':happy?'happy':'open',happy?'smile':'neutral');
 if(reduced){syncEquipment(svg);return;}
 if(state.pose==='walk'||state.pose==='climb'){
  const step=Math.sin(t*10)*energy;limb('foot-l',step*10,-Math.max(0,step)*2);limb('foot-r',-step*10,-Math.max(0,-step)*2);
  limb('arm-l',-step*9);limb('arm-r',step*9);head(Math.abs(step)*.6,organic?0:step*.7);
  pet.setAttribute('transform',`${base} translate(0 ${(-Math.abs(step)*1.2).toFixed(2)})`);
 }else if(state.pose==='rest'){
  // Intact anatomy silhouette; no squashing of the five lumbar segments.
  pet.setAttribute('transform',`${base} translate(0 ${(Math.sin(time*1.6)*.55).toFixed(2)})`);
  limb('tail',Math.sin(time*.7)*(organic?.3:1.5));
 }else if(state.pose==='play'){
  const beat=Math.max(0,Math.sin(t*(state.mode==='puzzle'?4:6))),sniff=state.mode==='sniff';
  limb(part(svg,'arm-r')?'arm-r':'foot-l',-beat*(organic?22:state.mode==='feather'?26:18),-beat*(organic?2:state.mode==='feather'?8:5));
  head(sniff?(organic?1:3)+Math.sin(t*7)*.6:beat*.6,organic?0:Math.sin(t*3)*(sniff?3:2));limb('tail',Math.sin(t*6)*(organic?.5:4));
 }else if(state.pose==='hop'){
  const u=state.progress||0,bend=Math.sin(Math.PI*u);limb('foot-l',-bend*8);limb('foot-r',bend*8);limb('arm-l',bend*6);limb('arm-r',-bend*6);
 }else{
  head(Math.sin(time*1.7)*.3,Math.sin(time*.9)*(organic?.4:1.3));limb('tail',Math.sin(time*2)*(organic?.3:2));
  if(time%5.4>5.2)expressionExtra(svg,'closed','neutral');
 }
 syncEquipment(svg);
}
