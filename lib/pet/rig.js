/* Framework-free SVG rig adapter. Import these functions into the app. */
let instance = 0;
export function svgNode(source) {
  const host = document.createElement('template');
  host.innerHTML = source.trim();
  const svg = host.content.firstElementChild;
  const prefix = `ns-${++instance}-`;
  const ids = new Map();
  svg.querySelectorAll('[id]').forEach(el => {
    const id = el.id; ids.set(id, prefix + id);
    el.dataset.part = id; el.id = prefix + id;
  });
  svg.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const value = attr.value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${ids.get(id) || id})`);
      if (value !== attr.value) el.setAttribute(attr.name, value);
    }
  });
  return svg;
}
export function part(svg, name) { return svg.querySelector(`[data-part="${name}"]`); }
export function around(x, y, s) { return `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`; }
export function expression(svg, state = 'neutral') {
  const eye = state === 'sleep' ? 'closed' : state === 'happy' ? 'happy' : 'open';
  const mouth = state === 'happy' ? 'smile' : state === 'eat' ? 'open' : 'neutral';
  for (const side of ['l', 'r']) for (const name of ['open', 'closed', 'happy'])
    part(svg, `eye-${side}-${name}`)?.setAttribute('display', name === eye ? 'inline' : 'none');
  for (const name of ['neutral', 'smile', 'open'])
    part(svg, `mouth-${name}`)?.setAttribute('display', name === mouth ? 'inline' : 'none');
}
export function coat(svg, colors) {
  if (!colors) return;
  svg.querySelectorAll('[data-fill-slot]').forEach(el => el.setAttribute('fill', colors[el.dataset.fillSlot]));
  svg.querySelectorAll('[data-stroke-slot]').forEach(el => el.setAttribute('stroke', colors[el.dataset.strokeSlot]));
}
export function growth(svg, asset, stage) {
  const params = asset.stages[stage];
  part(svg, 'pet').setAttribute('transform', around(100, 176, params.scale));
  // The selected SVG already contains the stage's body, limbs and resting pose.
  for (const id of ['head','ear-l','ear-r','body','tail','foot-l','foot-r','arm-l','arm-r']) {
    const el=part(svg,id); if(el) el.setAttribute('transform',el.dataset.bindTransform || '');
  }
  for (const side of ['l', 'r']) {
    const eye = part(svg, `eye-${side}`);
    const [ex, ey] = eye.dataset.pivot.split(',').map(Number);
    eye.setAttribute('transform', around(ex, ey, params.eyeScale));
  }
  svg.dataset.stage = stage;
}
export function wear(svg, source, asset) {
  const target = part(svg, 'accessory-neck');
  target.replaceChildren();
  if (!source) return;
  const accessory = svgNode(source);
  target.append(...part(accessory, 'accessory-neck').childNodes);
  const stage=asset.stages[Number(svg.dataset.stage || 3)];
  const [x, y] = stage.scarfOffset || asset.scarfOffset;
  target.setAttribute('transform', `translate(${x} ${y}) ${around(104,124,stage.scarfScale || asset.scarfScale)}`);
}
export function idle(svg, asset, time) {
  const stage = Number(svg.dataset.stage || 3);
  const params = asset.stages[stage];
  const organic=asset.breed==='brain'||asset.breed==='spine';
  const tilt = Math.sin(time * [1,.9,.65,.5,.9][stage]) * (organic?.65:[2,2,5,1,2][stage]);
  const [hx, hy] = params.headPivot || asset.headPivot;
  const base=el=>el?.dataset.bindTransform || '';
  const head=part(svg,'head');
  const h = `${base(head)} rotate(${tilt.toFixed(2)} ${hx} ${hy})`;
  head.setAttribute('transform', h);
  const sway=stage===0?Math.sin(time*1.3)*.9:asset.breed==='spine'?Math.sin(time*.85)*1.3:0;
  part(svg,'pet').setAttribute('transform',`${around(100,176,params.scale)} rotate(${sway.toFixed(2)} 100 176)`);
  for (const id of ['ear-l', 'ear-r']) {
    const el = part(svg, id); const [x,y] = el.dataset.pivot.split(',');
    el.setAttribute('transform', `${base(el)} rotate(${tilt.toFixed(2)} ${hx} ${hy}) rotate(${(Math.sin(time*1.8)*1.3).toFixed(2)} ${x} ${y})`);
  }
  const tail = part(svg,'tail'); const [tx,ty] = tail.dataset.pivot.split(',');
  tail.setAttribute('transform', `${base(tail)} rotate(${(Math.sin(time*[.8,2.5,3,1.4,4][stage])*(organic?.6:[1.5,3,4,2.5,4][stage])).toFixed(2)} ${tx} ${ty})`);
  part(svg,'body').setAttribute('transform',`${base(part(svg,'body'))} translate(104 164) scale(1 ${(1+Math.sin(time*1.6)*(organic?.002:.006)).toFixed(4)}) translate(-104 -164)`);
  for(const side of ['l','r']) {
    const foot=part(svg,'foot-'+side);let dx=0,dy=0,rot=0;
    if(!organic&&stage===1&&side==='l')dy=-Math.max(0,Math.sin(time*2.4))*4;
    if(!organic&&stage===3){const stretch=Math.max(0,Math.sin(time*.65)-.75)*4;dx=stretch*(side==='l'?-4:4);dy=-stretch*2;}
    if(!organic&&stage===4&&side==='l')rot=Math.sin(time*4)*12;
    const [x,y]=foot.dataset.pivot.split(',');
    foot.setAttribute('transform',`${base(foot)} translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${x} ${y})`);
  }
  if (asset.breed === 'spine') for (let i=1;i<=(asset.lumbarCount||5);i++) {
    const seg = part(svg,`vertebra-${i}`); if(!seg)continue;const [x,y] = seg.dataset.pivot.split(',');
    seg.setAttribute('transform',`rotate(${(Math.sin(time*1.3+i*.35)*.65).toFixed(2)} ${x} ${y})`);
  }
  part(svg,'reaction-spark')?.setAttribute('display','none');
}
export function celebrate(svg,asset,progress) {
  const st=asset.stages[Number(svg.dataset.stage||3)],pulse=Math.sin(Math.PI*Math.max(0,Math.min(1,progress)));
  const tall=asset.breed==='spine'||asset.breed==='welsh-corgi';
  const scale=st.scale*(1+pulse*(tall?.02:.06)),stretch=asset.breed==='spine'?1+pulse*.025:1;
  part(svg,'pet').setAttribute('transform',`translate(0 ${(tall?0:-pulse*3).toFixed(2)}) translate(100 176) scale(${scale.toFixed(3)} ${(scale*stretch).toFixed(3)}) translate(-100 -176)`);
  expression(svg,'happy');
  if(asset.species==='cat'){
    const paw=part(svg,'foot-l'),[x,y]=paw.dataset.pivot.split(',');
    paw.setAttribute('transform',`translate(0 ${(-pulse*12).toFixed(2)}) rotate(${(-pulse*18).toFixed(2)} ${x} ${y})`);
  }else if(asset.species==='dog'){
    const tail=part(svg,'tail'),[x,y]=tail.dataset.pivot.split(',');
    tail.setAttribute('transform',`rotate(${(Math.sin(progress*24)*4).toFixed(2)} ${x} ${y})`);
  }else if(asset.breed==='brain')part(svg,'reaction-spark')?.setAttribute('display',pulse>.15?'inline':'none');
}
export function boxState(svg, state) {
  for (const name of ['closed', 'opening', 'open']) part(svg, `box-${name}`)?.setAttribute('display', name === state ? 'inline' : 'none');
}
