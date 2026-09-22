/* 납품 원본(4차 방 팩 integration/food-chew.js) 그대로다. import 경로 한 줄만 고쳤다 — 이 저장소는 rig.js 다. */
/* Optional native rig attachment. No source, anchor, body or growth changes.
   Run AFTER the app's expression(svg,'eat'). Call with null when leaving eat.
   The chew shape lives INSIDE mouth-open, so existing expressions hide it. */
import {part} from './rig';
const chewBindings=new WeakMap();
export function installChew(svg){
 if(chewBindings.has(svg))return chewBindings.get(svg);
 const mouth=part(svg,'mouth-open');if(!mouth)return null;
 const ellipse=mouth.querySelectorAll('*');
 const hint=[...ellipse].find(el=>el.getAttribute('cx')!==null&&el.getAttribute('cy')!==null);
 if(!hint)return null;
 const x=Number(hint.getAttribute('cx')),small=Number(hint.getAttribute('rx'))<=3;
 const y=Number(hint.getAttribute('cy'))-(small?0:3.5),r=small?3.1:6.2;
 const nodes=[...mouth.childNodes].filter(el=>typeof el.setAttribute==='function');
 const original=nodes.map(el=>el.getAttribute('display'));
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');
 g.dataset.part='mouth-chew';g.id=mouth.id+'-chew';g.setAttribute('display','none');
 const p=document.createElementNS('http://www.w3.org/2000/svg','path');
 p.setAttribute('d',`M ${x-r} ${y} Q ${x-r*.45} ${y+2.7} ${x} ${y} Q ${x+r*.45} ${y-2.7} ${x+r} ${y}`);
 p.setAttribute('fill','none');p.setAttribute('stroke',hint.getAttribute('data-fill-slot')==='outline'?hint.getAttribute('fill'):'#443C4E');
 p.setAttribute('data-stroke-slot','outline');p.setAttribute('stroke-width',small?'1.6':'2.1');p.setAttribute('stroke-linecap','round');
 g.append(p);mouth.append(g);const record={mouth,g,nodes,original};chewBindings.set(svg,record);return record;
}
export function updateChew(svg,eatElapsed,{reducedMotion=false}={}){
 const enabled=Number.isFinite(eatElapsed)&&eatElapsed>=0&&eatElapsed<2.8;
 const r=enabled?installChew(svg):chewBindings.get(svg);if(!r)return false;
 const chew=enabled&&(reducedMotion||eatElapsed%.36>=.17);
 r.nodes.forEach((el,i)=>{if(chew)el.setAttribute('display','none');else if(r.original[i]===null)el.removeAttribute('display');else el.setAttribute('display',r.original[i]);});
 r.g.setAttribute('display',chew?'inline':'none');return chew;
}
