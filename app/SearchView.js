'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS, YEAR_ORDER, WARD_CHIPS } from '../lib/config';
import { formatTimeLabel, formatDateLabel, relativeTime, todayStr, shiftDateStr, parseProfessorBracket } from '../lib/utils';

export default function SearchView({ onClose, onPhotoClick, professors }) {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [status, setStatus] = useState('all'); // all, active, done
  const [profFilter, setProfFilter] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 검색
  const doSearch = async () => {
    setSearching(true);
    setHasSearched(true);

    let q = supabase.from('todos').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });

    // 키워드 (대소문자 무시, text/memo에서 검색)
    const kw = keyword.trim();
    if (kw) {
      // ilike는 case-insensitive
      q = q.or(`text.ilike.%${kw}%,memo.ilike.%${kw}%`);
    }
    if (startDate) q = q.gte('date', startDate);
    if (endDate) q = q.lte('date', endDate);
    if (yearLevel) q = q.eq('year_level', yearLevel);
    if (status === 'active') q = q.eq('done', false);
    if (status === 'done') q = q.eq('done', true);
    if (wardFilter) q = q.eq('ward', wardFilter);

    // 교수님 필터 — professor 컬럼 OR 본문/메모에 이니셜 포함 (대소문자 무시)
    if (profFilter) {
      q = q.or(`professor.eq.${profFilter},text.ilike.%${profFilter}%,memo.ilike.%${profFilter}%`);
    }

    q = q.limit(200);

    const { data } = await q;
    setResults(data || []);
    setSearching(false);
  };

  const clearAll = () => {
    setKeyword(''); setStartDate(''); setEndDate('');
    setYearLevel(''); setStatus('all');
    setProfFilter(''); setWardFilter('');
    setResults([]); setHasSearched(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>🔍 검색</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        {/* 키워드 */}
        <input
          type="text"
          placeholder="키워드 (할일 내용, 메모)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          autoFocus
        />

        {/* 교수님별 빠른 필터 */}
        {professors && professors.length > 0 && (
          <div style={styles.profFilterRow}>
            <span style={styles.filterLabel}>교수님</span>
            <button onClick={() => setProfFilter('')}
              style={{ ...styles.profChip, background: !profFilter ? 'var(--text)' : 'var(--surface)', color: !profFilter ? 'var(--bg)' : 'var(--text-2)' }}>
              전체
            </button>
            {professors.map((p) => (
              <button key={p.id} onClick={() => setProfFilter(profFilter === p.initial ? '' : p.initial)}
                style={{ ...styles.profChip, background: profFilter === p.initial ? 'var(--text)' : 'var(--surface)', color: profFilter === p.initial ? 'var(--bg)' : 'var(--text)', fontWeight: 600 }}>
                {p.initial}
              </button>
            ))}
          </div>
        )}

        {/* 병동 필터 */}
        <div style={styles.profFilterRow}>
          <span style={styles.filterLabel}>병동</span>
          <button onClick={() => setWardFilter('')}
            style={{ ...styles.profChip, background: !wardFilter ? 'var(--text-3)' : 'var(--surface)', color: !wardFilter ? 'var(--bg)' : 'var(--text-2)' }}>
            전체
          </button>
          {WARD_CHIPS.map((w) => (
            <button key={w} onClick={() => setWardFilter(wardFilter === w ? '' : w)}
              style={{ ...styles.profChip, background: wardFilter === w ? 'var(--info)' : 'var(--surface)', color: wardFilter === w ? 'white' : 'var(--text-2)' }}>
              {w}
            </button>
          ))}
        </div>

        {/* 빠른 날짜 필터 */}
        <div style={styles.quickDateRow}>
          <span style={styles.filterLabel}>기간</span>
          <button onClick={() => { const t = todayStr(); setStartDate(t); setEndDate(t); }} style={styles.quickDateBtn}>
            오늘
          </button>
          <button onClick={() => { setStartDate(shiftDateStr(todayStr(), -7)); setEndDate(todayStr()); }} style={styles.quickDateBtn}>
            최근 7일
          </button>
          <button onClick={() => { setStartDate(shiftDateStr(todayStr(), -30)); setEndDate(todayStr()); }} style={styles.quickDateBtn}>
            최근 30일
          </button>
          <button onClick={() => { setStartDate(''); setEndDate(''); }} style={styles.quickDateBtn}>
            전체
          </button>
        </div>

        {/* 날짜 직접 선택 */}
        <div style={styles.dateRow}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="시작" />
          <span style={{ color: 'var(--text-3)' }}>~</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="종료" />
        </div>

        {/* 담당자 + 상태 */}
        <div style={styles.filterRow}>
          <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} style={{ flex: 1 }}>
            <option value="">담당자 전체</option>
            {YEAR_ORDER.map((k) => <option key={k} value={k}>{YEAR_LEVELS[k].full}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: 1 }}>
            <option value="all">진행/완료 전체</option>
            <option value="active">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>

        <div style={styles.btnRow}>
          <button onClick={clearAll} style={styles.clearBtn}>초기화</button>
          <button onClick={doSearch} style={styles.searchBtn} disabled={searching}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>

        {hasSearched && (
          <div style={styles.resultArea}>
            <div style={styles.resultCount}>{results.length}건 (최대 200건)</div>
            {results.length === 0 ? (
              <div style={styles.empty}>검색 결과가 없어요</div>
            ) : (
              <div style={styles.list}>
                {results.map((t) => <ResultRow key={t.id} task={t} onPhotoClick={onPhotoClick} professors={professors} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ task, onPhotoClick, professors = [] }) {
  const yl = YEAR_LEVELS[task.year_level] || YEAR_LEVELS.r1;
  const knownInitials = professors.map((p) => p.initial);
  const parsedText = parseProfessorBracket(task.text, knownInitials);
  const parsedMemo = parseProfessorBracket(task.memo, knownInitials);
  const displayText = parsedText.cleanText;
  const displayMemo = parsedMemo.cleanText;
  const displayProf = task.professor || parsedText.profInitial || parsedMemo.profInitial;
  return (
    <div style={styles.resultItem}>
      <div style={styles.resultFirst}>
        <span style={{ ...styles.badge, background: yl.bg, color: yl.color }}>{yl.label}</span>
        {task.due_time && <span style={styles.timeText}>{formatTimeLabel(task.due_time)}</span>}
        {task.ward && <span style={styles.wardSmall}>{task.ward}</span>}
        {displayProf && <span style={styles.profSmall}>{displayProf}</span>}
        <span style={{
          color: task.done ? 'var(--text-3)' : task.urgent ? 'var(--danger)' : 'var(--text)',
          textDecoration: task.done ? 'line-through' : 'none',
          fontSize: 14,
          flex: 1,
          wordBreak: 'break-word',
        }}>
          {displayText}
        </span>
        {task.done && <span style={styles.doneTag}>완료</span>}
      </div>
      {task.tags && task.tags.length > 0 && (
        <div style={styles.tagWrap}>
          {task.tags.map((tag) => <span key={tag} style={styles.tagSmall}>#{tag}</span>)}
        </div>
      )}
      {displayMemo && <div style={styles.memo}>{displayMemo}</div>}
      {task.photo_urls && task.photo_urls.length > 0 && (
        <button onClick={() => onPhotoClick(task.photo_urls[0], task.photo_urls)} style={styles.photoBtn}>
          📎 사진 {task.photo_urls.length}장
        </button>
      )}
      <div style={styles.metaRow}>
        <span>{formatDateLabel(task.date)}</span>
        {task.completed_by && <span> · ✓ {task.completed_by}</span>}
        {task.created_by && !task.done && <span> · {task.created_by}</span>}
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  profFilterRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  filterLabel: { fontSize: 11, color: 'var(--text-3)', marginRight: 2, width: 36 },
  profChip: { padding: '4px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 },
  dateRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 },
  quickDateRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  quickDateBtn: { padding: '4px 10px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)' },
  filterRow: { display: 'flex', gap: 6, marginTop: 8 },
  btnRow: { display: 'flex', gap: 8, marginTop: 12 },
  clearBtn: { flex: 1, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)' },
  searchBtn: { flex: 2, padding: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontWeight: 500 },
  resultArea: { marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' },
  resultCount: { fontSize: 11, color: 'var(--text-3)', marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' },
  resultItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 },
  resultFirst: { display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 100, flexShrink: 0 },
  timeText: { fontSize: 11, color: 'var(--info)' },
  wardSmall: { fontSize: 10, padding: '1px 5px', background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 4 },
  profSmall: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  doneTag: { fontSize: 10, color: 'var(--success)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagSmall: { fontSize: 10, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 100 },
  memo: { fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.4, wordBreak: 'break-word' },
  photoBtn: { fontSize: 10, color: 'var(--info)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4, marginTop: 4 },
  metaRow: { fontSize: 10, color: 'var(--text-3)', marginTop: 6 },
};
