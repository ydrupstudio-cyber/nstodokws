'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS } from '../lib/config';
import { todayStr, shiftDateStr, formatShortDateLabel, formatTimeLabel, parseProfessorBracket } from '../lib/utils';

export default function UpcomingSection({ days, expanded, onToggle, onDateClick, professors = [] }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const knownInitials = professors.map((p) => p.initial);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('upcoming-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [days]);

  async function load() {
    setLoading(true);
    const startDate = shiftDateStr(todayStr(), 1);
    const endDate = shiftDateStr(todayStr(), days);
    const { data } = await supabase
      .from('todos')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('due_time', { ascending: true, nullsFirst: false });
    setTasks(data || []);
    setLoading(false);
  }

  // 날짜별 그룹화
  const byDate = {};
  tasks.forEach((t) => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });
  const dates = Object.keys(byDate).sort();
  const totalCount = tasks.length;

  return (
    <section style={styles.section}>
      <button onClick={onToggle} style={styles.header}>
        <span style={styles.title}>⏭ 다가오는 일정</span>
        <span style={styles.subtitle}>({days}일 이내)</span>
        <span style={styles.count}>{totalCount}</span>
        <span style={styles.toggle}>{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div style={styles.body} className="fade-in">
          {loading ? (
            <div style={styles.empty}>불러오는 중…</div>
          ) : dates.length === 0 ? (
            <div style={styles.empty}>다가오는 일정 없음</div>
          ) : (
            dates.map((date) => (
              <div key={date} style={styles.dateGroup}>
                <button onClick={() => onDateClick(date)} style={styles.dateHeader}>
                  <span style={styles.dateLabel}>{formatShortDateLabel(date)}</span>
                  <span style={styles.dateCount}>{byDate[date].length}</span>
                  <span style={styles.gotoArrow}>→</span>
                </button>
                <div style={styles.taskList}>
                  {byDate[date].map((t) => {
                    const yl = YEAR_LEVELS[t.year_level] || YEAR_LEVELS.r1;
                    const parsedText = parseProfessorBracket(t.text, knownInitials);
                    const parsedMemo = parseProfessorBracket(t.memo, knownInitials);
                    const displayText = parsedText.cleanText;
                    const displayProf = t.professor || parsedText.profInitial || parsedMemo.profInitial;
                    return (
                      <div key={t.id} style={styles.taskRow}>
                        <span style={{ ...styles.badge, background: yl.bg, color: yl.color }}>
                          {yl.label}
                        </span>
                        {t.due_time && (
                          <span style={styles.time}>{formatTimeLabel(t.due_time)}</span>
                        )}
                        {t.ward && <span style={styles.ward}>{t.ward}</span>}
                        {displayProf && <span style={styles.prof}>{displayProf}</span>}
                        <span style={{ ...styles.text, fontWeight: t.urgent ? 500 : 400, color: t.urgent ? 'var(--danger)' : 'var(--text)' }}>
                          {displayText}
                        </span>
                        {t.urgent && <span style={styles.urgent}>긴급</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: 28, marginBottom: 16 },
  header: {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10,
    border: '1px solid var(--border)',
  },
  title: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  subtitle: { fontSize: 11, color: 'var(--text-3)' },
  count: { fontSize: 11, color: 'var(--text-2)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 10, marginLeft: 'auto' },
  toggle: { color: 'var(--text-3)', fontSize: 12 },
  body: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 12 },
  dateGroup: { background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' },
  dateHeader: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '8px 12px', background: 'var(--surface-2)',
    borderBottom: '1px solid var(--border)',
  },
  dateLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text)' },
  dateCount: { fontSize: 10, color: 'var(--text-3)', background: 'var(--surface)', padding: '1px 7px', borderRadius: 10 },
  gotoArrow: { marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 },
  taskList: { padding: '6px 0' },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    flexWrap: 'wrap',
  },
  badge: { fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 100 },
  time: { fontSize: 11, color: 'var(--info)', fontWeight: 500 },
  ward: { fontSize: 10, padding: '1px 5px', background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 4 },
  prof: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  text: { fontSize: 13, flex: 1, wordBreak: 'break-word' },
  urgent: { fontSize: 9, fontWeight: 600, color: 'var(--danger)', border: '1px solid var(--danger)', padding: '1px 5px', borderRadius: 3 },
};
