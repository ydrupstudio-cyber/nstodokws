import {growth,part,around} from './rig';
import {expressionExtra,syncEquipment} from './equipment.js';
export const extraActions=[
 {id:'groom',name:'앞발 정리',duration:4,pose:'base',trigger:'idle',fx:null},
 {id:'yawn',name:'길게 하품',duration:3.4,pose:'base',trigger:'idle',fx:'zzz'},
 {id:'roll',name:'데굴데굴',duration:4.8,pose:'curl',trigger:'idle',fx:'note'},
 {id:'perk',name:'반가워!',duration:2,pose:'base',trigger:'return',fx:'exclaim'},
 {id:'sulk',name:'새침한 곁눈질',duration:3.2,pose:'base',trigger:'tap',fx:null},
 {id:'show',name:'오늘의 착장',duration:4.2,pose:'base',trigger:'equip',fx:'sparkle'},
 {id:'focus',name:'생각 중',duration:4,pose:'base',trigger:'focus',fx:null},
 {id:'doze',name:'꾸벅, 깜짝',duration:5,pose:'base',trigger:'idle',fx:'zzz'},
 {id:'highfive',name:'하이파이브',duration:2.6,pose:'base',trigger:'tap',fx:'heart'}
];
export function extraPose(asset,stage,action,poses) {
  if(action==='roll')return poses.find(p=>p.pet===asset.id&&p.stage===stage).path;
  return asset.stages[stage].source;
}
export function resetExtra(svg) {
  for(const [id,before] of [['foot-l','foot-r'],['arm-r','foot-l']]) {const el=part(svg,id);if(el?.dataset.raised==='true'){part(svg,'pet').insertBefore(el,part(svg,before));el.dataset.raised='false'}}
  expressionExtra(svg);
}
export function animateExtra(svg,asset,stage,action,elapsed,reduced=false) {
  resetExtra(svg);
  growth(svg,asset,stage);expressionExtra(svg);
  for(let i=1;i<=5;i++)part(svg,'vertebra-'+i)?.setAttribute('transform','');
  const meta=extraActions.find(a=>a.id===action),t=Math.min(meta?.duration||6,Math.max(0,elapsed));
  const u=Math.min(1,t/(meta?.duration||6));const envelope=Math.sin(Math.PI*u),organic=asset.species==='special',brain=asset.breed==='brain',spine=asset.breed==='spine';
  // Stage-dependent energy, but never a return to baby proportions.
  const energy=[.5,.72,.9,.82,1][stage],pet=part(svg,'pet'),base=around(100,176,asset.stages[stage].scale);
  const limb=(id,rot=0,dx=0,dy=0)=>{const el=part(svg,id);if(!el)return;const[x,y]=(el.dataset.pivot||'100,150').split(',');el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${x} ${y})`)};
  const head=(dy=0,rot=0,dx=0)=>{for(const id of ['head','ear-l','ear-r']){const el=part(svg,id);if(el)el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${asset.stages[stage].headPivot.join(' ')})`)}};
  const whole=(dx=0,dy=0,rot=0,pivot='100 160')=>pet.setAttribute('transform',`${base} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${pivot})`);
  const paw=part(svg,'arm-r')?'arm-r':'foot-l';
  const raise=()=>{const el=part(svg,paw);if(el){part(svg,'pet').append(el);el.dataset.raised='true'}};
  if(reduced) {
    if(['yawn','doze'].includes(action))expressionExtra(svg,'closed','small');
    else if(action==='sulk')expressionExtra(svg,'side','small');
    else if(action==='focus')expressionExtra(svg,'open','small');
    else expressionExtra(svg,'happy','smile');
    syncEquipment(svg);return;
  }
  if(action==='idle') {head(Math.sin(t*1.6)*.35,Math.sin(t*.8)*energy);limb('tail',Math.sin(t*2.1)*3*energy);if(t%5.3>5.1)expressionExtra(svg,'closed')}
  if(action==='groom') {
    const dab=(.5+.5*Math.sin(t*7))*envelope;head(2*envelope,organic?0:8*envelope);limb(paw,(organic?-35:-30)*envelope,organic?-9*envelope:8*envelope,-(organic?3:21)*envelope);
    raise();
    expressionExtra(svg,'closed',dab>.6?'open':'small');
  }
  if(action==='yawn') {head(-envelope*1.5,-envelope*3);limb(paw,-20*envelope,0,-8*envelope);expressionExtra(svg,u>.18&&u<.82?'closed':'open',u>.2&&u<.78?'open':'small')}
  if(action==='roll') {
    const rock=Math.sin(u*Math.PI*4)*envelope;
    // Organs recline as intact silhouettes; spine retains L1–L5 and sacrum.
    whole(rock*(organic?6:9),organic?0:-2*envelope,rock*(spine?23:brain?17:15),'103 149');
    limb('foot-l',rock*12);limb('foot-r',-rock*12);expressionExtra(svg,'happy','wide');
  }
  if(action==='perk') {whole(0,-Math.sin(Math.PI*u)*3*energy,0);head(-2*envelope,0);limb('ear-l',-envelope*7);limb('ear-r',envelope*7);limb('tail',Math.sin(t*13)*5*envelope);expressionExtra(svg,'sparkle','wide');}
  if(action==='sulk') {head(0,organic?2:6,2*envelope);expressionExtra(svg,u>.78?'happy':'side',u>.78?'smile':'small')}
  if(action==='show') {const sway=Math.sin(u*Math.PI*2)*envelope;whole(sway*3,0,sway*(organic?2:4));head(0,-sway*2);limb(paw,-30*envelope,0,-6*envelope);expressionExtra(svg,'sparkle','wide')}
  if(action==='focus') {head(envelope,organic?0:4*envelope);limb(paw,-12*envelope,0,-5*envelope);expressionExtra(svg,'open','small')}
  if(action==='doze') {const nod=u<.76?Math.max(0,Math.sin(u/.76*Math.PI))*3:0;head(nod,organic?0:nod*1.8);expressionExtra(svg,u<.76?'closed':'sparkle',u<.76?'small':'open');if(u>=.76)whole(0,-Math.sin((u-.76)/.24*Math.PI)*2*energy)}
  if(action==='highfive') {const reach=Math.sin(Math.PI*Math.min(1,u*1.3));limb(paw,-(organic?68:49)*reach,organic?-2:0,-(organic?7:15)*reach);raise();expressionExtra(svg,'happy','wide');head(0,organic?0:-2*reach)}
  syncEquipment(svg);
}
