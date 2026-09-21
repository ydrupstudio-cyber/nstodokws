// ============================================================
// 펫 에셋 로더
//   에셋은 public/game/ 아래 정적 파일로 들어가 있다.
//   manifest.json 이 모든 경로의 정답이다 — 파일명 규칙을 직접 조립하지 마라.
//   (어른 단계만 growth/ 가 아니라 베이스 파일을 쓰는 등 예외가 있다)
// ============================================================
const BASE = '/game/';

let manifestPromise = null;
const svgCache = new Map();   // path -> Promise<string>

export function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(BASE + 'manifest.json')
      .then((r) => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
      .catch((e) => { manifestPromise = null; throw e; });
  }
  return manifestPromise;
}

export async function petAssets() {
  const m = await loadManifest();
  return m.assets.filter((a) => a.category === 'pet');
}

export async function petAsset(id) {
  return (await petAssets()).find((a) => a.id === id) || null;
}

/** species + breed 로 찾기 (DB 에는 이 두 값만 저장한다) */
export async function findAsset(species, breed) {
  const list = await petAssets();
  return list.find((a) => a.species === species && a.breed === breed)
      || list.find((a) => a.breed === breed)
      || null;
}

/** 같은 파일을 여러 번 받지 않는다. 한 마리 한 단계에 3파일(기본/걷기/휴식) 정도다 */
export function loadSvgSource(path) {
  if (!svgCache.has(path)) {
    svgCache.set(path, fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error('svg ' + path + ' ' + r.status);
      return r.text();
    }).catch((e) => { svgCache.delete(path); throw e; }));
  }
  return svgCache.get(path);
}

/** 선택 화면용 — 계통별로 묶어서 돌려준다 */
export async function grouped() {
  const list = await petAssets();
  return {
    cat:     list.filter((a) => a.species === 'cat'),
    dog:     list.filter((a) => a.species === 'dog'),
    special: list.filter((a) => a.species === 'special'),
  };
}

export const SPECIES_LABEL = { cat: '고양이', dog: '강아지', special: '해부 친구' };
export const STAGE_LABEL = ['아기', '꼬마', '청소년', '어른', '단짝'];
export const BOND_LABEL = ['서먹', '익숙', '친함', '단짝', '가족'];

/**
 * 걷기·휴식 원본에는 부착점이 없다. 2차 킷이 그 140개 자세의 좌표를
 * 따로 계산해 준 사이드카다 — 원본 그림을 건드리지 않고 옷을 붙이려고 있다.
 */
let motionAnchorPromise = null;
export function loadMotionAnchors() {
  if (!motionAnchorPromise) {
    motionAnchorPromise = fetch(BASE + 'pet/motion-anchors.json')
      .then((r) => { if (!r.ok) throw new Error('motion-anchors ' + r.status); return r.json(); })
      .catch((e) => { motionAnchorPromise = null; throw e; });
  }
  return motionAnchorPromise;
}
