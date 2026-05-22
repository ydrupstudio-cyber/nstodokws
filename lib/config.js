export const YEAR_LEVELS = {
  r1: { label: '(1)', full: '1년차', color: '#9a9892', bg: '#f0eee7' },
  r2: { label: '(2)', full: '2년차', color: '#5b7a99', bg: '#e8eef4' },
  r3: { label: '(3)', full: '3년차', color: '#8a6e4b', bg: '#f1ebe1' },
  r4: { label: '(4)', full: '4년차', color: '#3d6e6a', bg: '#dfe9e8' },
  pa: { label: 'PA', full: 'PA', color: '#7a5b8e', bg: '#ede7f1' },
  all: { label: '공통', full: '공통', color: '#2a2a28', bg: '#e8e5dc' },
};

export const YEAR_ORDER = ['r1', 'r2', 'r3', 'r4', 'pa', 'all'];
export const ASSIGNEE_ORDER = ['r1', 'r2', 'r3', 'r4', 'all'];
export const DEFAULT_ASSIGNEE = 'r1';

export const ROLE_GROUPS = {
  resident: { label: '전공의', levels: ['r1', 'r2', 'r3', 'r4'] },
  pa: { label: 'PA', levels: ['pa'] },
};

// 빠른 병동 칩 — 의국 동선 분류용
export const WARD_CHIPS = ['9층', '5층 ICU'];

// 본문에서 자동 인식할 병동 패턴
export const WARD_PATTERNS = [
  { match: /\b9[0-3]\d호\b|\b9층\b/g, ward: '9층' },
  { match: /\bSB\b|\bEB\b|\bMA\b|\bMB\b|\bCCU\b|\b5층\s*ICU\b|\b5층\b/g, ward: '5층 ICU' },
];

// 미래 다가오는 할일 표시 일수
export const UPCOMING_DAYS = 14;
