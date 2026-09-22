'use client';

// ============================================================
// 펫을 실제로 움직이는 컴포넌트
//
// 디자인 킷의 rig.js / motion.js / equipment.js / actions.js 를 그대로 쓴다.
// 이 파일은 그것들을 React 생명주기에 얹는 얇은 껍데기다 —
// 모션 로직이나 부착 좌표를 여기에 새로 쓰지 마라.
//
// 흐름: 동작에 맞는 원본 고르기 → loadSvgSource → svgNode(id 접두사 부여)
//       → growth(단계 적용) → equip(착용) → 매 프레임 애니메이션
//
// 동작은 두 갈래다.
//   1차 킷 12종 : actionPose + animateAction
//   2차 킷  9종 : extraPose  + animateExtra   (roll 은 옆으로 누운 별도 원본)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { svgNode, growth } from '../lib/pet/rig';
import { actionPose, animateAction } from '../lib/pet/motion';
import { equip, syncEquipment, expressionExtra } from '../lib/pet/equipment';
import { equipWithFit } from '../lib/pet/wear-fit';
import { extraActions, extraPose, animateExtra, resetExtra } from '../lib/pet/actions';
import { animateRoomPet } from '../lib/pet/room-motion';
import { updateChew } from '../lib/pet/food-chew';
import { loadSvgSource, loadManifest, loadMotionAnchors, loadWearFitRules } from '../lib/pet/assets';

const EXTRA = new Set(extraActions.map((a) => a.id));
const ONE_SHOT = new Set(['celebrate', 'wave', 'stretch', 'wake', 'perk', 'highfive', 'show', 'sulk']);

// 동작이 스스로 정하는 표정(자고 있다, 기지개를 켠다)은 건드리지 않는다.
const MOOD_KEEP = new Set(['nap', 'wake', 'stretch', 'eat', 'doze', 'yawn', 'sulk']);

export default function PetCanvas({
  asset,            // manifest 의 펫 asset 객체
  stage = 3,        // 0~4
  action = 'idle',  // 1차 12종 + 2차 9종
  size = 220,
  onDone,           // 한 번만 재생하는 동작이 끝나면 호출
  embedded = false, // true 면 <g> 안에 중첩 <svg> 로 그린다 (미니룸 씬 안에 넣을 때)
  x = 0, y = 0,     // embedded 일 때 씬 좌표계에서의 위치
  mood = null,      // 'happy' | 'neutral' | null. 친밀도가 쌓이면 표정이 남는다
  wearing = null,   // { slot: itemId } — game_profiles.equipped 그대로
  onBounds,         // embedded 일 때 그려진 몸의 실제 범위를 씬 좌표로 알려준다
  /*
    미니룸 전용. 생활 컨트롤러가 내주는 스냅샷을 담은 ref 를 그대로 받는다.
    ref 인 이유 — 매 프레임 바뀌는 값을 prop 으로 내리면 방 전체가 다시 렌더된다.
    .current 에 값이 있으면 납품 팩의 방 전용 모션으로 팔다리를 움직이고,
    null 이면(간식·쓰다듬기처럼 밖에서 시킨 동작 중) 기존 동작 킷이 그대로 돈다.
  */
  roomState = null,
}) {
  const hostRef = useRef(null);
  const rafRef = useRef(0);
  const [err, setErr] = useState(null);
  // 부모가 매 렌더 새 함수를 줘도 애니메이션이 끊기지 않게 ref 로 받는다
  const onBoundsRef = useRef(onBounds);
  onBoundsRef.current = onBounds;
  // 만들어 둔 svg 와 지금 위치. 위치가 바뀌었다고 그림을 다시 만들면 안 된다
  const builtRef = useRef(null);
  const posRef = useRef({ x, y });
  posRef.current = { x, y };

  // 객체를 그대로 의존성에 넣으면 매 렌더 새 참조라 애니메이션이 끊긴다
  const wearKey = wearing ? Object.entries(wearing).sort().map((e) => e.join(':')).join(',') : '';

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const st = Math.max(0, Math.min(4, stage));
    const isExtra = EXTRA.has(action);

    (async () => {
      let manifest = null, sources = null;
      try {
        manifest = await loadManifest();
        // roll 은 옆으로 누운 별도 원본이 있다. 나머지는 기본/걷기/휴식 원본을 쓴다
        const path = isExtra
          ? extraPose(asset, st, action, manifest.expansionPoses || [])
          : actionPose(asset, st, action).source;

        const entries = [];
        if (wearing && manifest.wearables) {
          for (const id of Object.values(wearing)) {
            const w = manifest.wearables.find((x) => x.id === id);
            if (!w) continue;
            entries.push({ ...w, source: await loadSvgSource(w.path) });
          }
        }
        sources = { path, base: await loadSvgSource(path), entries };
      } catch (e) {
        if (!cancelled) setErr('그림을 불러오지 못했어요');
        return;
      }
      if (cancelled) return;

      let svg;
      try {
        svg = svgNode(sources.base);          // 인스턴스마다 id 에 접두사를 붙여준다
      } catch (e) {
        setErr('그림을 여는 중 문제가 생겼어요'); return;
      }
      svg.setAttribute('width', size);
      svg.setAttribute('height', size * 0.95);
      // 인라인 스타일로 한 번 더 못박는다. 전역 `svg { width: ... }` 같은 CSS 가
      // 속성을 덮어쓰면 방 안에서 펫만 거대해진다 (실제로 겪었다)
      svg.style.width = size + 'px';
      svg.style.height = (size * 0.95) + 'px';
      svg.style.display = 'block';
      if (embedded) {
        svg.setAttribute('x', posRef.current.x);
        svg.setAttribute('y', posRef.current.y);
        svg.style.width = ''; svg.style.height = '';   // 씬 좌표계에서는 속성으로만
        svg.setAttribute('width', size);
        svg.setAttribute('height', size * 0.95);
        svg.style.overflow = 'visible';
      }
      svg.dataset.stage = String(st);
      growth(svg, asset, st);

      // 착용. 걷기·휴식 원본에는 부착점이 없어서 사이드카 좌표를 쓴다.
      // 그 위에 그림별 보정(equipWithFit)을 얹는다 — 목도리가 얼굴을 덮던 문제.
      // 보정은 '지금 그리고 있는 그림의 정확한 경로'를 기준으로 하므로
      // sources.path 를 그대로 넘긴다. 기본/걷기/휴식이 각각 다른 값이다.
      if (sources.entries.length) {
        let sidecar = null, rules = null;
        try {
          const all = await loadMotionAnchors();
          sidecar = all?.[sources.path] || null;
        } catch { /* 사이드카가 없으면 원본의 앵커를 쓴다 */ }
        try { rules = await loadWearFitRules(); } catch { /* 규칙이 없으면 예전대로 */ }
        if (cancelled) return;
        try {
          if (rules) equipWithFit(svg, sources.entries, {
            rules, source: sources.path, breed: asset.breed, sidecar, hideBrainBody: true,
          });
          else equip(svg, sources.entries, sidecar);
        } catch { /* 한 아이템이 안 붙어도 펫은 나와야 한다 */
          try { equip(svg, sources.entries, sidecar); } catch {}
        }
      }

      host.replaceChildren(svg);
      builtRef.current = svg;
      setErr(null);

      // 그려진 몸이 씬에서 실제로 차지하는 칸. 부모가 이걸로 '쓰다듬기 판' 을 만든다.
      // 상수로 어림잡으면 캐릭터마다 어긋나서 머리를 눌렀는데 펫이 걸어가 버린다.
      if (embedded && onBoundsRef.current) {
        try {
          const body = svg.querySelector('[data-part="pet"]');
          const bb = body?.getBBox();
          const vb = svg.viewBox?.baseVal;
          if (bb && bb.width > 0 && vb?.width) {
            const k = size / vb.width;          // 씬 단위 / 리그 단위
            // 절대 좌표가 아니라 '그림 상자 안에서의 위치' 로 알린다.
            // 걸어다닐 때마다 값이 바뀌면 부모가 매 프레임 다시 그린다
            onBoundsRef.current({ dx: bb.x * k, dy: bb.y * k, w: bb.width * k, h: bb.height * k });
          }
        } catch { /* 범위를 못 재도 그림은 나와야 한다 */ }
      }

      // 저감 모션이면 한 프레임만 그리고 멈춘다
      if (reduced) {
        try {
          if (isExtra) animateExtra(svg, asset, st, action, 0, true);
          else animateAction(svg, asset, action, 0, true);
        } catch { /* 무시 */ }
        applyMood(svg, action, mood);
        return;
      }

      const start = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const t = (now - start) / 1000;
        try {
          const rs = roomState?.current;
          if (rs) {
            // 방 전용 모션 — 걷기·쉬기·앉기·놀기·빼꼼을 자세별로 직접 움직인다
            resetExtra(svg);
            animateRoomPet(svg, asset, st, rs);
          } else if (isExtra) {
            animateExtra(svg, asset, st, action, t, false);
          } else {
            // 2차 킷이 얹은 표정·앞발 순서를 되돌린 뒤 1차 동작을 돌린다
            resetExtra(svg);
            animateAction(svg, asset, action, t, false);
            syncEquipment(svg);   // 등 장식은 몸 변형을 따로 따라가야 한다
          }
          /*
            오물거리는 입. 납품 팩이 mouth-open 안쪽에 mouth-chew 를 만들어 넣는다.
            expression(svg,'eat') 가 이미 돈 뒤에 불러야 한다 — 그래서 여기다.
            먹는 동작이 아니면 null 로 불러 원래 입을 돌려준다.
          */
          try { updateChew(svg, action === 'eat' ? t : null, { reducedMotion: reduced }); }
          catch { /* 입 모양 하나 못 만들어도 나머지는 돈다 */ }
          // 애니메이션은 매 프레임 표정을 되돌린다. 기분은 그 뒤에 덧씌운다
          if (!roomState?.current) applyMood(svg, action, mood);
        } catch { /* 한 프레임 실패는 무시 */ }
        if (onDone && ONE_SHOT.has(action) && t > 1.9) { onDone(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
    // onDone 은 의도적으로 뺀다 — 부모가 매 렌더 새 함수를 주면 애니메이션이 끊긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // x·y 는 일부러 뺀다. 위치가 바뀔 때마다 그림을 다시 만들면
    // 애니메이션 시계가 매 프레임 0 으로 되돌아가 걷는 다리가 멈춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, stage, action, size, embedded, mood, wearKey]);

  // 위치만 바뀌었을 때는 속성만 갈아 끼운다
  useEffect(() => {
    if (!embedded) return;
    const svg = builtRef.current;
    if (!svg) return;
    svg.setAttribute('x', x);
    svg.setAttribute('y', y);
  }, [x, y, embedded]);

  if (embedded) {
    // 씬 SVG 안에서는 <g> 가 호스트다. 중첩 <svg> 가 들어간다
    return <g ref={hostRef} aria-hidden="true" />;
  }
  if (err) {
    return <div style={{ width: size, height: size * 0.95, display: 'grid', placeItems: 'center',
                         fontSize: 12, color: 'var(--text-3)' }}>{err}</div>;
  }
  return <div ref={hostRef} style={{ width: size, height: size * 0.95 }} aria-hidden="true" />;
}

function applyMood(svg, action, mood) {
  if (!mood || mood === 'neutral' || MOOD_KEEP.has(action)) return;
  // 2차 킷의 expressionExtra 는 sparkle·wide 같은 새 표정까지 안다.
  // 걷기·휴식 원본처럼 새 표정이 없는 그림에서는 알아서 happy·smile 로 내려간다
  try { expressionExtra(svg, mood === 'happy' ? 'sparkle' : 'open', mood === 'happy' ? 'wide' : 'neutral'); }
  catch { /* 이 캐릭터에 그 표정이 없으면 그냥 넘어간다 */ }
}
