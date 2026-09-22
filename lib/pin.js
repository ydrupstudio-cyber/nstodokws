'use client';

/*
  본인 확인 핀.

  ⚠ 설계의 출발점: **로그인할 때마다 묻지 않는다.**
  매번 물으면 아무도 안 쓴다. 그래서 묻는 때는 딱 하나 —
  '본인 변경' 으로 **남의 계정**에 들어가려 할 때뿐이다.
  한 번 통과하면 이 기기에 적어 두고 그 사람으로는 다시 묻지 않는다.

  핀 자체는 브라우저가 절대 갖고 있지 않다. 확인도 변경도 전부 서버 함수가
  한다 (member_pins 표는 읽기조차 막혀 있다). 여기 있는 건 호출 껍데기뿐이다.
*/
import { supabase } from './supabase';

const TRUST_KEY = 'pinTrusted';

/** 핀을 걸어 둔 사람들의 id. 자물쇠를 그리고, 물을지 말지 정하는 데 쓴다 */
export async function lockedMembers() {
  const { data, error } = await supabase.rpc('pin_locked_members');
  if (error) return new Set();            // 함수가 아직 없으면 아무도 안 잠긴 것으로 본다
  return new Set((data || []).map((r) => Number(r.member_id ?? r)));
}

export async function hasPin(memberId) {
  const { data } = await supabase.rpc('pin_has', { p_member: memberId });
  return !!data;
}

export async function checkPin(memberId, pin) {
  const { data, error } = await supabase.rpc('pin_check', { p_member: memberId, p_pin: pin });
  if (error) return { ok: false, reason: error.message };
  return data;
}

export async function setPin(memberId, next, current = null) {
  const { data, error } = await supabase.rpc('pin_set',
    { p_member: memberId, p_new: next, p_current: current });
  if (error) return { ok: false, reason: error.message };
  return data;
}

export async function updateSelf(memberId, pin, name, yearLevel) {
  const { data, error } = await supabase.rpc('member_update_self',
    { p_member: memberId, p_pin: pin, p_name: name, p_year_level: yearLevel });
  if (error) return { ok: false, reason: error.message };
  return data;
}

/** 이 기기에서 이미 확인을 마친 사람인가 */
export function isTrusted(memberId) {
  try {
    const raw = JSON.parse(localStorage.getItem(TRUST_KEY) || '[]');
    return raw.includes(Number(memberId));
  } catch { return false; }
}

export function trustDevice(memberId) {
  try {
    const raw = JSON.parse(localStorage.getItem(TRUST_KEY) || '[]');
    if (!raw.includes(Number(memberId))) raw.push(Number(memberId));
    localStorage.setItem(TRUST_KEY, JSON.stringify(raw));
  } catch { /* 저장이 막혀 있어도 동작은 한다 — 다음에 한 번 더 물을 뿐이다 */ }
}

/** 핀을 새로 걸거나 바꾼 뒤에는 이 기기를 믿어도 된다 */
export function forgetDevice(memberId) {
  try {
    const raw = JSON.parse(localStorage.getItem(TRUST_KEY) || '[]');
    localStorage.setItem(TRUST_KEY, JSON.stringify(raw.filter((x) => x !== Number(memberId))));
  } catch { /* 무시 */ }
}

/** 틀렸을 때 사람에게 보여줄 말 */
export function pinMessage(r) {
  if (!r) return '확인하지 못했어요';
  if (r.ok) return null;
  if (r.reason === 'locked') {
    const m = Math.ceil((r.seconds || 600) / 60);
    return `여러 번 틀려서 ${m}분 동안 잠겼어요`;
  }
  if (r.reason === 'wrong') {
    return r.left > 0 ? `핀이 달라요 (${r.left}번 남음)` : '핀이 달라요';
  }
  return r.reason || '확인하지 못했어요';
}
