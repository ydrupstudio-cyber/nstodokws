'use client';

// ============================================================
// 미니룸 — 펫이 살아 있는 방
//
// 격자·충돌·경로는 lib/pet/room-engine.js (킷 원본) 이 전부 계산한다.
// 이 컴포넌트는 그 결과를 SVG 로 그리고, 시간을 흘려보내고, 저장을 붙인다.
//
// 정적 에셋(가구·바닥·벽지)은 <image href> 로 그린다. 브라우저가 알아서
// 캐시하고, 수십 개를 인라인하면 DOM 이 무거워진다. 펫만 인라인하는 이유는
// 부위별로 움직여야 하기 때문이다.
// ============================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PetCanvas from './PetCanvas';
import ShopView from './ShopView';
import { loadManifest, findAsset } from '../lib/pet/assets';
import {
  project, unproject, placement, blocked, route, approach, dimensions,
} from '../lib/pet/room-engine';
import {
  buildCatalog, viewBoxFor, floorCorners, wallShapes, furniturePos,
  depthSorted, petPos, randomFreeCell, INTERACTION_ACTION, ASSET_BASE,
} from '../lib/pet/room';
import { supabase } from '../lib/supabase';

const WALK_SPEED = 1.05;      // 초당 칸. 아기는 느리다
const BABY_SPEED = 0.75;
const MAX_DELTA = 0.06;       // 탭이 멈췄다 돌아와도 순간이동하지 않게

export default function RoomView({ currentMember, profile, onClose }) {
  const [manifest, setManifest] = useState(null);
  const [room, setRoom] = useState(null);
  const [asset, setAsset] = useState(null);
  const [err, setErr] = useState(null);

  // 펫 상태
  const [petCell, setPetCell] = useState({ x: 3.5, y: 3.5 });
  const [action, setAction] = useState('idle');
  const [facing, setFacing] = useState(1);

  // 편집
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);   // uid
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [inv, setInv] = useState({});        // asset_id -> 보유 수량
  const [balance, setBalance] = useState(profile?.balance || 0);

  const svgRef = useRef(null);
  const petRef = useRef({ pos: { x: 3.5, y: 3.5 }, path: [], hold: 1.2, action: 'idle' });
  const rafRef = useRef(0);

  const catalog = useMemo(() => (manifest ? buildCatalog(manifest) : null), [manifest]);
  const level = room ? (manifest?.roomLevels?.[room.level] || { size: 8 }) : { size: 8 };
  const size = level.size;

  // ── 불러오기 ──
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const m = await loadManifest();
        if (dead) return;
        setManifest(m);
        const { data } = await supabase.from('pet_rooms').select('*')
          .eq('member_id', currentMember.id).maybeSingle();
        if (dead) return;
        setRoom(data || {
          member_id: currentMember.id, level: 0, wallpaper: 'plain', floor: 'wood',
          owned_wallpapers: ['plain'], items: [], revision: 0,
        });
        if (profile?.breed) setAsset(await findAsset(profile.species, profile.breed));
      } catch (e) { if (!dead) setErr('방을 불러오지 못했어요'); }
    })();
    return () => { dead = true; };
  }, [currentMember.id, profile?.breed, profile?.species]);

  const reloadOwned = useCallback(async () => {
    const [{ data: i }, { data: g }] = await Promise.all([
      supabase.from('pet_inventory').select('asset_id, qty').eq('member_id', currentMember.id),
      supabase.from('game_profiles').select('balance').eq('member_id', currentMember.id).maybeSingle(),
    ]);
    const map = {}; (i || []).forEach((r) => { map[r.asset_id] = r.qty; });
    setInv(map);
    if (g) setBalance(g.balance || 0);
  }, [currentMember.id]);

  useEffect(() => { reloadOwned(); }, [reloadOwned]);

  const items = room?.items || [];

  // 보관함에 있지만 아직 방에 안 놓은 것
  const spare = useMemo(() => {
    const placed = {};
    items.forEach((it) => { placed[it.assetId] = (placed[it.assetId] || 0) + 1; });
    return Object.entries(inv)
      .map(([id, qty]) => ({ id, left: qty - (placed[id] || 0) }))
      .filter((x) => x.left > 0);
  }, [inv, items]);
  const stage = profile ? stageOf(profile.total_earned || 0, profile.affection || 0) : 3;
  const petScale = stage === 0 ? 0.62 : 0.72;

  // ── 자율 행동: 걷다가 가구 옆에서 뭔가 한다 ──
  const pickNext = useCallback(() => {
    if (!catalog || !room) return;
    const st = petRef.current;
    const wall = blocked(items, size, catalog);
    const interactive = items.filter((it) => catalog[it.assetId]?.interaction);
    // 절반은 가구 상호작용, 절반은 그냥 산책
    const goFurniture = interactive.length > 0 && Math.random() < 0.55;
    if (goFurniture) {
      const target = interactive[Math.floor(Math.random() * interactive.length)];
      const res = approach(st.pos, target, items, size, catalog);
      if (res) {
        st.path = res.path;
        st.after = INTERACTION_ACTION[catalog[target.assetId].interaction] || 'inspect';
        st.hold = 0;
        return;
      }
    }
    const cell = randomFreeCell(size, wall);
    if (!cell) { st.hold = 2; return; }
    st.path = route(st.pos, cell, items, size, catalog);
    st.after = ['wave', 'stretch', 'look', 'sit', 'idle'][Math.floor(Math.random() * 5)];
    st.hold = st.path.length ? 0 : 1.6;
  }, [catalog, room, items, size]);

  // ── 시간 루프 ──
  useEffect(() => {
    if (!catalog || !room) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || editing) { setAction('idle'); return; }

    let last = performance.now();
    const speed = stage === 0 ? BABY_SPEED : WALK_SPEED;

    const tick = (now) => {
      // 탭이 숨겨진 동안은 시간이 흐르지 않는다 (켜두기만 해도 진행되면 안 된다)
      const dt = Math.min(MAX_DELTA, (now - last) / 1000);
      last = now;
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }

      const st = petRef.current;
      if (st.path.length) {
        const goal = st.path[0];
        const dx = goal.x - st.pos.x, dy = goal.y - st.pos.y;
        const dist = Math.hypot(dx, dy);
        const step = speed * dt;
        if (dist <= step) { st.pos = { ...goal }; st.path.shift(); }
        else { st.pos = { x: st.pos.x + (dx / dist) * step, y: st.pos.y + (dy / dist) * step }; }
        if (Math.abs(dx) > 0.01) setFacing(dx > 0 ? 1 : -1);
        if (st.action !== 'walk') { st.action = 'walk'; setAction('walk'); }
        setPetCell({ ...st.pos });
        if (!st.path.length) { st.action = st.after || 'idle'; setAction(st.action); st.hold = 2.4 + Math.random() * 2.4; }
      } else {
        st.hold -= dt;
        if (st.hold <= 0) {
          if (st.action !== 'idle') { st.action = 'idle'; setAction('idle'); st.hold = 1.2 + Math.random() * 2.2; }
          else pickNext();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [catalog, room, editing, stage, pickNext]);

  // ── 편집: 빈 칸을 누르면 선택한 가구를 옮긴다 ──
  function svgPoint(evt) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    const src = evt.touches?.[0] || evt;
    pt.x = src.clientX; pt.y = src.clientY;
    // CSS 픽셀을 그대로 격자로 쓰면 창 크기·모바일에서 어긋난다
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    const g = unproject(local.x, local.y, size);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
  }

  function onSurface(evt) {
    if (!editing || !selected) return;
    const cell = svgPoint(evt);
    if (!cell) return;
    moveTo(selected, cell.x, cell.y);
  }

  function moveTo(uid, x, y) {
    const next = items.map((it) => (it.uid === uid ? { ...it, x, y } : it));
    const moved = next.find((it) => it.uid === uid);
    const res = placement(moved, next.filter((i) => i.uid !== uid), size, catalog);
    if (!res.ok) { setMsg(res.reason); return; }
    setRoom((r) => ({ ...r, items: next })); setDirty(true); setMsg(null);
  }

  /** 보관함에서 꺼내 빈 자리에 놓는다. 자리를 못 찾으면 알려준다 */
  function placeFromInventory(assetId) {
    const a = catalog[assetId];
    if (!a) return;
    const uid = `${assetId}-${Date.now().toString(36)}`;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const cand = { uid, assetId, x, y, rotation: 0 };
      if (placement(cand, items, size, catalog).ok) {
        setRoom((r) => ({ ...r, items: [...items, cand] }));
        setSelected(uid); setDirty(true); setMsg(`${a.name} 을(를) 꺼냈어요`);
        return;
      }
    }
    setMsg('놓을 자리가 없어요');
  }

  /** 방에서 빼서 보관함으로 되돌린다 (삭제가 아니라 치우기다) */
  function storeItem(uid) {
    const it = items.find((i) => i.uid === uid);
    if (!it) return;
    setRoom((r) => ({ ...r, items: items.filter((i) => i.uid !== uid) }));
    setSelected(null); setDirty(true);
    setMsg(`${catalog[it.assetId]?.name || '가구'} 을(를) 보관함에 넣었어요`);
  }

  function rotate(uid) {
    const it = items.find((i) => i.uid === uid);
    if (!it) return;
    const cand = { ...it, rotation: ((it.rotation || 0) + 1) % 4 };
    const res = placement(cand, items.filter((i) => i.uid !== uid), size, catalog);
    if (!res.ok) { setMsg(res.reason); return; }
    setRoom((r) => ({ ...r, items: items.map((i) => (i.uid === uid ? cand : i)) }));
    setDirty(true); setMsg(null);
  }

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.rpc('game_save_room', {
      p_member: currentMember.id, p_items: items, p_revision: room.revision,
      p_wallpaper: null, p_floor: null,
    });
    setSaving(false);
    if (error) { setMsg('저장하지 못했어요'); return; }
    if (!data?.ok) {
      setMsg(data?.reason || '저장하지 못했어요');
      if (data?.room) setRoom(data.room);   // 서버 최신본으로 되돌린다
      return;
    }
    setRoom((r) => ({ ...r, revision: data.revision }));
    setDirty(false); setMsg('저장했어요');
  }

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2800); return () => clearTimeout(t); }, [msg]);

  if (err) return <Shell onClose={onClose}><div style={st.empty}>{err}</div></Shell>;
  if (!manifest || !room) return <Shell onClose={onClose}><div style={st.empty}>불러오는 중…</div></Shell>;
  if (!profile?.species) return <Shell onClose={onClose}><div style={st.empty}>먼저 펫을 데려오세요</div></Shell>;

  const wallH = 96;
  const vb = viewBoxFor(size, wallH);
  const walls = wallShapes(size, wallH);
  const corners = floorCorners(size);
  const coll = manifest.wallpaperCollections.find((c) => c.id === room.wallpaper);
  const baseCol = coll?.base || 'var(--surface-2)';
  const sideCol = coll?.side || 'var(--surface-3)';
  const floorAsset = catalog['floor-' + room.floor];
  const order = depthSorted(items, catalog, petCell);
  const pp = petPos(petCell, size, petScale);

  const tiles = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    const p = project(x + 0.5, y + 0.5, size);
    tiles.push(<image key={`t${x}-${y}`} href={ASSET_BASE + (floorAsset?.path || '')}
      x={p.x - 32} y={p.y - 16} width={64} height={32} />);
  }

  return (
    <Shell onClose={onClose} title={level.name}>
      <div style={st.stageWrap}>
        <svg ref={svgRef} viewBox={vb.join(' ')} style={st.svg}
             onClick={onSurface} role="img" aria-label="펫의 방">
          {/* 벽 */}
          <polygon points={walls.left} fill={sideCol} />
          <polygon points={walls.right} fill={baseCol} />
          {coll && (
            <>
              <defs>
                <pattern id="wp" width="60" height="30" patternUnits="userSpaceOnUse">
                  <image href={ASSET_BASE + coll.patternSource} width="60" height="30" />
                </pattern>
              </defs>
              <polygon points={walls.left} fill="url(#wp)" opacity=".5" />
              <polygon points={walls.right} fill="url(#wp)" opacity=".5" />
            </>
          )}
          {/* 바닥 */}
          <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill="var(--surface-2)" />
          {tiles}

          {/* 편집 중 선택된 가구가 놓일 자리 안내 */}
          {editing && selected && (() => {
            const it = items.find((i) => i.uid === selected);
            if (!it) return null;
            const [w, h] = dimensions(it, catalog);
            const c = [project(it.x, it.y, size), project(it.x + w, it.y, size),
                       project(it.x + w, it.y + h, size), project(it.x, it.y + h, size)];
            return <polygon points={c.map((p) => `${p.x},${p.y}`).join(' ')}
                            fill="none" stroke="var(--text)" strokeWidth="2" strokeDasharray="5 3" />;
          })()}

          {/* 가구와 펫 — 깊이 순 */}
          {order.map((o, i) => {
            if (o.kind === 'pet') {
              // foreignObject 가 아니라 중첩 <svg> 로 넣는다. 브라우저 호환과
              // 좌표 처리가 훨씬 단순하고, 실제로 그려보고 확인한 방식이다
              const w = 200 * petScale;
              return (
                <g key="pet" transform={facing < 0
                    ? `translate(${(pp.x * 2 + w).toFixed(2)} 0) scale(-1 1)` : undefined}>
                  {asset && <PetCanvas asset={asset} stage={stage} action={action}
                                       size={w} embedded x={pp.x} y={pp.y} />}
                </g>
              );
            }
            const it = o.item;
            const a = catalog[it.assetId];
            const pos = furniturePos(it, catalog, size);
            const src = a.rotations?.[it.rotation || 0]?.source || a.path;
            return (
              <image key={it.uid + i} href={ASSET_BASE + src}
                x={pos.x} y={pos.y} width={256} height={224}
                style={{ cursor: editing ? 'pointer' : 'default',
                         opacity: editing && selected && selected !== it.uid ? 0.55 : 1 }}
                onClick={(e) => { if (!editing) return; e.stopPropagation(); setSelected(it.uid); setMsg(a.name); }} />
            );
          })}
        </svg>

        {msg && <div style={st.toast}>{msg}</div>}
      </div>

      {/* 조작 */}
      <div style={st.bar}>
        {!editing ? (
          <>
            <button onClick={() => { setEditing(true); setAction('idle'); }} style={st.primary}>가구 배치</button>
            <button onClick={() => setShopOpen(true)} style={st.btn}>상점</button>
            <span style={st.barHint}>{(balance || 0).toLocaleString()}점</span>
          </>
        ) : (
          <>
            <button onClick={() => rotate(selected)} disabled={!selected} style={st.btn}>돌리기</button>
            <button onClick={() => storeItem(selected)} disabled={!selected} style={st.btn}>치우기</button>
            <button onClick={save} disabled={!dirty || saving} style={st.primary}>
              {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
            </button>
            <button onClick={() => { setEditing(false); setSelected(null); }} style={st.btn}>완료</button>
          </>
        )}
      </div>
      {editing && (
        <>
          {spare.length > 0 && (
            <div style={st.invWrap}>
              <div style={st.invHead}>보관함</div>
              <div style={st.invStrip}>
                {spare.map(({ id, left }) => (
                  <button key={id} onClick={() => placeFromInventory(id)} style={st.invItem}>
                    <img src={ASSET_BASE + catalog[id].path} alt="" style={st.invImg} />
                    <span style={st.invName}>{catalog[id].name}</span>
                    {left > 1 && <span style={st.invQty}>{left}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p style={st.hint}>
            가구를 누르면 선택되고, 빈 칸을 누르면 그 자리로 옮깁니다.
            벽 밖이나 다른 가구와 겹치는 자리는 거절돼요.
            <b> 치우기</b>는 없애는 게 아니라 보관함에 넣는 것입니다.
          </p>
        </>
      )}

      {shopOpen && (
        <ShopView currentMember={currentMember} manifest={manifest} room={room} balance={balance}
          onDone={async () => {
            await reloadOwned();
            const { data } = await supabase.from('pet_rooms').select('*')
              .eq('member_id', currentMember.id).maybeSingle();
            if (data) setRoom(data);
          }}
          onClose={() => setShopOpen(false)} />
      )}
    </Shell>
  );
}

function stageOf(total, affection) {
  if (total >= 20000 && affection >= 2500) return 4;
  if (total >= 20000) return 3;
  if (total >= 8000) return 2;
  if (total >= 2000) return 1;
  return 0;
}

function Shell({ children, onClose, title }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={st.header}>
          <h2 style={st.title}>🏠 {title || '내 방'}</h2>
          <button onClick={onClose} style={st.close}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const st = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  empty: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  stageWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' },
  svg: { display: 'block', width: '100%', height: 'auto', touchAction: 'manipulation' },
  toast: { position: 'absolute', left: 10, bottom: 10, padding: '7px 11px', borderRadius: 18,
           background: 'var(--text)', color: 'var(--bg)', fontSize: 12, maxWidth: 'calc(100% - 20px)' },
  bar: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 },
  primary: { padding: '11px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'var(--text)', color: 'var(--bg)' },
  btn: { padding: '11px 14px', borderRadius: 10, fontSize: 14, border: '1px solid var(--border)', color: 'var(--text-2)' },
  barHint: { fontSize: 12, color: 'var(--text-3)' },
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 10 },
  invWrap: { marginTop: 12 },
  invHead: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 },
  invStrip: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 },
  invItem: { position: 'relative', flexShrink: 0, width: 70, padding: '4px 2px 5px',
             border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)' },
  invImg: { width: 60, height: 50, objectFit: 'contain', display: 'block', margin: '0 auto' },
  invName: { display: 'block', fontSize: 10, color: 'var(--text-2)', overflow: 'hidden',
             textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  invQty: { position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 700,
            background: 'var(--text)', color: 'var(--bg)', borderRadius: 9, padding: '0 5px' },
};
