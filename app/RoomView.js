'use client';

// ============================================================
// 미니룸 — 펫이 살아 있는 방
//
// 이 컴포넌트는 '방 화면 그 자체'다. 모달 껍데기를 두르지 않는다.
// 껍데기(HUD·하단 바·패널)는 PetView 가 씌운다.
//
// 격자·충돌·경로는 lib/pet/room-engine.js (킷 원본) 이 전부 계산한다.
// 여기서는 그 결과를 SVG 로 그리고, 시간을 흘려보내고, 저장을 붙인다.
//
// 정적 에셋(가구·바닥·벽지)은 <image href> 로 그린다. 브라우저가 알아서
// 캐시하고, 수십 개를 인라인하면 DOM 이 무거워진다. 펫만 인라인하는 이유는
// 부위별로 움직여야 하기 때문이다.
// ============================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PetCanvas from './PetCanvas';
import { loadManifest, findAsset } from '../lib/pet/assets';
import {
  project, unproject, placement, blocked, route, approach, dimensions,
} from '../lib/pet/room-engine';
import {
  buildCatalog, viewBoxFor, floorCorners, wallShapes, furniturePos,
  depthSorted, petPos, randomFreeCell, INTERACTION_ACTION, ASSET_BASE,
} from '../lib/pet/room';
import { supabase } from '../lib/supabase';
import { stageOf, josa } from '../lib/game';

const MAX_DELTA = 0.06;       // 탭이 멈췄다 돌아와도 순간이동하지 않게

/**
 * 친밀도가 쌓일수록 활발해진다.
 * 서먹한 사이에는 구석에서 잘 안 움직이고, 가족이 되면 방을 돌아다닌다.
 * 이 값들은 '느낌' 이라 정답이 없다 — 실제로 보고 조정한 값이다.
 */
const TEMPER = [
  { speed: 0.70, rest: [3.2, 3.0], wander: 0.30, mood: null },      // 서먹
  { speed: 0.85, rest: [2.6, 2.6], wander: 0.42, mood: null },      // 익숙
  { speed: 1.00, rest: [2.0, 2.2], wander: 0.55, mood: 'happy' },   // 친함
  { speed: 1.12, rest: [1.5, 1.8], wander: 0.66, mood: 'happy' },   // 단짝
  { speed: 1.22, rest: [1.1, 1.5], wander: 0.74, mood: 'happy' },   // 가족
];

export default function RoomView({
  currentMember,
  profile,
  editing = false,
  setEditing,
  onRoomChange,     // 저장·구매로 방이 바뀌면 부모에게 알린다
  guest,            // { action, id } — 밖에서 시킨 동작 (간식을 먹인다 등)
  bond = 0,         // 친밀도 단계 0~4
}) {
  const [manifest, setManifest] = useState(null);
  const [room, setRoom] = useState(null);
  const [asset, setAsset] = useState(null);
  const [err, setErr] = useState(null);

  // 펫 상태
  const [petCell, setPetCell] = useState({ x: 3.5, y: 3.5 });
  const [action, setAction] = useState('idle');
  const [facing, setFacing] = useState(1);

  // 편집
  const [selected, setSelected] = useState(null);   // uid
  const [drag, setDrag] = useState(null);           // { uid, cell, ok }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [inv, setInv] = useState({});               // asset_id -> 보유 수량

  const svgRef = useRef(null);
  const petRef = useRef({ pos: { x: 3.5, y: 3.5 }, path: [], hold: 1.2, action: 'idle' });
  const rafRef = useRef(0);
  const guestRef = useRef(0);   // guest 동작이 끝나는 시각 (performance.now 기준)

  const catalog = useMemo(() => (manifest ? buildCatalog(manifest) : null), [manifest]);
  const level = room ? (manifest?.roomLevels?.[room.level] || { size: 8 }) : { size: 8 };
  const size = level.size;
  const temper = TEMPER[Math.max(0, Math.min(4, bond))];

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
    const { data } = await supabase.from('pet_inventory')
      .select('asset_id, qty').eq('member_id', currentMember.id);
    const map = {}; (data || []).forEach((r) => { if (r.qty > 0) map[r.asset_id] = r.qty; });
    setInv(map);
  }, [currentMember.id]);

  useEffect(() => { reloadOwned(); }, [reloadOwned]);

  // 방이 밖에서 바뀌었을 수 있다 (상점에서 벽지를 샀다거나)
  const reloadRoom = useCallback(async () => {
    const { data } = await supabase.from('pet_rooms').select('*')
      .eq('member_id', currentMember.id).maybeSingle();
    if (data) setRoom(data);
    reloadOwned();
  }, [currentMember.id, reloadOwned]);

  useEffect(() => {
    if (!onRoomChange) return;
    onRoomChange.current = reloadRoom;      // 부모가 ref 를 건네주면 거기에 꽂는다
  }, [onRoomChange, reloadRoom]);

  const items = useMemo(() => room?.items || [], [room]);

  // 보관함에 있지만 아직 방에 안 놓은 것 (가구만)
  const spare = useMemo(() => {
    if (!catalog) return [];
    const placed = {};
    items.forEach((it) => { placed[it.assetId] = (placed[it.assetId] || 0) + 1; });
    return Object.entries(inv)
      .filter(([id]) => catalog[id] && catalog[id].category === 'furniture')
      .map(([id, qty]) => ({ id, left: qty - (placed[id] || 0) }))
      .filter((x) => x.left > 0);
  }, [inv, items, catalog]);

  const stage = stageOf(profile?.affection || 0);
  // 방 안에서의 크기. 원본 그림 자체가 단계마다 다르게 그려져 있어서
  // 여기서는 '방 대비 얼마나 크게 보일까' 만 정한다.
  // 0.62/0.72 로 뒀더니 아기가 한 칸의 절반도 안 돼 눈에 띄지 않았다 (실측 26px).
  const petScale = [0.95, 1.00, 1.06, 1.12, 1.15][stage] || 1.0;
  // 지금 걸치고 있는 것. 킷의 rig 가 지원하는 자리는 목뿐이라 그것만 그린다
  const wearPath = catalog && profile?.equipped?.neck
    ? catalog[profile.equipped.neck]?.path || null : null;

  // ── 밖에서 시킨 동작 (간식을 먹였다) ──
  useEffect(() => {
    if (!guest?.action) return;
    const st = petRef.current;
    st.path = [];
    st.action = guest.action;
    setAction(guest.action);
    guestRef.current = performance.now() + (guest.hold || 3400);
  }, [guest?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 자율 행동: 걷다가 가구 옆에서 뭔가 한다 ──
  const pickNext = useCallback(() => {
    if (!catalog || !room) return;
    const st = petRef.current;
    const wall = blocked(items, size, catalog);
    const interactive = items.filter((it) => catalog[it.assetId]?.interaction);
    // 활발할수록 가구를 더 자주 쓰고 더 멀리 간다
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
    if (Math.random() > temper.wander) {
      // 지금은 움직이고 싶지 않다. 제자리에서 뭔가 한다
      st.path = [];
      st.after = ['look', 'sit', 'idle'][Math.floor(Math.random() * 3)];
      st.action = st.after; setAction(st.after);
      st.hold = temper.rest[0] + Math.random() * temper.rest[1];
      return;
    }
    const cell = randomFreeCell(size, wall);
    if (!cell) { st.hold = 2; return; }
    st.path = route(st.pos, cell, items, size, catalog);
    st.after = ['wave', 'stretch', 'look', 'sit', 'idle'][Math.floor(Math.random() * 5)];
    st.hold = st.path.length ? 0 : 1.6;
  }, [catalog, room, items, size, temper]);

  // ── 시간 루프 ──
  useEffect(() => {
    if (!catalog || !room) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || editing) { setAction('idle'); return; }

    let last = performance.now();
    const speed = (stage === 0 ? 0.75 : 1.05) * temper.speed;

    const tick = (now) => {
      // 탭이 숨겨진 동안은 시간이 흐르지 않는다 (켜두기만 해도 진행되면 안 된다)
      const dt = Math.min(MAX_DELTA, (now - last) / 1000);
      last = now;
      if (document.hidden) { rafRef.current = requestAnimationFrame(tick); return; }
      // 밖에서 시킨 동작이 끝날 때까지는 자율 행동을 멈춘다
      if (now < guestRef.current) { rafRef.current = requestAnimationFrame(tick); return; }

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
        if (!st.path.length) {
          st.action = st.after || 'idle'; setAction(st.action);
          st.hold = temper.rest[0] + Math.random() * temper.rest[1];
        }
      } else {
        st.hold -= dt;
        if (st.hold <= 0) {
          if (st.action !== 'idle') {
            st.action = 'idle'; setAction('idle');
            st.hold = 1.2 + Math.random() * 2.2;
          } else pickNext();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [catalog, room, editing, stage, pickNext, temper]);

  // ── 좌표 ──
  function svgCell(evt) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    // CSS 픽셀을 그대로 격자로 쓰면 창 크기·모바일에서 어긋난다
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    const g = unproject(local.x, local.y, size);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
  }

  // ── 드래그 ──
  function startDrag(evt, uid) {
    if (!editing) return;
    evt.stopPropagation();
    setSelected(uid);
    setMsg(null);
    setDrag({ uid, cell: null, ok: true });
    svgRef.current?.setPointerCapture?.(evt.pointerId);
  }

  function onMove(evt) {
    if (!drag) return;
    const cell = svgCell(evt);
    if (!cell) return;
    if (cell.x === drag.cell?.x && cell.y === drag.cell?.y) return;
    const it = items.find((i) => i.uid === drag.uid);
    if (!it) return;
    const ok = placement({ ...it, x: cell.x, y: cell.y },
                         items.filter((i) => i.uid !== drag.uid), size, catalog).ok;
    setDrag({ ...drag, cell, ok });
  }

  function endDrag(evt) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    svgRef.current?.releasePointerCapture?.(evt.pointerId);
    if (!d.cell) return;                       // 제자리에서 뗐다 — 선택만 된 것
    if (d.ok) moveTo(d.uid, d.cell.x, d.cell.y);
    else setMsg('거기엔 놓을 수 없어요');
  }

  /** 빈 칸을 그냥 눌러도 선택한 가구가 그 자리로 간다 (작은 화면에서 드래그가 어려울 때) */
  function onSurface(evt) {
    if (!editing || !selected || drag) return;
    const cell = svgCell(evt);
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
        setSelected(uid); setDirty(true); setMsg(`${a.name}${josa(a.name, '을', '를')} 꺼냈어요`);
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
    const nm = catalog[it.assetId]?.name || '가구';
    setMsg(`${nm}${josa(nm, '을', '를')} 보관함에 넣었어요`);
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

  if (err) return <div style={st.empty}>{err}</div>;
  if (!manifest || !room) return <div style={st.empty}>불러오는 중…</div>;

  const wallH = 96;
  const vb = viewBoxFor(size, wallH);
  const walls = wallShapes(size, wallH);
  const corners = floorCorners(size);
  const coll = manifest.wallpaperCollections.find((c) => c.id === room.wallpaper);
  const baseCol = coll?.base || 'var(--surface-2)';
  const sideCol = coll?.side || 'var(--surface-3)';
  const floorAsset = catalog['floor-' + room.floor];
  // 드래그 중인 가구는 제자리에서 빼고 유령으로 따로 그린다
  const shown = drag?.cell ? items.filter((i) => i.uid !== drag.uid) : items;
  const order = depthSorted(shown, catalog, petCell);
  const pp = petPos(petCell, size, petScale);
  const ghostItem = drag?.cell ? items.find((i) => i.uid === drag.uid) : null;

  const tiles = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) {
    const p = project(x + 0.5, y + 0.5, size);
    tiles.push(<image key={`t${x}-${y}`} href={ASSET_BASE + (floorAsset?.path || '')}
      x={p.x - 32} y={p.y - 16} width={64} height={32} />);
  }

  function footprint(it, cx, cy) {
    const [w, h] = dimensions(it, catalog);
    const c = [project(cx, cy, size), project(cx + w, cy, size),
               project(cx + w, cy + h, size), project(cx, cy + h, size)];
    return c.map((p) => `${p.x},${p.y}`).join(' ');
  }

  return (
    <>
      <div style={st.stageWrap}>
        <svg ref={svgRef} viewBox={vb.join(' ')}
             style={{ ...st.svg, touchAction: editing ? 'none' : 'manipulation' }}
             onClick={onSurface}
             onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
             role="img" aria-label="펫의 방">
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

          {/* 편집 중 선택된 가구의 자리 안내 */}
          {editing && selected && !drag?.cell && (() => {
            const it = items.find((i) => i.uid === selected);
            if (!it) return null;
            return <polygon points={footprint(it, it.x, it.y)}
                            fill="none" stroke="var(--text)" strokeWidth="2" strokeDasharray="5 3" />;
          })()}

          {/* 드래그 중 놓일 자리 */}
          {ghostItem && (
            <polygon points={footprint(ghostItem, drag.cell.x, drag.cell.y)}
              fill={drag.ok ? 'rgba(90,150,110,.22)' : 'rgba(180,85,63,.22)'}
              stroke={drag.ok ? '#5a966e' : '#b4553f'} strokeWidth="2" />
          )}

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
                                       size={w} embedded x={pp.x} y={pp.y}
                                       mood={temper.mood} wearPath={wearPath} />}
                </g>
              );
            }
            const it = o.item;
            const a = catalog[it.assetId];
            if (!a) return null;
            const pos = furniturePos(it, catalog, size);
            const src = a.rotations?.[it.rotation || 0]?.source || a.path;
            return (
              <image key={it.uid + i} href={ASSET_BASE + src}
                x={pos.x} y={pos.y} width={256} height={224}
                style={{ cursor: editing ? 'grab' : 'default',
                         opacity: editing && selected && selected !== it.uid ? 0.55 : 1 }}
                onPointerDown={(e) => startDrag(e, it.uid)}
                onClick={(e) => { if (editing) e.stopPropagation(); }} />
            );
          })}

          {/* 드래그 유령 — 반투명하게 손끝을 따라온다 */}
          {ghostItem && (() => {
            const a = catalog[ghostItem.assetId];
            const pos = furniturePos({ ...ghostItem, x: drag.cell.x, y: drag.cell.y }, catalog, size);
            const src = a.rotations?.[ghostItem.rotation || 0]?.source || a.path;
            return <image href={ASSET_BASE + src} x={pos.x} y={pos.y} width={256} height={224}
                          opacity={drag.ok ? 0.6 : 0.32} style={{ pointerEvents: 'none' }} />;
          })()}
        </svg>

        {msg && <div style={st.toast}>{msg}</div>}
      </div>

      {editing && (
        <div style={st.editPane}>
          <div style={st.bar}>
            <button onClick={() => rotate(selected)} disabled={!selected} style={st.btn}>돌리기</button>
            <button onClick={() => storeItem(selected)} disabled={!selected} style={st.btn}>치우기</button>
            <button onClick={save} disabled={!dirty || saving} style={st.primary}>
              {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
            </button>
            <button onClick={() => { setEditing?.(false); setSelected(null); setDrag(null); }}
                    style={st.btn}>완료</button>
          </div>

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
            가구를 끌어서 옮기세요. 놓을 수 있는 자리는 초록, 안 되는 자리는 붉게 표시됩니다.
            눌러서 고른 뒤 빈 칸을 톡 눌러도 옮겨져요.
            <b> 치우기</b>는 없애는 게 아니라 보관함에 넣는 것입니다.
          </p>
        </div>
      )}
    </>
  );
}

const st = {
  empty: { textAlign: 'center', padding: '50px 0', color: 'var(--text-3)' },
  stageWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' },
  svg: { display: 'block', width: '100%', height: 'auto' },
  toast: { position: 'absolute', left: 10, bottom: 10, padding: '7px 11px', borderRadius: 18,
           background: 'var(--text)', color: 'var(--bg)', fontSize: 12, maxWidth: 'calc(100% - 20px)' },
  editPane: { marginTop: 10 },
  bar: { display: 'flex', alignItems: 'center', gap: 6 },
  primary: { padding: '10px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--text)', color: 'var(--bg)' },
  btn: { padding: '10px 13px', borderRadius: 10, fontSize: 13, border: '1px solid var(--border)', color: 'var(--text-2)' },
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
