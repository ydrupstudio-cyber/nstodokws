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

/**
 * 걸레받이 — 벽 아래를 다른 색으로 두르는 띠.
 * 3차 벽지부터 baseColor·baseboardHeight 를 들고 온다. 없는 벽지는 그리지 않는다.
 * 이 띠 하나로 바닥과 벽의 경계가 생겨서 방이 훨씬 방처럼 보인다.
 */
export function wallBaseboard(size, bh) {
  const top = project(0, 0, size);
  const right = project(size, 0, size);
  const left = project(0, size, size);
  const pts = (a) => a.map((p) => `${p.x},${p.y}`).join(' ');
  return {
    right: pts([top, right, { x: right.x, y: right.y - bh }, { x: top.x, y: top.y - bh }]),
    left:  pts([top, left,  { x: left.x,  y: left.y  - bh }, { x: top.x, y: top.y - bh }]),
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
  sit: 'sit', sleep: 'nap', nap: 'nap', eat: 'eat', play: 'play',
  inspect: 'inspect', look: 'look',
};

/**
 * 킷 manifest 가 비워 둔 가구에 행동을 붙인다.
 * manifest 는 킷 원본이라 손대지 않는다 — 다시 납품받으면 덮어써지기 때문이다.
 * 방석에 눕지 못하고 소파를 못 알아보는 게 이상해서 여기서 채운다.
 */
/*
  3차 납품 표(interaction-profiles.json)는 그때 새로 들어온 가구 23종만 담고 있다.
  1·2차 가구 — 민트 소파, 펫 침대, 방석 —— 에는 표가 없어서, 펫이 소파까지
  걸어가 놓고 아무것도 안 하고 돌아섰다. 여기서 채운다.
  납품 표는 손대지 않는다 (다시 받으면 덮어써진다). 읽은 뒤에 이걸 덧댄다.

  mode  rest = 눕기 · sit = 앉기 · hide = 들어가 숨기
  target 은 가구 안에서 앉을 자리 (가로·세로 비율), height 는 올라앉는 높이(px).
  hide 는 앞판 그림(occlusion.json)이 있어야 해서 지금은 felt 숨숨집뿐이다.
*/
export const EXTRA_PROFILES = (() => {
  const seat = (height, target = [0.5, 0.65]) => ({
    mode: 'sit', height, mount: true, entry: 'any',
    enterSeconds: 0.95, exitSeconds: 0.85, useSeconds: 5, autoSeconds: 18,
    holdOnClick: true, automatic: true, weight: 1, target,
  });
  const bed = (height, target = [0.5, 0.6]) => ({ ...seat(height, target), mode: 'rest' });
  return {
    'fn-sofa': seat(33), 'fn-beanbag': seat(26), 'fn-chair': seat(34),
    'fn-rocking-chair': seat(32), 'fn-floor-pillow': seat(10, [0.5, 0.6]),
    'fn-pet-bed': bed(14), 'fn-cushion': bed(9), 'fn-cushion-pile': bed(16),
    'fn-hammock-bed': bed(30),
  };
})();

export const EXTRA_INTERACTION = {
  'fn-cushion': 'nap',
  'fn-cushion-pile': 'nap',
  'fn-beanbag': 'sit',
  'fn-chair': 'sit',
  'fn-dog-house': 'nap',
  'fn-rug': 'sit',
  'fn-table-lamp': 'look',
  'fn-plant-small': 'inspect',
  'fn-frame': 'inspect',
  'fn-clock': 'look',
  'fn-board': 'inspect',
};

export function interactionOf(asset) {
  if (!asset) return null;
  return asset.interaction || EXTRA_INTERACTION[asset.id] || null;
}

/**
 * 올라가서 쉴 수 있는 가구. 값은 바닥에서 '앉는 면' 까지의 높이(씬 단위)다.
 * 가구 그림마다 앉는 높이가 달라서 manifest 에 없는 값이라 눈으로 맞췄다.
 * 0 이면 바닥과 같은 높이 (러그·방석처럼 납작한 것).
 */
export const PERCH_LIFT = {
  'fn-rug': 0,
  'fn-cushion': 5,
  'fn-pet-bed': 8,
  'fn-beanbag': 20,
  'fn-cushion-pile': 22,
  'fn-chair': 28,
  'fn-sofa': 30,
};

/**
 * 가구 위에서 펫이 설 칸. 점유 칸 중 가장 앞쪽(화면 아래쪽)을 고른다.
 * 뒤쪽 칸을 고르면 깊이 정렬에서 펫이 가구 뒤로 숨는다.
 */
export function perchCell(item, catalog) {
  const [w, h] = dimensions(item, catalog);
  return { x: item.x + w - 1, y: item.y + h - 1 };
}

/**
 * 방을 열었을 때 다가와 설 자리 — 화면 앞쪽 가운데.
 * (x+y) 가 클수록 앞이고, (x-y) 가 0 에 가까울수록 가운데다.
 */
export function frontCell(size, blockedCells) {
  let best = null, bestScore = -Infinity;
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    if (blockedCells.has(`${x},${y}`)) continue;
    const score = (x + y) * 2 - Math.abs(x - y);
    if (score > bestScore) { bestScore = score; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return best;
}
