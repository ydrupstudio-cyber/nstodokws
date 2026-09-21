/* Pure grid and save-state logic. No browser or server dependencies. */
export const SAVE_VERSION=3;
export function dimensions(item,catalog){return catalog[item.assetId].rotations[item.rotation||0].footprint}
export function project(x,y,size){return{x:size*32+(x-y)*32,y:112+(x+y)*16}}
export function unproject(x,y,size){const a=(x-size*32)/32,b=(y-112)/16;return{x:(a+b)/2,y:(b-a)/2}}
export function rectOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
export function placement(item,items,size,catalog){
  if(!catalog[item.assetId]||!Number.isInteger(item.rotation)||item.rotation<0||item.rotation>3||!Number.isInteger(item.x)||!Number.isInteger(item.y))return{ok:false,reason:'올바른 배치 정보가 필요해요.'};
  const[w,h]=dimensions(item,catalog),r={...item,w,h};
  if(r.x<0||r.y<0||r.x+w>size||r.y+h>size)return{ok:false,reason:'가구가 방 밖으로 나가요.'};
  for(const other of items){
    if(other.uid===item.uid||catalog[other.assetId].layer==='floor'||catalog[item.assetId].layer==='floor')continue;
    const[ow,oh]=dimensions(other,catalog);
    if(rectOverlap(r,{...other,w:ow,h:oh}))return{ok:false,reason:'다른 가구와 겹쳐요.'};
  }
  return{ok:true,reason:'여기에 놓을 수 있어요.'};
}
export function blocked(items,size,catalog){
  const cells=new Set();
  for(const item of items){if(!catalog[item.assetId].blocksMovement)continue;const[w,h]=dimensions(item,catalog);for(let x=item.x;x<item.x+w;x++)for(let y=item.y;y<item.y+h;y++)cells.add(`${x},${y}`)}
  return cells;
}
export function route(start,goal,items,size,catalog){
  const wall=blocked(items,size,catalog),key=(x,y)=>`${x},${y}`,sx=Math.floor(start.x),sy=Math.floor(start.y),gx=Math.floor(goal.x),gy=Math.floor(goal.y);
  if([sx,sy,gx,gy].some(v=>!Number.isFinite(v))||gx<0||gy<0||gx>=size||gy>=size||wall.has(key(gx,gy)))return[];
  const queue=[[sx,sy]],prev=new Map([[key(sx,sy),null]]);
  for(let i=0;i<queue.length;i++){
    const[x,y]=queue[i];if(x===gx&&y===gy)break;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(nx<0||ny<0||nx>=size||ny>=size||wall.has(k)||prev.has(k))continue;prev.set(k,[x,y]);queue.push([nx,ny])}
  }
  if(!prev.has(key(gx,gy)))return[];
  const path=[];let cursor=[gx,gy];while(cursor){path.push({x:cursor[0]+.5,y:cursor[1]+.5});cursor=prev.get(key(...cursor))}return path.reverse().slice(1);
}
export function approach(start,item,items,size,catalog){
  const[w,h]=dimensions(item,catalog),candidates=[];
  for(let x=item.x;x<item.x+w;x++)for(const y of[item.y-1,item.y+h])candidates.push({x:x+.5,y:y+.5});
  for(let y=item.y;y<item.y+h;y++)for(const x of[item.x-1,item.x+w])candidates.push({x:x+.5,y:y+.5});
  return candidates.map(goal=>({goal,path:route(start,goal,items,size,catalog)})).filter(v=>v.path.length||Math.hypot(v.goal.x-start.x,v.goal.y-start.y)<.1).sort((a,b)=>a.path.length-b.path.length)[0]||null;
}
export function defaultState(){return{version:SAVE_VERSION,level:0,coins:2800,wallpaper:'plain',ownedWallpapers:['plain'],floor:'wood',petId:'pet-brain',stage:4,items:[{uid:'sofa',assetId:'fn-sofa',x:0,y:1,rotation:0},{uid:'shelf',assetId:'fn-shelf',x:4,y:0,rotation:0},{uid:'plant',assetId:'fn-plant-large',x:0,y:0,rotation:0},{uid:'lamp',assetId:'fn-floor-lamp',x:0,y:3,rotation:0},{uid:'table',assetId:'fn-table',x:1,y:4,rotation:0},{uid:'bed',assetId:'fn-pet-bed',x:6,y:2,rotation:0},{uid:'bowl',assetId:'fn-bowl',x:6,y:4,rotation:0},{uid:'rug',assetId:'fn-rug',x:4,y:4,rotation:0}]}}
export function restoreState(raw,catalog,levels,wallpapers){
  const s=typeof raw==='string'?JSON.parse(raw):raw;
  if(!s||s.version!==SAVE_VERSION||!Number.isInteger(s.level)||!levels[s.level]||!Number.isSafeInteger(s.coins)||s.coins<0||!Number.isInteger(s.stage)||s.stage<0||s.stage>4||catalog[s.petId]?.category!=='pet'||catalog['floor-'+s.floor]?.category!=='floor'||!Array.isArray(s.items)||s.items.length>60||!Array.isArray(s.ownedWallpapers)||s.ownedWallpapers.length>20)throw Error('지원하지 않는 저장 파일이에요.');
  const allowed=['plain',...wallpapers.map(w=>w.id)];
  if(s.ownedWallpapers.some(x=>!allowed.includes(x))||!s.ownedWallpapers.includes(s.wallpaper))throw Error('벽지 정보를 확인해주세요.');
  const items=[],uids=new Set();
  for(const i of s.items){if(typeof i.uid!=='string'||uids.has(i.uid)||catalog[i.assetId]?.category!=='furniture'||!placement(i,items,levels[s.level].size,catalog).ok)throw Error('가구 배치를 확인해주세요.');uids.add(i.uid);items.push({uid:i.uid,assetId:i.assetId,x:i.x,y:i.y,rotation:i.rotation})}
  if(blocked(items,levels[s.level].size,catalog).size>=levels[s.level].size**2)throw Error('친구가 지낼 빈 칸이 필요해요.');
  return{version:SAVE_VERSION,level:s.level,coins:s.coins,wallpaper:s.wallpaper,ownedWallpapers:[...new Set(s.ownedWallpapers)],floor:s.floor,petId:s.petId,stage:s.stage,items};
}
