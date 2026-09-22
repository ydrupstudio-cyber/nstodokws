/* 납품 원본(4차 방 팩 integration/room-food.js) 그대로다. 아래 export 한 줄만 앱이 더했다. */
/* Additive drawing helpers. The app owns timing, cost, bond, play and growth.
   Call foodFrame only while rendering the app's eat phase. No timers inside. */
(function(root){
'use strict';
const IDS=['kibble','churu','milk','cookie','jerky','sausage','cup-ramen','protein-drink','cup-rice','special-cake'];
function foodFrame(id,eatElapsed){
 if(!IDS.includes(id)||!Number.isFinite(eatElapsed)||eatElapsed<0)return null;
 const stage=eatElapsed<.9?'full':eatElapsed<2?'half':'empty';
 return{id,stage,source:`room/food/eat-${id}-${stage}.svg`,anchor:[128,164],blocksMovement:false};
}
function foodPlacement(foot,{offset=[0,14],scale=.76}={}){
 // Screen-space offset after room projection. Never a grid occupant.
 if(!Number.isFinite(scale)||scale<=0)throw Error('food scale must be positive');
 return{x:foot.x+offset[0]-128*scale,y:foot.y+offset[1]-164*scale,width:256*scale,height:224*scale};
}
const api={foodFrame,foodPlacement,foodIds:IDS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NSPetRoomFood=api;
})(typeof window==='undefined'?globalThis:window);

// 앱이 더한 줄 — 이 저장소는 ESM 이라 IIFE 결과를 이렇게 꺼내 쓴다
const _food = (typeof module !== 'undefined' && module.exports) ? module.exports
            : (typeof window !== 'undefined' ? window.NSPetRoomFood : globalThis.NSPetRoomFood);
export const foodFrame = _food.foodFrame;
export const foodPlacement = _food.foodPlacement;
export const foodIds = _food.foodIds;
