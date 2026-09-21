/* Artwork fitting layer: existing character anchors and protected artwork stay untouched. */
import {equip,readAnchors} from './equipment';
import {part} from './rig';

export function equipWithFit(svg,items,{rules,source,breed,sidecar=null,hideBrainBody=true}={}) {
 if(!rules||!source)throw Error('wear-fit rules and exact source path are required');
 const row=rules.sources[source],hidden=[],unverified=[],accepted=[],anchors=sidecar||readAnchors(svg);
 for(const item of items){
  if(hideBrainBody&&breed==='brain'&&rules.brainBodyHiddenRecommendation.includes(item.id)){hidden.push(item.id);continue;}
  if(['brain','spine'].includes(breed)&&item.slot==='hand'&&!item.id.includes('chuseok')&&['l','r'].some(s=>!anchors['hand-'+s]?.parent.startsWith('arm-'))){hidden.push(item.id);continue;}
  const repaired=item.slot==='neck'||item.slot==='ear'||(['brain','spine'].includes(breed)&&['hand','foot'].includes(item.slot)&&item.id!=='wear-hand-bubble-wand'&&!item.id.includes('chuseok'));
  if(item.slot==='ear'&&!rules.knownEarItems.includes(item.id)){unverified.push(item.id);continue;}
  // 납품 원안은 규칙에 없는 그림이면 아이템을 아예 안 붙인다. 앱에는 굴러다니는
  // 자세(roll)처럼 규칙에 없는 원본이 하나 있는데, 거기서 목도리가 사라지는 편이
  // 조금 높이 걸리는 것보다 나쁘다. 그래서 보정 없이 기존 방식으로 붙인다.
  if(repaired&&!row){unverified.push(item.id);accepted.push(item);continue;}
  accepted.push(item);
 }
 const warnings=equip(svg,accepted,sidecar);
 let applied=0;const counts={};
 for(const wrapper of svg.querySelectorAll('[data-equipment]')){
  const id=wrapper.dataset.equipment,slot=wrapper.dataset.equipmentSlot;
  const index=counts[id]||0;counts[id]=index+1;
  const item=accepted.find(it=>it.id===id);
  const suffix=['ear','hand','foot'].includes(slot)?(item.side==='right'?'-r':item.side==='left'?'-l':index===0?'-l':'-r'):'';
  const values=row?.[slot+suffix],fit=values?.[id]||values?.['*'];if(!fit)continue;
  // equip() created one anchor wrapper. Append an artwork-local transform to it.
  const inner=wrapper.childNodes[0],base=inner.getAttribute('transform')||'';
  inner.setAttribute('transform',`${base} translate(${fit.dx} ${fit.dy}) translate(40 40) rotate(${fit.angle}) scale(${fit.sx} ${fit.sy}) translate(-40 -40)`);
  if(slot==='neck'){
   // The two chest tubes must sit in front of the forelegs. The fitted geometry
   // already clears the complete head and mouth, including the show pose.
   const parent=wrapper.parentNode;wrapper.dataset.follow=parent.dataset.part;
   wrapper.setAttribute('transform',parent.getAttribute('transform')||'');part(svg,'pet').append(wrapper);
  }
  wrapper.dataset.wearFit='v2';applied++;
 }
 return {warnings,hidden,unverified,applied};
}
