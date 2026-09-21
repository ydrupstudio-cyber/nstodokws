// ============================================================
// 펫 점수 시스템 — 클라이언트 쪽 얇은 래퍼
//
// ⚠️ 여기서 점수를 계산하지 않는다. 점수표도 상한도 전부 DB 함수 안에 있다.
//    클라이언트는 "이런 일이 있었다"고 알리기만 하고, 줄지 말지는 서버가 정한다.
//    (익명 키가 공개돼 있으니 클라이언트 계산은 그냥 거짓말이 된다)
//
// 지급 결과는 window 이벤트로 흘려보낸다. 어느 컴포넌트에서 호출하든
// 토스트는 page.js 가 한 곳에서 띄운다 — prop 을 타고 내려갈 필요가 없다.
// ============================================================
import { supabase } from './supabase';

export const POINT_EVENT = 'ns-points';

function emit(result) {
  if (typeof window === 'undefined' || !result) return;
  if (!result.awarded && !result.gained) return;
  window.dispatchEvent(new CustomEvent(POINT_EVENT, { detail: result }));
}

/**
 * 점수 지급 요청. 실패해도 절대 throw 하지 않는다 —
 * 미니게임 때문에 할일 저장이 막히면 안 된다.
 */
export async function award(memberId, action, ref, detail) {
  if (!memberId || !action || !ref) return null;
  try {
    const { data, error } = await supabase.rpc('game_award', {
      p_member: memberId, p_action: action, p_ref: String(ref), p_detail: detail || null,
    });
    if (error) { console.warn('[game] award 실패', action, error.message); return null; }
    if (data?.awarded) emit({ ...data, action });
    return data;
  } catch (e) {
    console.warn('[game] award 예외', e);
    return null;
  }
}

/** 출석 체크. 하루 4구간(06-09/09-12/12-14/14-16), 그 외 시간대는 조용히 넘어간다. */
export async function attend(memberId) {
  if (!memberId) return null;
  try {
    const { data, error } = await supabase.rpc('game_attend', { p_member: memberId });
    if (error) { console.warn('[game] attend 실패', error.message); return null; }
    if (data?.gained > 0) emit(data);
    return data;
  } catch (e) {
    console.warn('[game] attend 예외', e);
    return null;
  }
}

/** 입양. 종·품종은 한 번 정하면 못 바꾼다 (서버가 막는다) */
export async function adopt(memberId, species, breed, name, coat = null) {
  const { data, error } = await supabase.rpc('game_adopt', {
    p_member: memberId, p_species: species, p_breed: breed, p_name: name, p_coat: coat,
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 먹이 주기. 가격·친밀도·하루 횟수는 전부 서버가 정한다 */
export async function feed(memberId, foodId) {
  const { data, error } = await supabase.rpc('game_feed', {
    p_member: memberId, p_food: foodId,
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

export async function loadFoods() {
  const { data } = await supabase.from('food_items')
    .select('*').neq('kind', 'special').order('sort_order');
  return data || [];
}

/** 오늘 준 먹이 + 지금까지 발견한 도감 */
export async function loadFeedState(memberId, today) {
  if (!memberId) return { todayIds: [], discovered: {} };
  const { data } = await supabase.from('feed_log')
    .select('food_id, fed_on, liked').eq('member_id', memberId)
    .order('id', { ascending: false }).limit(400);
  const rows = data || [];
  const discovered = {};
  rows.forEach((r) => { discovered[r.food_id] = discovered[r.food_id] || r.liked; });
  return { todayIds: rows.filter((r) => r.fed_on === today).map((r) => r.food_id), discovered };
}

export async function loadProfile(memberId) {
  if (!memberId) return null;
  const { data } = await supabase.from('game_profiles').select('*').eq('member_id', memberId).maybeSingle();
  return data;
}

/** KST 오늘 날짜. 서버와 같은 기준으로 잘라야 도감·상한 표시가 안 어긋난다 */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function loadRanking() {
  const { data } = await supabase
    .from('game_profiles')
    .select('member_id, species, breed, pet_name, total_earned, affection, total_streak, members(name, year_level)')
    .order('total_earned', { ascending: false })
    .limit(30);
  return data || [];
}

/** 활동 피드 + 각 줄에 달린 신고 수 */
export async function loadFeed(limit = 60) {
  const { data } = await supabase
    .from('point_ledger')
    .select('*, point_reports(id, reporter, reason)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function report(ledgerId, reporterId, reporter, reason) {
  const { error } = await supabase.from('point_reports')
    .insert([{ ledger_id: ledgerId, reporter_id: reporterId, reporter, reason: reason || null }]);
  if (error && error.code === '23505') return { ok: false, reason: '이미 신고하셨습니다' };
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function voidEntry(ledgerId, by) {
  const { data, error } = await supabase.rpc('game_void', { p_ledger: ledgerId, p_by: by });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 오늘 찍은 출석 구간 (1~4) */
export async function todaySlots(memberId) {
  if (!memberId) return [];
  const { data } = await supabase.from('point_ledger')
    .select('ref_key').eq('member_id', memberId).eq('action', 'attend').eq('voided', false)
    .order('created_at', { ascending: false }).limit(8);
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return (data || [])
    .filter((r) => r.ref_key.startsWith(`attend:${today}:`))
    .map((r) => Number(r.ref_key.split(':')[2]));
}

export const SLOT_LABELS = [null, '아침 06-09', '오전 09-12', '점심 12-14', '오후 14-16'];

/**
 * 한 달치 출석을 달력용으로 긁어온다.
 * 원장의 ref_key 가 'attend:2026-09-21:2' 형태라 날짜·구간이 그대로 들어 있다.
 * 따로 집계 테이블을 두지 않은 이유다 — 원장 하나가 곧 출석부다.
 *
 * @returns { '2026-09-21': [1,2,4], ... }  날짜 → 찍은 구간 번호 배열
 */
export async function loadAttendMonth(memberId, year, month) {
  if (!memberId) return {};
  const mm = String(month + 1).padStart(2, '0');
  const prefix = `attend:${year}-${mm}-`;
  const { data, error } = await supabase.from('point_ledger')
    .select('ref_key')
    .eq('member_id', memberId).eq('action', 'attend').eq('voided', false)
    .like('ref_key', prefix + '%');
  if (error) { console.warn('[game] 출석 달력', error.message); return {}; }
  const out = {};
  (data || []).forEach((r) => {
    const [, day, slot] = r.ref_key.split(':');
    if (!day) return;
    (out[day] = out[day] || []).push(Number(slot));
  });
  Object.values(out).forEach((v) => v.sort());
  return out;
}

// ============================================================
// V12 — 친밀도로 크는 펫, 가방, 착용, 독립시키기
//
// ⚠️ 성장 기준이 '누적 점수' 에서 '친밀도' 로 바뀌었다.
//    아래 기준선은 DB 의 game_stage() 와 반드시 같아야 한다.
//    한쪽만 고치면 화면과 서버가 다른 단계를 말하게 된다.
// ============================================================
export const STAGE_NEED = [0, 200, 800, 2000, 4500];   // 아기 꼬마 청소년 어른 단짝
export const STAGE_LABELS = ['아기', '꼬마', '청소년', '어른', '단짝'];
export const BOND_LABELS  = ['서먹', '익숙', '친함', '단짝', '가족'];

/** 친밀도 → 성장 단계 (0~4). 서버 game_stage() 와 같은 계단이다 */
export function stageOf(affection) {
  const a = affection || 0;
  for (let i = STAGE_NEED.length - 1; i >= 0; i--) if (a >= STAGE_NEED[i]) return i;
  return 0;
}

/** 다음 단계까지의 진행도. 레벨 바가 이걸 그린다 */
export function stageProgress(affection) {
  const a = affection || 0;
  const s = stageOf(a);
  if (s >= STAGE_NEED.length - 1) return { stage: s, ratio: 1, left: 0, max: true };
  const from = STAGE_NEED[s], to = STAGE_NEED[s + 1];
  return {
    stage: s, max: false, left: to - a,
    ratio: Math.max(0, Math.min(1, (a - from) / (to - from))),
  };
}

/**
 * 착용 자리. 순서가 곧 옷장 카테고리 순서다.
 *
 * hidden 은 '자료는 그대로 두고 화면에서만 뺀다' 는 뜻이다.
 * 부착 위치가 아직 몸에 잘 안 맞는 자리를 잠시 접어 둔 것이라,
 * 디자인 수정본이 오면 이 한 줄만 지우면 다시 나온다.
 * 이미 입고 있는 것은 옷장에 계속 보여서 벗을 수 있다.
 */
export const WEAR_SLOTS = [
  { slot: 'head', label: '모자' },
  { slot: 'face', label: '안경' },
  { slot: 'ear',  label: '귀걸이', hidden: true },
  { slot: 'neck', label: '목걸이·목도리' },
  { slot: 'body', label: '옷',     hidden: true },
  { slot: 'back', label: '망토·가방' },
  { slot: 'hand', label: '장갑',   hidden: true },
  { slot: 'foot', label: '신발',   hidden: true },
];

/** 지금 상점·옷장에 내놓는 자리 */
export const VISIBLE_WEAR_SLOTS = WEAR_SLOTS.filter((w) => !w.hidden);
export const HIDDEN_SLOTS = new Set(WEAR_SLOTS.filter((w) => w.hidden).map((w) => w.slot));

/** 가방 — asset_id → 보유 수량 */
export async function loadInventory(memberId) {
  if (!memberId) return {};
  const { data } = await supabase.from('pet_inventory')
    .select('asset_id, qty').eq('member_id', memberId);
  const map = {};
  (data || []).forEach((r) => { if (r.qty > 0) map[r.asset_id] = r.qty; });
  return map;
}

/** 상점 품목 전체. item_id → row (kind·price·name 을 여기서만 안다) */
export async function loadShopItems() {
  const { data } = await supabase.from('shop_items').select('*');
  return data || [];
}

/** 입히기·벗기기. itemId 가 null 이면 벗긴다 */
export async function equip(memberId, slot, itemId) {
  const { data, error } = await supabase.rpc('game_equip', {
    p_member: memberId, p_slot: slot, p_item: itemId || null,
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 독립시키기. 방·가구·옷·점수는 그대로 두고 펫만 새로 시작한다 */
export async function release(memberId) {
  const { data, error } = await supabase.rpc('game_release', { p_member: memberId });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 함께했던 친구들 */
export async function loadPetHistory(memberId) {
  if (!memberId) return [];
  const { data } = await supabase.from('pet_history')
    .select('*').eq('member_id', memberId).order('released_at', { ascending: false });
  return data || [];
}

/**
 * 받침에 따라 조사를 고른다. '스파니 은(는)' 같은 표기를 없애려고 둔다.
 * 한글이 아닌 글자로 끝나면 괄호 표기로 돌아간다 — 틀린 조사를 쓰는 것보다 낫다.
 */
export function josa(word, withBatchim, without) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return `${withBatchim}(${without})`;
  return (code - 0xac00) % 28 ? withBatchim : without;
}

// ============================================================
// V14 — 놀러가기 · 선물하기
// ============================================================

/** 펫을 데려온 사람들. 놀러갈 방 목록이다 */
export async function loadNeighbours(meId) {
  const { data } = await supabase
    .from('game_profiles')
    .select('member_id, species, breed, pet_name, affection, generation, equipped, members(name, year_level, active)')
    .not('species', 'is', null)
    .order('affection', { ascending: false });
  return (data || []).filter((r) => r.member_id !== meId && r.members?.active !== false);
}

/** 남의 방. 읽기만 한다 */
export async function loadRoomOf(memberId) {
  const { data } = await supabase.from('pet_rooms').select('*')
    .eq('member_id', memberId).maybeSingle();
  return data;
}

/** 놀러가기. 점수는 서버가 정한다 (하루 3번, 같은 방은 하루 한 번) */
export async function visit(memberId, hostId) {
  const { data, error } = await supabase.rpc('game_visit', { p_member: memberId, p_host: hostId });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 선물하기. 가방에 있는 것을 넘긴다 — 점수는 넘어가지 않는다 */
export async function gift(memberId, toId, itemId) {
  const request = `${memberId}>${toId}:${itemId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase.rpc('game_gift', {
    p_member: memberId, p_to: toId, p_item: itemId, p_request: request,
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 함께한 기간. adopted_at 이 없던 시절 기록도 있어서 없으면 없는 대로 말한다 */
export function livedSpan(from, to) {
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : new Date();
  const d = (x) => `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`;
  if (!f) return { text: `${d(t)} 까지`, days: null };
  const days = Math.max(1, Math.round((t - f) / 86400000));
  return { text: `${d(f)} — ${d(t)}`, days };
}

/**
 * 되팔기. 산 날 당일이면 전액, 그 뒤로는 절반.
 * 선물받은 물건은 영수증이 없어 서버가 거절한다 — 점수 몰아주기를 막는 장치다.
 */
export async function sellItem(memberId, itemId) {
  const request = `${memberId}:${itemId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase.rpc('game_sell', {
    p_member: memberId, p_item: itemId, p_request: request,
  });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/**
 * 되팔 수 있는 영수증. 얼마를 돌려받는지 미리 보여주려고 읽는다.
 * 실제 금액은 서버가 다시 계산한다 — 여기 값은 안내일 뿐이다.
 * @returns { [itemId]: { count, best, full } }
 */
export async function loadRefundable(memberId) {
  if (!memberId) return {};
  const { data } = await supabase.from('shop_receipts')
    .select('item_id, price, created_at')
    .eq('member_id', memberId).is('refunded_at', null).gt('price', 0)
    .order('created_at');
  const today = todayKST();
  const out = {};
  (data || []).forEach((r) => {
    const sameDay = new Date(new Date(r.created_at).getTime() + 9 * 3600 * 1000)
      .toISOString().slice(0, 10) === today;
    const back = sameDay ? r.price : Math.floor(r.price / 2);
    const cur = out[r.item_id];
    // 오래된 영수증부터 쓰이므로 첫 번째 것이 실제로 팔릴 값이다
    if (!cur) out[r.item_id] = { count: 1, back, full: sameDay };
    else cur.count += 1;
  });
  return out;
}
