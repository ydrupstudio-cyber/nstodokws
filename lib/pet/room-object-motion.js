/* Animated prop layer. Use apply() with a mounted SVG, or animateSource() on the ORIGINAL source. */
(function(root){
'use strict';
const n=v=>Math.round(v*100)/100;
function animateSource(raw,state,it){
 const active=state.host?.uid===it.uid&&state.phase==='using',match=raw.match(/<g id="life-motion"([^>]*)>/);if(!match)return raw;
 const attrs=match[1],mode=attrs.match(/data-motion="([^"]+)"/)?.[1],pivot=(attrs.match(/data-pivot="([^"]+)"/)?.[1]||'128,140').split(',').map(Number),v=(attrs.match(/data-vector="([^"]+)"/)?.[1]||'0,0').split(',').map(Number);let transform='',opacity=mode==='light'?.13:1;
 if(active){const t=state.phaseTime,r=state.reducedMotion;
  if(mode==='ball'){const f=r?0:Math.sin(t*3.1);transform=`translate(${n(v[0]*f)} ${n(v[1]*f)}) rotate(${n(f*18)} ${pivot.join(' ')})`;}
  if(mode==='feather')transform=`rotate(${r?0:n(Math.sin(t*5.1)*11)} ${pivot.join(' ')})`;
  if(mode==='puzzle'){const f=r?.6:.5-.5*Math.cos(t*3.2);transform=`translate(${n(v[0]*f)} ${n(v[1]*f)})`;}
  if(mode==='sniff')transform=`translate(0 ${r?0:n(Math.sin(t*6)*.9)})`;
  if(mode==='light')opacity=r?1:.75+.25*Math.sin(t*2);
  if(mode==='music')transform=`rotate(${r?0:n(t*55)} ${pivot.join(' ')})`;
 }
 return raw.replace(match[0],`<g id="life-motion"${attrs} transform="${transform}" opacity="${n(opacity)}">`);
}
function apply(svg,state,item){
 const layer=svg.querySelector('[data-motion]');if(!layer)return false;
 // Small adapter preserves the same attribute calculation as the string renderer.
 const attrs=['data-motion','data-pivot','data-vector'].map(k=>`${k}="${layer.getAttribute(k)||''}"`).join(' ');
 const animated=animateSource(`<g id="life-motion" ${attrs}></g>`,state,item);
 layer.setAttribute('transform',animated.match(/ transform="([^"]*)"/)?.[1]||'');
 layer.setAttribute('opacity',animated.match(/ opacity="([^"]*)"/)?.[1]||'1');
 return true;
}
const api={animateSource,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NSPetRoomObjects=api;
})(typeof window==='undefined'?globalThis:window);
