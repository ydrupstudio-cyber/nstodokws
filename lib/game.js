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
