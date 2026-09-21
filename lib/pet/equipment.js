/* All coordinates belong to the character, never to item × breed corrections. */
import {svgNode,part} from './rig';
const NS='http://www.w3.org/2000/svg';
export function readAnchors(svg) {
  const out={};
  for(const marker of svg.querySelectorAll('[data-point]')) {
    const id=(marker.dataset.part||marker.id).replace(/^anchor-/,'');
    out[id]={point:marker.dataset.point.split(',').map(Number),scale:Number(marker.dataset.scale),rot:Number(marker.dataset.rot),localRot:Number(marker.dataset.localRot??marker.dataset.rot),parent:marker.dataset.parent,localPoint:marker.dataset.localPoint.split(',').map(Number),localScale:Number(marker.dataset.localScale),depth:marker.dataset.depth};
  }
  return out;
}
export function equip(svg,items,sidecar=null) {
  svg.querySelectorAll('[data-equipment]').forEach(el=>el.remove());
  if(items.some(item=>item.slot==='neck'))part(svg,'accessory-neck')?.replaceChildren();
  const anchors=sidecar||readAnchors(svg),warnings=[];
  // Stable layer order: back → torso → neck → limbs → face → head → ears.
  const order=['back','body','neck','hand','foot','face','head','ear'];
  for(const entry of [...items].sort((a,b)=>order.indexOf(a.slot)-order.indexOf(b.slot))) {
    const ids=['ear','hand','foot'].includes(entry.slot)?[entry.slot+'-l',entry.slot+'-r']:[entry.slot];
    if(ids.some(id=>!anchors[id])){warnings.push(entry.id+': attachment unavailable');continue}
    for(const id of ids) {
      if(entry.side&&id.endsWith(entry.side==='left'?'-r':'-l'))continue;
      const a=anchors[id],parent=part(svg,a.parent);if(!parent){warnings.push(entry.id+': parent unavailable');continue}
      const wrapper=document.createElementNS(NS,'g');wrapper.dataset.equipment=entry.id;wrapper.dataset.equipmentSlot=entry.slot;
      const inner=document.createElementNS(NS,'g');const[x,y]=a.localPoint,mirror=id.endsWith('-l')?-1:1;
      inner.setAttribute('transform',`translate(${x} ${y}) rotate(${a.localRot??a.rot}) scale(${a.localScale*mirror} ${a.localScale}) translate(-40 -40)`);
      const icon=svgNode(entry.source);inner.append(...icon.childNodes);wrapper.append(inner);
      if(a.depth==='back') {
        wrapper.dataset.follow=a.parent;wrapper.setAttribute('transform',parent.getAttribute('transform')||'');
        part(svg,'body').parentNode.insertBefore(wrapper,part(svg,'body'));
      } else parent.append(wrapper);
    }
  }
  return warnings;
}
export function syncEquipment(svg) {
  svg.querySelectorAll('[data-follow]').forEach(el=>el.setAttribute('transform',part(svg,el.dataset.follow)?.getAttribute('transform')||''));
}
export function expressionExtra(svg,eyes='open',mouth='neutral') {
  for(const side of ['l','r']) {
    const actual=part(svg,`eye-${side}-${eyes}`)?eyes:eyes==='sparkle'?'happy':'open';
    for(const name of ['open','closed','happy','sparkle','side'])part(svg,`eye-${side}-${name}`)?.setAttribute('display',actual===name?'inline':'none');
  }
  const actual=part(svg,'mouth-'+mouth)?mouth:mouth==='wide'?'smile':'neutral';
  for(const name of ['neutral','smile','open','wide','small'])part(svg,'mouth-'+name)?.setAttribute('display',name===actual?'inline':'none');
}
