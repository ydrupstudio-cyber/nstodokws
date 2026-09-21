'use client';

// ============================================================
// UI 아이콘
//
// 2.5차 킷의 아이콘은 fill 이 파일 안에 박혀 있다(#443C4E).
// <img src> 로 넣으면 그 색으로 고정돼 다크 모드에서 배경에 묻힌다.
// 그래서 인라인으로 넣고 칠하는 노드를 currentColor 로 바꾼다 —
// 킷이 준 paint-ui-icon.js 와 같은 일을, 색 대신 CSS 에 맡기는 방식이다.
// 이렇게 하면 부모의 color 만 바꿔도 따라온다.
// ============================================================
import { useEffect, useRef, useState } from 'react';

const BASE = '/game/ui/';
const cache = new Map();   // name -> Promise<SVGElement 원본>

function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name + '.svg')
      .then((r) => { if (!r.ok) throw new Error(name + ' ' + r.status); return r.text(); })
      .then((txt) => {
        const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
        const svg = doc.documentElement;
        if (svg.nodeName !== 'svg') throw new Error('아이콘이 아니다');
        svg.querySelectorAll('[data-fill-slot]').forEach((n) => n.setAttribute('fill', 'currentColor'));
        return svg;
      })
      .catch((e) => { cache.delete(name); throw e; }));
  }
  return cache.get(name);
}

export default function UiIcon({ name, size = 20, style }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    setFailed(false);
    load(name).then((proto) => {
      if (dead || !ref.current) return;
      const svg = proto.cloneNode(true);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('aria-hidden', 'true');
      svg.style.display = 'block';
      ref.current.replaceChildren(svg);
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, [name, size]);

  // 아이콘 하나 못 불러왔다고 버튼이 사라지면 안 된다. 자리만 지킨다
  return <span ref={ref} aria-hidden="true"
    style={{ display: 'inline-block', width: size, height: size, flexShrink: 0,
             ...(failed ? { opacity: 0 } : null), ...style }} />;
}
