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

/** 네 조각 링. filled 에 든 구간(1~4)만 칠한다 */
function Stamp({ filled, size = 30, muted }) {
  const n = filled.length;
  const full = n >= 4;
  const r = size / 2 - 2.6;
  const c = size / 2;
  // 12시 방향부터 시계방향으로 네 조각
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
        <path key={i} d={arc(i)} fill="none" strokeLinecap="round" strokeWidth={3}
              stroke={filled.includes(i + 1) ? on : 'var(--border)'} />
      ))}
      {full && <circle cx={c} cy={c} r={r * 0.46} fill={on} />}
      {!full && n > 0 && <circle cx={c} cy={c} r={r * 0.2} fill={on} opacity={0.45} />}
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
        {cells.map((c, i) => c === null ? <span key={'x' + i} /> : (
          <button key={c.key} onClick={() => setSel(sel === c.key ? null : c.key)}
            style={{ ...s.cell, ...(c.key === today ? s.cellToday : {}),
                     ...(sel === c.key ? s.cellSel : {}) }}>
            <Stamp filled={c.slots} muted={c.key > today} />
            <span style={{ ...s.num, ...(c.slots.length ? s.numOn : {}) }}>{c.d}</span>
          </button>
        ))}
      </div>

      <div style={s.summary}>
        출석 <b>{stats.attended}일</b> · 네 구간 완주 <b>{stats.full}일</b>
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
  cell: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          padding: '4px 0 3px', border: '1px solid transparent', borderRadius: 9,
          background: 'none', cursor: 'pointer' },
  cellToday: { borderColor: 'var(--text-3)' },
  cellSel: { background: 'var(--surface-2)' },
  num: { fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' },
  numOn: { color: 'var(--text-2)', fontWeight: 600 },
  summary: { textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 10 },
  detail: { marginTop: 8, padding: '9px 11px', borderRadius: 9, background: 'var(--surface-2)',
            fontSize: 12, color: 'var(--text-2)', textAlign: 'center' },
};
