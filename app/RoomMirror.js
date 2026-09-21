'use client';

// ============================================================
// 방 화면을 캔버스로 한 번 더 그린다
//
// 왜 이런 걸 하나 —
//   삼성 인터넷의 '웹페이지 어둡게' 는 페이지가 뭐라고 선언하든 색을 깎는다.
//   같은 색 #E4BB88 을 다섯 가지 방법으로 그려 폰에서 재 봤더니
//     CSS 배경 · 인라인 SVG · <image href> · <img>  → (100,59,8) 으로 깎임
//     <canvas>                                    → 그대로
//   캔버스 픽셀만 손대지 않는다. 그래서 방을 캔버스에 옮겨 그린다.
//
// 어떻게 —
//   SVG 는 지금까지 쓰던 그대로 둔다 (그리기·좌표·클릭 판정 전부 그 위에서).
//   보이지 않게만 해 두고, 그 내용을 캔버스에 구워서 대신 보여준다.
//   그래서 방 그리는 코드는 한 줄도 다시 안 썼다.
//
//   배경(벽·바닥·가구)은 잘 안 바뀌니 한 번 구워서 들고 있고,
//   펫과 표시(목적지·감정)만 매 프레임 굽는다.
//   실측: 전체 25.8ms · 펫만 4.2ms — 그래서 나눴다.
//
//   data: URI 로 만든 SVG 안에서는 바깥 파일을 못 불러온다. 그래서 가구·바닥
//   그림은 미리 받아 두었다가 구울 때 안에 박아 넣는다.
// ============================================================
import { useEffect, useRef } from 'react';

/** 바깥 파일을 받아 data URI 로 바꿔 둔다. 같은 파일은 다시 받지 않는다 */
const sourceCache = new Map();

async function dataUriFor(href) {
  const had = sourceCache.get(href);
  if (had !== undefined) return had;          // 문자열이면 그대로, 약속이면 그 약속
  // ⚠ 시간을 끊어야 한다. 한 파일이 안 돌아오면 그리기 루프 전체가 멈춘다
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  const p = fetch(href, { signal: stop.signal })
    .finally(() => clearTimeout(timer))
    .then((r) => (r.ok ? r.text() : null))
    .then((t) => {
      // 받아지면 약속 자리에 결과를 박아 둔다. 실패하면 null 로 남겨
      // 다시 받으러 가지 않는다 (없는 파일에 매 프레임 요청하면 안 된다)
      const uri = t ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t) : null;
      sourceCache.set(href, uri);
      return uri;
    })
    .catch(() => { sourceCache.set(href, null); return null; });
  sourceCache.set(href, p);
  return p;
}

function externalRefs(root) {
  const out = new Set();
  root.querySelectorAll('image').forEach((n) => {
    const h = n.getAttribute('href') || n.getAttribute('xlink:href');
    if (h && !h.startsWith('data:')) out.add(h);
  });
  return [...out];
}

/** 복제본의 바깥 참조를 미리 받아 둔 data URI 로 바꾼다 */
function inlineRefs(clone) {
  clone.querySelectorAll('image').forEach((n) => {
    const h = n.getAttribute('href') || n.getAttribute('xlink:href');
    if (!h || h.startsWith('data:')) return;
    const v = sourceCache.get(h);
    if (typeof v === 'string') n.setAttribute('href', v);
  });
}

const serializer = typeof window === 'undefined' ? null : new XMLSerializer();

/** SVG 조각 하나를 그림으로 굽는다 */
function bake(node, width, height) {
  const clone = node.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  // ⚠ 원본 SVG 는 눈에 안 보이게 opacity:0 을 달고 있다. 복제본이 그걸
  // 그대로 물고 가면 투명한 그림이 구워진다 (실제로 그랬다). 떼어낸다
  clone.removeAttribute('style');
  clone.removeAttribute('opacity');
  inlineRefs(clone);
  const src = 'data:image/svg+xml;charset=utf-8,'
    + encodeURIComponent(serializer.serializeToString(clone));
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    // 아주 큰 data URI 는 onload·onerror 가 둘 다 안 오는 일이 있다.
    // 한 판을 영영 붙잡고 있지 않도록 시간을 끊는다
    setTimeout(() => finish(null), 3000);
    img.src = src;
  });
}

/**
 * SVG 를 캔버스로 비춘다.
 *
 * @param svgRef     방 SVG
 * @param canvasRef  덮어씌울 캔버스
 * @param bgKey      배경이 바뀌었는지 알려주는 문자열. 바뀔 때만 배경을 다시 굽는다
 * @param enabled    끄면 아무 것도 안 한다 (SVG 를 그대로 보여준다)
 */
export function useCanvasMirror(svgRef, canvasRef, bgKey, enabled = true) {
  const state = useRef({ bg: null, key: null, busy: false, last: 0 });

  useEffect(() => { state.current.key = null; }, [bgKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let raf = 0;

    // 초당 60번까지 구울 필요는 없다. 30번이면 눈에 같고 일은 절반이다.
    // 배터리로 도는 폰에서 쓰는 화면이라 이 정도는 챙긴다.
    const MIN_GAP = 33;

    const draw = async (now) => {
      const svg = svgRef.current, cv = canvasRef.current;
      if (!alive || !svg || !cv) { raf = requestAnimationFrame(draw); return; }
      const st = state.current;
      // 다른 탭을 보고 있으면 굽지 않는다
      if (st.busy || document.hidden || (now - st.last) < MIN_GAP) {
        raf = requestAnimationFrame(draw); return;
      }
      st.last = now;
      st.busy = true;
      try {
        const box = svg.getBoundingClientRect();
        if (box.width < 2) return;
        // 화면 배율만큼 크게 잡아야 글자·선이 깨지지 않는다. 2배면 충분하다
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
        if (cv.width !== w || cv.height !== h) {
          cv.width = w; cv.height = h; st.key = null;
        }
        const g = cv.getContext('2d');

        // 처음 한 번: 바깥 그림을 다 받아 둔다
        const refs = externalRefs(svg).filter((h2) => !sourceCache.has(h2));
        if (refs.length) await Promise.all(refs.map(dataUriFor));
        // 아직 안 받아진 게 있으면 이번 판은 건너뛴다 (반쯤 빠진 그림을 보이지 않게)
        const pending = externalRefs(svg).some((h2) => {
          const v = sourceCache.get(h2);
          return v !== null && typeof v !== 'string';     // 아직 받는 중
        });

        if (!alive) return;

        if (!pending && st.key !== bgKey) {
          // 배경 = 펫과 표시를 뺀 나머지. 한 번 구워서 들고 있는다
          const clone = svg.cloneNode(true);
          clone.querySelectorAll('[data-live]').forEach((n) => n.remove());
          st.bg = await bake(clone, w, h);
          st.key = bgKey;
        }

        // 펫·표시만 따로 굽는다 — 매 프레임 바뀌는 건 이것뿐이다
        let liveImg = null;
        const live = svg.querySelectorAll('[data-live]');
        if (live.length) {
          const layer = svg.cloneNode(false);
          layer.setAttribute('viewBox', svg.getAttribute('viewBox') || '');
          live.forEach((n) => layer.appendChild(n.cloneNode(true)));
          liveImg = await bake(layer, w, h);
        }

        // ⚠ 굽기를 다 끝낸 뒤에 한 번에 그린다. 배경을 먼저 그려 놓고 펫을
        // 구우면, 굽는 4ms 동안 펫 없는 방이 보인다 (실제로 펫이 안 보였다)
        if (!alive) return;
        g.clearRect(0, 0, w, h);
        if (st.bg) g.drawImage(st.bg, 0, 0, w, h);
        if (liveImg) g.drawImage(liveImg, 0, 0, w, h);
      } catch { /* 한 판 실패해도 다음 판에 다시 그린다 */ } finally {
        // ⚠ 반드시 finally 에서 푼다. 중간에 빠져나가면서 걸어 둔 채로 두면
        // 다음 판부터 영영 아무것도 안 그린다 (실제로 그렇게 멈췄다)
        st.busy = false;
      }
      if (alive) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [svgRef, canvasRef, bgKey, enabled]);
}
