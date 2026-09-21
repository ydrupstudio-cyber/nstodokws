'use client';

// ============================================================
// 출석 달력 — 하루에 도장 하나
//
// 도장은 4구간(아침/오전/점심/오후)을 네 조각 링으로 그린다.
// 네 조각을 다 채운 날은 가운데가 꽉 찬 '완주 도장'이 된다.
//
// 데이터는 point_ledger 한 곳에서만 온다. 출석부 테이블을 따로 두지 않았다 —
// 원장이 곧 출석부이고, 그래야 신고로 무효 처리된 건이 달력에서도 같이 빠진다.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { loadAttendMonth, todayKST, SLOT_LABELS } from '../lib/game';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 하루 도장.
 *
 * ⚠ 읽는 순서가 중요하다. 연속 출석은 '그날 왔느냐'로만 정해지고 구간 수와 무관하다.
 *   그래서 **한 번이라도 왔으면 가운데가 꽉 찬다** — 이게 1순위 신호다.
 *   바깥 네 조각은 '얼마나 자주 들렀나'를 덧붙이는 2순위 정보일 뿐이다.
 *   (예전엔 한 구간만 찍은 날이 빈 링처럼 보여서 결석으로 오해됐다)
 */
function Stamp({ filled, size = 30, muted }) {
  const n = filled.length;
  const came = n > 0;
  const full = n >= 4;
  const r = size / 2 - 2.6;
  const c = size / 2;
  const arc = (i) => {
    const a0 = (-90 + i * 90 + 4) * Math.PI / 180;
    const a1 = (-90 + (i + 1) * 90 - 4) * Math.PI / 180;
    return `M ${(c + r * Math.cos(a0)).toFixed(2)} ${(c + r * Math.sin(a0)).toFixed(2)}
            A ${r} ${r} 0 0 1 ${(c + r * Math.cos(a1)).toFixed(2)} ${(c + r * Math.sin(a1)).toFixed(2)}`;
  };
  const on = muted ? 'var(--text-3)' : 'var(--text-2)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={arc(i)} fill="none" strokeLinecap="round" strokeWidth={2.6}
              stroke={filled.includes(i + 1) ? on : 'var(--border)'} />
      ))}
      {/* 채움 정도는 반드시 단조 증가해야 한다.
          완주한 날에 구멍을 뚫었더니 한 번만 온 날보다 덜 채워져 보였다 */}
      {came && <circle cx={c} cy={c} r={r * (full ? 0.58 : 0.40)} fill={on} />}
    </svg>
  );
}

export default function AttendCalendar({ memberId }) {
  const today = todayKST();
  const [y, setY] = useState(() => Number(today.slice(0, 4)));
  const [m, setM] = useState(() => Number(today.slice(5, 7)) - 1);  // 0-indexed
  const [days, setDays] = useState({});
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    loadAttendMonth(memberId, y, m).then((d) => { if (!dead) { setDays(d); setLoading(false); } });
    return () => { dead = true; };
  }, [memberId, y, m]);

  const cells = useMemo(() => {
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= last; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ d, key, slots: days[key] || [] });
    }
    return out;
  }, [y, m, days]);

  const stats = useMemo(() => {
    const vals = Object.values(days);
    return { attended: vals.length, full: vals.filter((v) => v.length >= 4).length };
  }, [days]);

  const move = (delta) => {
    const nm = m + delta;
    if (nm < 0) { setY(y - 1); setM(11); }
    else if (nm > 11) { setY(y + 1); setM(0); }
    else setM(nm);
    setSel(null);
  };
  const isFuture = `${y}-${String(m + 1).padStart(2, '0')}` >= today.slice(0, 7);

  return (
    <div>
      <div style={s.head}>
        <button onClick={() => move(-1)} style={s.nav} aria-label="이전 달">‹</button>
        <span style={s.month}>{y}년 {m + 1}월</span>
        <button onClick={() => move(1)} style={{ ...s.nav, opacity: isFuture ? 0.3 : 1 }}
                disabled={isFuture} aria-label="다음 달">›</button>
      </div>

      <div style={s.dow}>{DOW.map((d, i) => (
        <span key={d} style={{ ...s.dowCell, color: i === 0 ? '#b4553f' : 'var(--text-3)' }}>{d}</span>
      ))}</div>

      <div style={{ ...s.grid, opacity: loading ? 0.4 : 1 }}>
        {cells.map((c, i) => {
          if (c === null) return <span key={'x' + i} />;
          // 좌우 이웃도 출석했으면 선으로 잇는다. 연속이 눈에 보이게 하는 장치다.
          // 줄이 바뀌는 칸(일요일·토요일)에서는 잇지 않는다
          const prev = cells[i - 1], next = cells[i + 1];
          const linkL = i % 7 !== 0 && c.slots.length > 0 && prev && prev.slots?.length > 0;
          const linkR = i % 7 !== 6 && c.slots.length > 0 && next && next.slots?.length > 0;
          return (
            <button key={c.key} onClick={() => setSel(sel === c.key ? null : c.key)}
              style={{ ...s.cell, ...(c.key === today ? s.cellToday : {}),
                       ...(sel === c.key ? s.cellSel : {}) }}>
              {linkL && <span style={{ ...s.link, left: -3, right: '50%' }} />}
              {linkR && <span style={{ ...s.link, left: '50%', right: -3 }} />}
              <Stamp filled={c.slots} muted={c.key > today} />
              <span style={{ ...s.num, ...(c.slots.length ? s.numOn : {}) }}>{c.d}</span>
            </button>
          );
        })}
      </div>

      <div style={s.summary}>
        출석 <b>{stats.attended}일</b> · 네 구간 완주 <b>{stats.full}일</b>
        <div style={s.legend}>하루 한 번만 들러도 연속은 이어집니다</div>
      </div>

      {sel && (
        <div style={s.detail}>
          <b>{Number(sel.slice(8))}일</b>{' '}
          {(days[sel] || []).length === 0 ? '— 출석 기록이 없어요'
            : (days[sel] || []).map((n) => SLOT_LABELS[n].split(' ')[0]).join(' · ') +
              ((days[sel] || []).length >= 4 ? ' — 완주!' : '')}
        </div>
      )}
    </div>
  );
}

const s = {
  head: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 },
  nav: { width: 34, height: 34, fontSize: 20, color: 'var(--text-2)', borderRadius: 8, background: 'none', border: 'none' },
  month: { fontSize: 14, fontWeight: 600, minWidth: 92, textAlign: 'center' },
  dow: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 },
  dowCell: { textAlign: 'center', fontSize: 11 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, transition: 'opacity .2s' },
  cell: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          padding: '4px 0 3px', border: '1px solid transparent', borderRadius: 9,
          background: 'none', cursor: 'pointer' },
  // 도장 뒤에 깔리는 연속 표시선. 도장 한가운데 높이에 맞춘다
  link: { position: 'absolute', top: 18, height: 3, background: 'var(--border-strong)',
          borderRadius: 2, zIndex: 0 },
  cellToday: { borderColor: 'var(--text-3)' },
  cellSel: { background: 'var(--surface-2)' },
  num: { fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' },
  numOn: { color: 'var(--text-2)', fontWeight: 600 },
  summary: { textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 10 },
  legend: { fontSize: 11, color: 'var(--text-3)', marginTop: 3, opacity: .85 },
  detail: { marginTop: 8, padding: '9px 11px', borderRadius: 9, background: 'var(--surface-2)',
            fontSize: 12, color: 'var(--text-2)', textAlign: 'center' },
};
