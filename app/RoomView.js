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
  depthSorted, petPos, randomFreeCell, interactionOf, perchCell, frontCell,
  INTERACTION_ACTION, PERCH_LIFT, ASSET_BASE,
} from '../lib/pet/room';
import { extraActions } from '../lib/pet/actions';
import { supabase } from '../lib/supabase';
import { stageOf, josa } from '../lib/game';

const MAX_DELTA = 0.06;       // 탭이 멈췄다 돌아와도 순간이동하지 않게

/**
 * 걸음을 멈춘 뒤 하는 것. 2차 킷이 준 동작을 섞는다.
 * roll(데굴데굴)은 옆으로 눕는 자세라 바닥에서만 한다 — 가구 위에서 구르면 이상하다.
 */
const REST_ACTIONS       = ['groom', 'yawn', 'look', 'sit', 'idle', 'doze', 'roll', 'play', 'stretch'];
const REST_ON_FURNITURE  = ['groom', 'yawn', 'sit', 'idle', 'doze', 'nap'];

/**
 * 머리 위에 뜨는 감정 표현. 2차 킷이 준 48×48 이펙트를 그대로 쓴다.
 * 동작마다 어떤 게 뜨는지는 킷이 actions.js 에 적어 뒀다 (extraActions[].fx).
 * 여기 표는 1차 동작과, 킷이 비워 둔 자리를 메운 것이다.
 */
const FX_SRC = {
  heart: 'food/fx-heart.svg', sparkle: 'food/fx-sparkle.svg', note: 'food/fx-note.svg',
  crumbs: 'food/fx-crumbs.svg', zzz: 'food/fx-zzz.svg', exclaim: 'food/fx-exclaim.svg',
};
const ACTION_FX = {};
extraActions.forEach((a) => { if (a.fx) ACTION_FX[a.id] = a.fx; });
Object.assign(ACTION_FX, {
  eat: 'crumbs', play: 'note', celebrate: 'sparkle', wave: 'heart',
  nap: 'zzz', stretch: 'note', wake: 'exclaim', inspect: 'sparkle',
});

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
  const [lift, setLift] = useState(0);        // 가구 위에 올라가 있으면 그 높이만큼 뜬다
  const [mark, setMark] = useState(null);     // 머리 위 하트·반짝임
  const [petBox, setPetBox] = useState(null); // 그려진 몸의 실제 범위 (PetCanvas 가 알려준다)
  const [ripple, setRipple] = useState(null); // 누른 자리 표시

  // 편집
  const [selected, setSelected] = useState(null);   // uid
  const [drag, setDrag] = useState(null);           // { uid, cell, ok }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);   // 자동 저장이 겹쳐 들어오지 않게
  const [msg, setMsg] = useState(null);
  const [inv, setInv] = useState({});               // asset_id -> 보유 수량

  const svgRef = useRef(null);
  const petRef = useRef({ pos: { x: 3.5, y: 3.5 }, path: [], hold: 1.2, action: 'idle',
                          after: 'idle', afterLift: 0, lift: 0 });
  const rafRef = useRef(0);
  const guestRef = useRef(0);   // guest 동작이 끝나는 시각 (performance.now 기준)
  const petTapRef = useRef(0);  // 쓰다듬기 연타 방지
  const greetedRef = useRef(false);

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
  // 지금 걸치고 있는 것 전부. 2차 킷의 부착점 체계가 8자리를 모두 받는다
  const wearing = profile?.equipped && Object.keys(profile.equipped).length
    ? profile.equipped : null;

  // ── 밖에서 시킨 동작 (간식을 먹였다) ──
  useEffect(() => {
    if (!guest?.action) return;
    const st = petRef.current;
    st.path = [];
    st.action = guest.action;
    setAction(guest.action);
    guestRef.current = performance.now() + (guest.hold || 3400);
  }, [guest?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 가구 하나를 쓰러 간다.
   *   올라가 쉬는 가구(침대·방석·소파…)면 그 위 칸까지 간다.
   *   앞을 막는 가구라도 마지막 한 걸음은 길찾기를 건너뛰고 올라선다 — 올라타는 것이니까.
   *   그 밖의 가구는 예전처럼 옆 칸까지만 간다.
   * @returns 갈 수 있으면 true
   */
  const planTo = useCallback((item) => {
    if (!catalog) return false;
    const asset = catalog[item.assetId];
    const act = INTERACTION_ACTION[interactionOf(asset)] || 'inspect';
    const st = petRef.current;
    const up = PERCH_LIFT[item.assetId];

    if (up === undefined) {
      const res = approach(st.pos, item, items, size, catalog);
      if (!res) return false;
      st.path = res.path; st.after = act; st.afterLift = 0; st.hold = 0;
      return true;
    }

    const pc = perchCell(item, catalog);
    const goal = { x: pc.x + 0.5, y: pc.y + 0.5 };
    let path;
    if (!asset.blocksMovement) {
      // 러그·방석·펫 침대는 그냥 걸어 올라갈 수 있다
      path = route(st.pos, goal, items, size, catalog);
      if (!path.length && Math.hypot(goal.x - st.pos.x, goal.y - st.pos.y) > 0.2) return false;
    } else {
      const res = approach(st.pos, item, items, size, catalog);
      if (!res) return false;
      path = [...res.path, goal];
    }
    st.path = path; st.after = act; st.afterLift = up; st.hold = 0;
    return true;
  }, [catalog, items, size]);

  // ── 자율 행동: 걷다가 가구에서 쉬거나 논다 ──
  const pickNext = useCallback(() => {
    if (!catalog || !room) return;
    const st = petRef.current;
    const wall = blocked(items, size, catalog);
    const interactive = items.filter((it) => interactionOf(catalog[it.assetId]));
    // 활발할수록 자주 움직인다. 가만히 있고 싶을 땐 제자리에서 뭔가 한다
    if (interactive.length > 0 && Math.random() < 0.6) {
      const target = interactive[Math.floor(Math.random() * interactive.length)];
      if (planTo(target)) return;
    }
    if (Math.random() > temper.wander) {
      const pool = st.lift ? REST_ON_FURNITURE : REST_ACTIONS;
      st.path = [];
      st.after = pool[Math.floor(Math.random() * pool.length)];
      st.action = st.after; setAction(st.after);
      st.afterLift = st.lift;   // 가구 위에 있었다면 계속 거기 있는다
      st.hold = temper.rest[0] + Math.random() * temper.rest[1];
      return;
    }
    const cell = randomFreeCell(size, wall);
    if (!cell) { st.hold = 2; return; }
    st.path = route(st.pos, cell, items, size, catalog);
    st.after = REST_ACTIONS[Math.floor(Math.random() * REST_ACTIONS.length)];
    st.afterLift = 0;
    st.hold = st.path.length ? 0 : 1.6;
  }, [catalog, room, items, size, temper, planTo]);

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
        if (st.action !== 'walk') {
          st.action = 'walk'; setAction('walk');
          // 걷기 시작하면 가구에서 내려온다
          if (st.lift) { st.lift = 0; setLift(0); }
        }
        setPetCell({ ...st.pos });
        if (!st.path.length) {
          st.action = st.after || 'idle'; setAction(st.action);
          st.lift = st.afterLift || 0; setLift(st.lift);
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

  // ── 방을 열면 반겨준다 ──
  // 친밀도가 낮으면 멀리서 쳐다보기만 하고, 쌓이면 다가와서 인사한다.
  useEffect(() => {
    if (greetedRef.current || !catalog || !room || !asset || editing) return;
    greetedRef.current = true;
    const st = petRef.current;
    // perk 는 2차 킷이 '돌아왔을 때' 쓰라고 만든 동작이다. 서먹하면 쳐다만 본다
    const act = bond >= 1 ? 'perk' : 'look';
    const target = bond >= 1 ? frontCell(size, blocked(items, size, catalog)) : null;
    const path = target ? route(st.pos, target, items, size, catalog) : [];
    if (path.length) {
      st.path = path; st.after = act; st.afterLift = 0; st.hold = 0;
    } else {
      st.path = []; st.action = act; setAction(act);
      st.lift = 0; setLift(0);
      st.hold = 2.6;
    }
    if (bond >= 1) setMark({ fx: 'exclaim', id: Date.now() });
    // 교감하는 법은 처음 몇 번만 알려준다. 매번 뜨면 잔소리가 된다.
    // 기기별 편의라 localStorage 로 충분하다 — 지워져도 안내가 한 번 더 뜰 뿐이다
    try {
      const seen = Number(localStorage.getItem('ns-room-hint') || 0);
      if (seen < 3) {
        localStorage.setItem('ns-room-hint', String(seen + 1));
        setMsg('펫을 누르면 쓰다듬고, 바닥을 누르면 그리로 와요');
      }
    } catch { /* 사생활 보호 모드에서는 안내를 건너뛴다 */ }
  }, [catalog, room, asset, editing, bond, items, size]);

  useEffect(() => { if (!mark) return; const t = setTimeout(() => setMark(null), 1900); return () => clearTimeout(t); }, [mark]);

  // 동작이 바뀌면 그 동작에 어울리는 표현이 머리 위에 뜬다.
  // 한 번만 뜨고 마는 게 아니라 방에서 사는 내내 계속 나온다.
  useEffect(() => {
    const fx = ACTION_FX[action];
    if (!fx) return;
    // 조용한 사이일수록 덜 뜬다. 가족이 되면 거의 매번 뜬다
    const chance = [0.35, 0.5, 0.65, 0.8, 0.9][Math.max(0, Math.min(4, bond))];
    if (Math.random() > chance) return;
    setMark({ fx, id: Date.now() + Math.random() });
  }, [action, bond]);
  useEffect(() => { if (!ripple) return; const t = setTimeout(() => setRipple(null), 800); return () => clearTimeout(t); }, [ripple]);

  /**
   * PetCanvas 가 알려준 몸 범위. '펫 그림 상자 안에서의 상대 위치' 라
   * 걸어다녀도 값이 바뀌지 않는다 — 단계나 동작이 바뀔 때만 다시 온다.
   */
  const onPetBounds = useCallback((b) => {
    setPetBox((prev) => {
      if (prev && Math.abs(prev.dx - b.dx) < 1 && Math.abs(prev.dy - b.dy) < 1
          && Math.abs(prev.w - b.w) < 1 && Math.abs(prev.h - b.h) < 1) return prev;
      return b;
    });
  }, []);

  // ── 교감 ──
  /** 펫을 누르면 좋아한다. 점수도 친밀도도 오르지 않는다 — 그냥 쓰다듬는 것이다 */
  function petTap(evt) {
    evt?.stopPropagation?.();
    if (editing) return;
    const now = performance.now();
    if (now < petTapRef.current) return;      // 연타로 애니메이션이 끊기지 않게
    petTapRef.current = now + 1400;
    const st = petRef.current;
    st.path = [];
    // 친해지면 하이파이브, 아직 서먹하면 새침하게 곁눈질한다
    const act = bond >= 2 ? 'highfive' : bond >= 1 ? 'perk' : 'sulk';
    st.action = act; setAction(act);
    st.after = 'idle'; st.afterLift = st.lift;
    st.hold = 2.0;
    guestRef.current = now + 1900;            // 잠깐은 제 갈 길을 가지 않는다
    setMark({ fx: bond >= 1 ? 'heart' : 'exclaim', id: now });
  }

  /** 바닥을 누르면 그리로 온다. 가구를 누르면 그 가구를 쓰러 간다 */
  function tapFloor(cell, evt) {
    const st = petRef.current;
    // 펫이 서 있는 칸을 누른 것도 쓰다듬기다 (머리 위를 눌러도 되도록)
    if (Math.floor(st.pos.x) === cell.x && Math.floor(st.pos.y) === cell.y) {
      petTap(evt); return;
    }
    const hit = items.find((it) => {
      const [w, h] = dimensions(it, catalog);
      return cell.x >= it.x && cell.x < it.x + w && cell.y >= it.y && cell.y < it.y + h;
    });
    if (hit && interactionOf(catalog[hit.assetId])) {
      if (planTo(hit)) { guestRef.current = 0; setRipple({ ...cell, id: Date.now() }); return; }
    }
    const wall = blocked(items, size, catalog);
    if (wall.has(`${cell.x},${cell.y}`)) { setMsg('거긴 못 올라가요'); return; }
    const path = route(st.pos, { x: cell.x + 0.5, y: cell.y + 0.5 }, items, size, catalog);
    if (!path.length) { setMsg('거기까지 갈 길이 없어요'); return; }
    st.path = path;
    st.after = bond >= 2 ? 'perk' : 'look';
    st.afterLift = 0;
    st.hold = 0;
    guestRef.current = 0;
    setRipple({ ...cell, id: Date.now() });
  }

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

  /**
   * 편집 중 — 빈 칸을 눌러도 고른 가구가 그 자리로 간다 (작은 화면에서 드래그가 어려울 때)
   * 평소 —  누른 자리로 펫이 온다
   */
  function onSurface(evt) {
    const cell = svgCell(evt);
    if (!cell || cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size) return;
    if (editing) {
      if (!selected || drag) return;
      moveTo(selected, cell.x, cell.y);
      return;
    }
    tapFloor(cell, evt);
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

  const saveRef = useRef(null);

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const { data, error } = await supabase.rpc('game_save_room', {
      p_member: currentMember.id, p_items: items, p_revision: room.revision,
      p_wallpaper: null, p_floor: null,
    });
    savingRef.current = false;
    setSaving(false);
    if (error) { setMsg('저장하지 못했어요'); return; }
    if (!data?.ok) {
      setMsg(data?.reason || '저장하지 못했어요');
      if (data?.room) setRoom(data.room);   // 서버 최신본으로 되돌린다
      setDirty(false);
      return;
    }
    setRoom((r) => ({ ...r, revision: data.revision }));
    setDirty(false);
  }
  saveRef.current = save;

  // 옮기고 나면 알아서 저장한다. 저장 버튼을 누르게 하지 않는다.
  // 연달아 옮기는 동안에는 타이머가 계속 밀려서 요청이 한 번으로 묶인다.
  useEffect(() => {
    if (!dirty || saving) return;
    const t = setTimeout(() => saveRef.current?.(), 700);
    return () => clearTimeout(t);
  }, [dirty, saving, items]);

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
  const pp0 = petPos(petCell, size, petScale);
  const pp = { x: pp0.x, y: pp0.y - lift };   // 가구 위에 앉으면 그 높이만큼 올려 그린다
  const petW = 200 * petScale;
  const petH = 190 * petScale;

  /**
   * 누르면 쓰다듬어지는 자리.
   * 실측한 몸 범위에 여유를 두고, 손가락으로 누를 수 있는 최소 크기를 보장한다.
   * 좌우 반전 중이면 그림이 뒤집혀 있으므로 판도 같이 뒤집는다 —
   * 판은 반전 <g> 바깥에 있어서 저절로 따라가지 않는다.
   */
  const hitRect = (() => {
    const PAD = 10, MIN = 62;          // 씬 단위. 방 한 칸이 64 다
    const b = petBox || { dx: 55 * petScale, dy: 95 * petScale,
                          w: 90 * petScale, h: 85 * petScale };
    let x = pp.x + b.dx - PAD, y = pp.y + b.dy - PAD, w = b.w + PAD * 2, h = b.h + PAD * 2;
    if (w < MIN) { x -= (MIN - w) / 2; w = MIN; }
    if (h < MIN) { y -= (MIN - h) / 2; h = MIN; }
    if (facing < 0) x = pp.x * 2 + petW - (x + w);   // 그림과 같이 뒤집는다
    return { x, y, w, h };
  })();
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
              return (
                <g key="pet">
                  <g transform={facing < 0
                      ? `translate(${(pp.x * 2 + petW).toFixed(2)} 0) scale(-1 1)` : undefined}>
                    {asset && <PetCanvas asset={asset} stage={stage} action={action}
                                         size={petW} embedded x={pp.x} y={pp.y}
                                         mood={temper.mood} wearing={wearing}
                                         onBounds={onPetBounds} />}
                  </g>
                  {/* 쓰다듬기 판. 펫 그림은 aria-hidden 이라 눌릴 수 없어서 따로 깐다.
                      좌우 반전 바깥에 둬야 누르는 자리가 그림을 따라간다.

                      ⚠ 크기를 상수로 어림잡으면 안 된다. 캐릭터마다 몸이 달라서
                      머리를 눌렀는데 판 밖이면 펫이 그리로 걸어가 버린다 (실제로 겪었다).
                      PetCanvas 가 실제로 그려진 범위를 알려주고, 여기서 여유를 더한다. */}
                  {!editing && hitRect && (
                    <rect x={hitRect.x} y={hitRect.y} width={hitRect.w} height={hitRect.h}
                          fill="transparent" style={{ cursor: 'pointer' }}
                          onPointerDown={petTap} onClick={(e) => e.stopPropagation()} />
                  )}
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

          {/* 머리 위 감정 표현 */}
          {mark && FX_SRC[mark.fx] && (() => {
            const FX = 30, RISE = 12;            // 씬 단위. 한 칸이 64 다
            const bodyTop = pp.y + (petBox ? petBox.dy : 95 * petScale);
            // 몸 꼭대기 바로 위에 띄운다. 그림 상자 기준으로 잡으면
            // 캐릭터마다 머리 위치가 달라 천장에 붙어 잘린다 (실제로 잘렸다).
            // 떠오르는 높이(RISE)까지 미리 빼 둬야 올라가다 잘리지 않는다
            const y = Math.max(vb[1] + 4 + RISE, bodyTop - FX - 4);
            return (
              <g key={mark.id} style={{ pointerEvents: 'none' }}>
                <image href={ASSET_BASE + FX_SRC[mark.fx]}
                       x={pp.x + petW / 2 - FX / 2} y={y} width={FX} height={FX}>
                  <animateTransform attributeName="transform" type="translate"
                    values="0,4; 0,-6; 0,-12" dur="1.8s" fill="freeze" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" fill="freeze" />
                </image>
              </g>
            );
          })()}

          {/* 누른 자리 — 여기로 오라는 표시 */}
          {ripple && (() => {
            const c = project(ripple.x + 0.5, ripple.y + 0.5, size);
            return (
              <ellipse key={ripple.id} cx={c.x} cy={c.y} rx="10" ry="5"
                       fill="none" stroke="var(--text-2)" strokeWidth="2"
                       style={{ pointerEvents: 'none' }}>
                <animate attributeName="rx" from="8" to="30" dur="0.8s" fill="freeze" />
                <animate attributeName="ry" from="4" to="15" dur="0.8s" fill="freeze" />
                <animate attributeName="opacity" from="0.8" to="0" dur="0.8s" fill="freeze" />
              </ellipse>
            );
          })()}

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
            <span style={st.saveState}>
              {saving ? '저장 중…' : dirty ? '바뀜' : '저장됨'}
            </span>
            <button onClick={() => {
                      // 나가기 전에 남은 변경을 흘려보내지 않는다
                      if (dirty && !saving) save();
                      setEditing?.(false); setSelected(null); setDrag(null);
                    }}
                    style={st.primary}>완료</button>
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
            <b> 놓으면 바로 저장됩니다</b> — 다른 가구를 누르면 그 가구가 바로 끌립니다.
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
  saveState: { flex: 1, textAlign: 'right', fontSize: 12, color: 'var(--text-3)' },
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
