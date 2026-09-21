// ============================================================
// 미니룸 — 렌더링 보조
//
// 격자 계산·충돌·경로 탐색은 room-engine.js (디자인 킷 원본) 이 한다.
// 이 파일은 그 결과를 화면 좌표로 바꾸고 벽·바닥 도형을 만드는 일만 한다.
//
// 좌표 규약 (킷 인계서 기준, 절대 바꾸지 마라)
//   screenX = N*32 + (gx-gy)*32
//   screenY = 112 + (gx+gy)*16
//   가구 SVG viewBox 0 0 256 224, 바닥 기준점 (128,164)
//   펫  SVG viewBox 0 0 200 190, 바닥 기준선 y=176
// ============================================================
import { project, dimensions } from './room-engine';

export const ASSET_BASE = '/game/';

/** manifest 배열 → id 로 찾는 사전. room-engine 이 이 형태를 기대한다 */
export function buildCatalog(manifest) {
  const cat = {};
  manifest.assets.forEach((a) => { cat[a.id] = a; });
  return cat;
}

/** 방 크기에 맞춘 화면 영역. 벽 높이만큼 위로 더 잡아준다 */
export function viewBoxFor(size, wallHeight = 96) {
  const top = project(0, 0, size);
  const bottom = project(size, size, size);
  const pad = 14;
  const minY = top.y - wallHeight - pad;
  return [-pad, minY, size * 64 + pad * 2, bottom.y - minY + pad];
}

/** 바닥 마름모 꼭짓점 */
export function floorCorners(size) {
  return [project(0, 0, size), project(size, 0, size), project(size, size, size), project(0, size, size)];
}

/** 좌·우 벽면 사각형 (뒤쪽 두 면은 없다) */
export function wallShapes(size, h = 96) {
  const top = project(0, 0, size);
  const right = project(size, 0, size);
  const left = project(0, size, size);
  const pts = (a) => a.map((p) => `${p.x},${p.y}`).join(' ');
  return {
    right: pts([top, right, { x: right.x, y: right.y - h }, { x: top.x, y: top.y - h }]),
    left:  pts([top, left,  { x: left.x,  y: left.y  - h }, { x: top.x, y: top.y - h }]),
  };
}

/** 가구 한 점의 화면 위치. 점유 칸의 중심을 투영하고 앵커만큼 당긴다 */
export function furniturePos(item, catalog, size) {
  const [w, h] = dimensions(item, catalog);
  const p = project(item.x + w / 2, item.y + h / 2, size);
  const [ax, ay] = catalog[item.assetId].anchor || [128, 164];
  return { x: p.x - ax, y: p.y - ay, w, h };
}

/**
 * 그리는 순서.
 * 바닥에 깔리는 것(러그 등) 먼저, 그 다음 물체와 펫을 앞쪽 깊이 기준으로 정렬한다.
 * 완전한 3D 교차를 푸는 렌더러가 아니라 작은 아이소메트릭 방을 위한 단순 규칙이다.
 */
export function depthSorted(items, catalog, pet) {
  const floor = [], objects = [];
  items.forEach((it) => {
    const a = catalog[it.assetId];
    if (!a) return;
    const [w, h] = dimensions(it, catalog);
    const entry = { kind: 'item', item: it, depth: (it.x + w - 1) + (it.y + h - 1) };
    (a.layer === 'floor' ? floor : objects).push(entry);
  });
  if (pet) objects.push({ kind: 'pet', depth: Math.floor(pet.x) + Math.floor(pet.y) + 0.5 });
  objects.sort((a, b) => a.depth - b.depth);
  return [...floor, ...objects];
}

/** 펫이 서 있는 격자 좌표 → 화면 좌표. 펫 SVG 는 바닥선이 y=176 */
export function petPos(pt, size, scale) {
  const p = project(pt.x, pt.y, size);
  return { x: p.x - 100 * scale, y: p.y - 176 * scale };
}

/** 빈 칸 중 하나를 고른다. 갈 수 있는 곳이 없으면 null */
export function randomFreeCell(size, blockedCells, rng = Math.random) {
  const free = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    if (!blockedCells.has(`${x},${y}`)) free.push({ x: x + 0.5, y: y + 0.5 });
  }
  return free.length ? free[Math.floor(rng() * free.length)] : null;
}

/** 가구가 유도하는 행동. 없으면 둘러보기 */
export const INTERACTION_ACTION = {
  sit: 'sit', sleep: 'nap', eat: 'eat', play: 'play', inspect: 'inspect',
};
