/**
 * 생활동작 컨트롤러 감싸개.
 *
 * 납품 파일 두 개는 CommonJS 와 window 전역을 둘 다 지원하는 예전 방식이다.
 * 번들러는 module.exports 를 보고 CommonJS 로 취급하므로 기본 가져오기로 받고,
 * 혹시 전역으로만 붙는 환경을 대비해 window 쪽도 한 번 본다.
 * 납품 파일 자체는 손대지 않는다 — 다음 납품 때 덮어쓰기만 하면 된다.
 */
import roomLife from './room-life';
import roomObjects from './room-object-motion';

const g = typeof window === 'undefined' ? globalThis : window;

export const RoomLife = roomLife?.Controller ? roomLife : g.NSPetRoomLife;
export const RoomObjects = roomObjects?.apply ? roomObjects : g.NSPetRoomObjects;
export const Controller = RoomLife?.Controller;

/** 방에 놓인 가구를 컨트롤러가 읽는 모양으로 바꾼다 (회전이 0~3 색인이라 90 을 곱한다) */
export function toWorldItems(items) {
  return (items || []).map((it) => ({
    uid: it.uid, assetId: it.assetId,
    x: Math.round(it.x), y: Math.round(it.y),
    rotation: ((it.rotation || 0) % 4) * 90,
  }));
}

/** 컨트롤러가 말하는 자세 → 우리 PetCanvas 가 아는 동작 이름 */
export const POSE_ACTION = {
  idle: 'idle', walk: 'walk', rest: 'nap', sit: 'sit',
  play: 'play', look: 'inspect', hop: 'stretch', climb: 'walk', peek: 'inspect',
};
