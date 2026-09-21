'use client';

// ============================================================
// 펫을 실제로 움직이는 컴포넌트
//
// 디자인 킷의 rig.js / motion.js 를 그대로 쓴다. 이 파일은 그것들을
// React 생명주기에 얹는 얇은 껍데기다 — 모션 로직을 여기에 새로 쓰지 마라.
//
// 흐름: actionPose(동작에 맞는 원본 고르기) → loadSvgSource → svgNode(id 접두사 부여)
//       → growth(단계 적용) → 매 프레임 animateAction
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { svgNode, growth } from '../lib/pet/rig';
import { actionPose, animateAction } from '../lib/pet/motion';
import { loadSvgSource } from '../lib/pet/assets';

export default function PetCanvas({
  asset,            // manifest 의 펫 asset 객체
  stage = 3,        // 0~4
  action = 'idle',  // idle walk wave stretch sit nap wake eat play look inspect celebrate
  size = 220,
  onDone,           // celebrate 처럼 한 번만 재생하는 동작이 끝나면 호출
  embedded = false, // true 면 <g> 안에 중첩 <svg> 로 그린다 (미니룸 씬 안에 넣을 때)
  x = 0, y = 0,     // embedded 일 때 씬 좌표계에서의 위치
}) {
  const hostRef = useRef(null);
  const rafRef = useRef(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const st = Math.max(0, Math.min(4, stage));
    const pose = actionPose(asset, st, action);

    loadSvgSource(pose.source).then((source) => {
      if (cancelled) return;
      let svg;
      try {
        svg = svgNode(source);          // 인스턴스마다 id 에 접두사를 붙여준다
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
        svg.setAttribute('x', x);
        svg.setAttribute('y', y);
        svg.style.width = ''; svg.style.height = '';   // 씬 좌표계에서는 속성으로만
        svg.setAttribute('width', size);
        svg.setAttribute('height', size * 0.95);
        svg.style.overflow = 'visible';
      }
      svg.dataset.stage = String(st);
      growth(svg, asset, st);
      host.replaceChildren(svg);
      setErr(null);

      // 저감 모션이면 한 프레임만 그리고 멈춘다
      if (reduced) { animateAction(svg, asset, action, 0, true); return; }

      const start = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const t = (now - start) / 1000;
        try { animateAction(svg, asset, action, t, false); } catch { /* 한 프레임 실패는 무시 */ }
        // 한 번만 재생하는 동작
        if (onDone && ONE_SHOT.has(action) && t > 1.9) { onDone(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => { if (!cancelled) setErr('그림을 불러오지 못했어요'); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
    // onDone 은 의도적으로 뺀다 — 부모가 매 렌더 새 함수를 주면 애니메이션이 끊긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, stage, action, size, embedded, x, y]);

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

const ONE_SHOT = new Set(['celebrate', 'wave', 'stretch', 'wake']);
