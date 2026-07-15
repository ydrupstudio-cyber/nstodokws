import { WARD_PATTERNS } from './config';

export function todayStr() {
  return formatDate(new Date());
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(date1Str, date2Str) {
  const d1 = new Date(date1Str + 'T00:00:00');
  const d2 = new Date(date2Str + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}

export function formatDateLabel(dateStr) {
  if (dateStr === todayStr()) return '오늘';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  if (diff === -1) return '어제';
  if (diff === 1) return '내일';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export function formatShortDateLabel(dateStr) {
  if (dateStr === todayStr()) return '오늘';
  if (dateStr === shiftDateStr(todayStr(), 1)) return '내일';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

// 글자에서 시간 자동 인식
export function extractTimeFromText(text) {
  let m = text.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  m = text.match(/(오후|오전)\s*(\d{1,2})시\s*(\d{1,2})?분?/);
  if (m) {
    let h = parseInt(m[2]);
    const min = m[3] ? parseInt(m[3]) : 0;
    if (m[1] === '오후' && h < 12) h += 12;
    if (m[1] === '오전' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  m = text.match(/(\d{1,2})시\s*(\d{1,2})?분?/);
  if (m) {
    const h = parseInt(m[1]);
    const min = m[2] ? parseInt(m[2]) : 0;
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)/);
  if (m) {
    let h = parseInt(m[1]);
    const min = m[2] ? parseInt(m[2]) : 0;
    const isPm = /pm/i.test(m[3]);
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return null;
}

// 태그 추출
export function extractTags(text) {
  const matches = text.match(/#[^\s#]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((t) => t.slice(1)))];
}

export function stripTags(text) {
  return text.replace(/\s*#[^\s#]+/g, '').trim();
}

// 병동 자동 인식 (대소문자 무시)
export function extractWard(text) {
  for (const { match, ward } of WARD_PATTERNS) {
    if (match.test(text)) {
      match.lastIndex = 0; // reset regex
      return ward;
    }
  }
  return null;
}

// 교수님 이니셜 추출 (메모 prefix 또는 본문에서)
export function extractProfessor(text, knownInitials = []) {
  // [D] 또는 [d] 패턴
  const bracket = text.match(/\[([A-Za-z])\]/);
  if (bracket && knownInitials.includes(bracket[1].toUpperCase())) {
    return bracket[1].toUpperCase();
  }
  return null;
}

// 표시용: 본문/메모에서 [X] 패턴 자동 추출 + 제거
// 반환: { cleanText, profInitial } — 본문에 있던 [X]를 빼고 깔끔하게 + 추출된 이니셜
export function parseProfessorBracket(text, knownInitials = []) {
  if (!text) return { cleanText: text, profInitial: null };
  // [X] 패턴 첫 번째 매치 (앞쪽 우선)
  const match = text.match(/\[([A-Za-z])\]\s*/);
  if (match && knownInitials.includes(match[1].toUpperCase())) {
    return {
      cleanText: text.replace(match[0], '').trim(),
      profInitial: match[1].toUpperCase(),
    };
  }
  return { cleanText: text, profInitial: null };
}

// 시간 임박 (2시간 이내)
export function isTimeNear(dateStr, timeStr) {
  if (!timeStr) return false;
  if (dateStr !== todayStr()) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = (target - new Date()) / 60000;
  return diff > 0 && diff <= 120;
}

export function isTimePast(dateStr, timeStr) {
  if (!timeStr) return false;
  if (dateStr > todayStr()) return false;
  if (dateStr < todayStr()) return true;
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return target < new Date();
}

export function formatTimeLabel(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

// 상대 시간 (XX분 전, XX시간 전)
export function relativeTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  const diff = (now - d) / 60000;
  if (diff < 1) return '방금';
  if (diff < 60) return `${Math.floor(diff)}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  if (diff < 10080) return `${Math.floor(diff / 1440)}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

// 사진 압축
export async function compressPhoto(file) {
  const imageCompression = (await import('browser-image-compression')).default;
  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  };
  return await imageCompression(file, options);
}

// VAPID 키를 Uint8Array로 변환 (브라우저 push용)
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
