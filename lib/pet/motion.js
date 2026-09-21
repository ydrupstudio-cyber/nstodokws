/* A single composable animation clock. All values are seconds, not frame counts. */
import {growth,part,around,expression,idle,celebrate} from './rig.js';
export function actionPose(asset,stage,action) {
  const kind=['walk','stretch','play'].includes(action)?'walk':['sit','nap','wake','eat'].includes(action)?'rest':null;
  return kind?asset.stages[stage].motionSources[kind]:{source:asset.stages[stage].source,sourceKey:asset.stages[stage].sourceKey};
}
export function animateAction(svg,asset,action,time,reduced=false) {
  const st=Number(svg.dataset.stage??3),params=asset.stages[st];
  growth(svg,asset,st);
  for(let i=1;i<=5;i++)part(svg,`vertebra-${i}`)?.setAttribute('transform','');
  expression(svg,'neutral');
  part(svg,'reaction-spark')?.setAttribute('display','none');
  const pet=part(svg,'pet'),base=around(100,176,params.scale);
  const setPet=(dx=0,dy=0,rot=0,sx=1,sy=1)=>pet.setAttribute('transform',`${base} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} 100 172) translate(100 176) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-100 -176)`);
  const limb=(id,rot=0,dx=0,dy=0)=>{const el=part(svg,id);if(!el)return;const[x,y]=(el.dataset.pivot||'100,150').split(',');el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${x} ${y})`)};
  const head=(dx,dy,rot)=>{for(const id of ['head','ear-l','ear-r']){const el=part(svg,id);if(el)el.setAttribute('transform',`${el.dataset.bindTransform||''} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${params.headPivot.join(' ')})`)}};
  if(reduced){if(action==='nap')expression(svg,'sleep');else if(['wave','play','celebrate'].includes(action))expression(svg,'happy');return}
  const organic=asset.species==='special',p=Math.sin(time*7.2),breath=Math.sin(time*1.6);
  if(action==='idle'){idle(svg,asset,time);if(time%5.3>5.1)expression(svg,'sleep')}
  if(action==='look'||action==='inspect'){
    const shift=Math.sin(time*1.8)*(organic?1.2:3);head(shift,0,shift*.5);limb('tail',shift);
  }
  if(action==='walk'){
    setPet(0,-Math.abs(p)*2.6,p*.7);
    limb('foot-l',p*14,p*3,-Math.max(0,p)*5);limb('foot-r',-p*14,-p*3,-Math.max(0,-p)*5);
    limb('arm-l',-p*13);limb('arm-r',p*13);limb('tail',Math.sin(time*5)*5);
    head(0,Math.abs(p)*.7,0);
  }
  if(action==='wave'){
    const left=part(svg,'arm-r')?'arm-r':'foot-l';limb(left,-20+Math.sin(time*12)*16,0,-4);
    expression(svg,'happy');head(0,0,organic?0:-2);
  }
  if(action==='stretch'){
    const v=Math.sin(Math.PI*Math.min(1,time/3));setPet(0,0,0,1+v*.035,1-v*.045);
    limb('foot-l',-v*12,-v*6,0);limb('foot-r',v*12,v*6,0);limb('arm-l',v*28);limb('arm-r',-v*28);head(0,v*2,0);expression(svg,'sleep');
  }
  if(['sit','nap','wake','eat'].includes(action)){
    const squash=organic?.88:1;setPet(0,0,0,1,squash+breath*.004);
    if(action==='nap'){expression(svg,'sleep');head(0,breath*.4,0)}
    if(action==='wake'){const v=Math.min(1,time/2.4);setPet(0,0,0,1,squash+(1-squash)*v);expression(svg,v<.35?'sleep':'neutral');head(0,-Math.sin(v*Math.PI)*3,0)}
    if(action==='eat'){expression(svg,Math.sin(time*8)>0?'eat':'neutral');head(0,Math.abs(Math.sin(time*4))*3,0);limb('arm-l',Math.sin(time*4)*7);limb('arm-r',-Math.sin(time*4)*7)}
  }
  if(action==='play'){
    const jump=Math.abs(Math.sin(time*4));setPet(0,-jump*8,Math.sin(time*4)*2);limb('foot-l',-jump*12);limb('foot-r',jump*12);limb('arm-l',jump*20);limb('arm-r',-jump*20);expression(svg,'happy');
  }
  if(action==='celebrate')celebrate(svg,asset,Math.min(1,time/1.8));
}
