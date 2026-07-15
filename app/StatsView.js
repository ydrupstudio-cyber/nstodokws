'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS } from '../lib/config';
import { todayStr, shiftDateStr } from '../lib/utils';

export default function StatsView({ onClose }) {
  const [period, setPeriod] = useState('week'); // week, month
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [period]);

  async function load() {
    setLoading(true);
    const days = period === 'week' ? 7 : 30;
    const startDate = shiftDateStr(todayStr(), -days + 1);
    const endDate = todayStr();

    const { data: todos } = await supabase
      .from('todos')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (!todos) {
      setLoading(false);
      return;
    }

    // 통계 계산
    const total = todos.length;
    const completed = todos.filter((t) => t.done).length;
    const urgentTotal = todos.filter((t) => t.urgent).length;

    // 의국원별 완료 건수
    const byMember = {};
    todos.forEach((t) => {
      if (t.done && t.completed_by) {
        byMember[t.completed_by] = (byMember[t.completed_by] || 0) + 1;
      }
    });
    const topMembers = Object.entries(byMember)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 연차별 분포
    const byYear = {};
    todos.forEach((t) => {
      const yl = t.year_level || 'r1';
      byYear[yl] = (byYear[yl] || 0) + 1;
    });

    // 태그별 (Top 8)
    const byTag = {};
    todos.forEach((t) => (t.tags || []).forEach((tag) => {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }));
    const topTags = Object.entries(byTag)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // 병동별
    const byWard = {};
    todos.forEach((t) => {
      if (t.ward) byWard[t.ward] = (byWard[t.ward] || 0) + 1;
    });

    // 교수님별
    const byProf = {};
    todos.forEach((t) => {
      if (t.professor) byProf[t.professor] = (byProf[t.professor] || 0) + 1;
    });

    // 평균 완료 시간 (등록 → 완료)
    let totalMinutes = 0, countMinutes = 0;
    todos.forEach((t) => {
      if (t.done && t.completed_at && t.created_at) {
        const diff = (new Date(t.completed_at) - new Date(t.created_at)) / 60000;
        if (diff > 0) {
          totalMinutes += diff;
          countMinutes++;
        }
      }
    });
    const avgMinutes = countMinutes > 0 ? Math.round(totalMinutes / countMinutes) : 0;

    setStats({
      total, completed, urgentTotal,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgMinutes,
      topMembers, byYear, topTags, byWard, byProf,
    });
    setLoading(false);
  }

  const formatDuration = (mins) => {
    if (mins < 60) return `${mins}분`;
    return `${Math.floor(mins / 60)}시간 ${mins % 60}분`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>📊 통계</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        <div style={styles.periodTabs}>
          <button onClick={() => setPeriod('week')}
            style={{ ...styles.tab, background: period === 'week' ? 'var(--text)' : 'var(--surface)', color: period === 'week' ? 'var(--bg)' : 'var(--text-2)' }}>
            지난 7일
          </button>
          <button onClick={() => setPeriod('month')}
            style={{ ...styles.tab, background: period === 'month' ? 'var(--text)' : 'var(--surface)', color: period === 'month' ? 'var(--bg)' : 'var(--text-2)' }}>
            지난 30일
          </button>
        </div>

        {loading || !stats ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : (
          <>
            {/* Summary */}
            <div style={styles.summaryGrid}>
              <StatCard label="총 할일" value={stats.total} />
              <StatCard label="완료" value={stats.completed} sub={`${stats.completionRate}%`} accent="success" />
              <StatCard label="긴급" value={stats.urgentTotal} accent="danger" />
              <StatCard label="평균 처리 시간" value={formatDuration(stats.avgMinutes)} small />
            </div>

            {/* Members */}
            {stats.topMembers.length > 0 && (
              <Section title="의국원별 완료 건수">
                {stats.topMembers.map(([name, count], i) => (
                  <BarRow key={name} label={`${i + 1}. ${name}`} value={count} max={stats.topMembers[0][1]} />
                ))}
              </Section>
            )}

            {/* Year levels */}
            {Object.keys(stats.byYear).length > 0 && (
              <Section title="담당자 연차별">
                {Object.entries(stats.byYear).sort((a, b) => b[1] - a[1]).map(([yl, count]) => {
                  const meta = YEAR_LEVELS[yl] || YEAR_LEVELS.r1;
                  return (
                    <BarRow key={yl} label={meta.full} value={count}
                      max={Math.max(...Object.values(stats.byYear))} color={meta.color} />
                  );
                })}
              </Section>
            )}

            {/* Wards */}
            {Object.keys(stats.byWard).length > 0 && (
              <Section title="병동별">
                {Object.entries(stats.byWard).sort((a, b) => b[1] - a[1]).map(([w, count]) => (
                  <BarRow key={w} label={w} value={count} max={Math.max(...Object.values(stats.byWard))} />
                ))}
              </Section>
            )}

            {/* Professors */}
            {Object.keys(stats.byProf).length > 0 && (
              <Section title="교수님별">
                {Object.entries(stats.byProf).sort((a, b) => b[1] - a[1]).map(([p, count]) => (
                  <BarRow key={p} label={p} value={count} max={Math.max(...Object.values(stats.byProf))} />
                ))}
              </Section>
            )}

            {/* Tags */}
            {stats.topTags.length > 0 && (
              <Section title="태그별 (Top 8)">
                {stats.topTags.map(([t, count]) => (
                  <BarRow key={t} label={`#${t}`} value={count} max={stats.topTags[0][1]} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, small }) {
  const color = accent === 'success' ? 'var(--success)' : accent === 'danger' ? 'var(--danger)' : 'var(--text)';
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color, fontSize: small ? 16 : 24 }}>
        {value}{sub && <span style={styles.statSub}> ({sub})</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.sectionWrap}>
      <h3 style={styles.sectionHead}>{title}</h3>
      <div style={styles.barList}>{children}</div>
    </div>
  );
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={styles.barRow}>
      <span style={styles.barLabel}>{label}</span>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%`, background: color || 'var(--info)' }} />
      </div>
      <span style={styles.barValue}>{value}</span>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  periodTabs: { display: 'flex', gap: 6, marginBottom: 16 },
  tab: { flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 11, color: 'var(--text-3)', marginBottom: 6 },
  statValue: { fontWeight: 600 },
  statSub: { fontSize: 12, color: 'var(--text-3)', fontWeight: 400 },
  sectionWrap: { marginBottom: 20 },
  sectionHead: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.03em' },
  barList: { display: 'flex', flexDirection: 'column', gap: 6 },
  barRow: { display: 'flex', alignItems: 'center', gap: 8 },
  barLabel: { width: 90, fontSize: 12, color: 'var(--text)', flexShrink: 0 },
  barTrack: { flex: 1, height: 18, background: 'var(--surface-2)', borderRadius: 4, position: 'relative' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  barValue: { width: 30, fontSize: 12, color: 'var(--text-2)', textAlign: 'right' },
};
