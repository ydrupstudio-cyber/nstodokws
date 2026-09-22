/* 납품 원본(4차 방 팩 integration/hide-peek.js) 그대로다. 아래 export 한 줄만 앱이 더했다. */
/* Render-only positioning: keep the selected current-stage pet and its scale.
   facePoint is readAnchors(petSvg).face.point or the rest source's sidecar.
   That point includes bound part transforms, but excludes growth/root scaling. */
(function(root){
'use strict';
function resolveOpening(rotation,portId){
 if(!rotation.ports)return rotation;
 return rotation.ports.find(p=>p.id===(portId??'left'))||null;
}
function peekFoot(rotation,portId,{facePoint,stageScale=1,renderScale=.55}){
 const opening=resolveOpening(rotation,portId),target=opening?.peekFaceTarget;
 if(!opening?.doorway||!target||!facePoint)return null;
 if(![...facePoint,stageScale,renderScale].every(Number.isFinite)||stageScale<=0||renderScale<=0)throw Error('Invalid peek face coordinates');
 return{x:target[0]-(facePoint[0]-100)*stageScale*renderScale,y:target[1]-(facePoint[1]-176)*stageScale*renderScale};
}
const api={resolveOpening,peekFoot};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NSPetHidePeek=api;
})(typeof window==='undefined'?globalThis:window);

// 앱이 더한 줄
const _peek = (typeof module !== 'undefined' && module.exports) ? module.exports
            : (typeof window !== 'undefined' ? window.NSPetHidePeek : globalThis.NSPetHidePeek);
export const resolveOpening = _peek.resolveOpening;
export const peekFoot = _peek.peekFoot;
