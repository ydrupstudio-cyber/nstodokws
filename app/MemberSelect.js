'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS } from '../lib/config';

export default function MemberSelect({ members, onSelect, onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newYearLevel, setNewYearLevel] = useState('r1');

  const residents = members.filter((m) => m.role === 'resident');
  const pas = members.filter((m) => m.role === 'pa');

  const addMember = async () => {
    const name = newName.trim();
    if (!name) return;
    const role = newYearLevel === 'pa' ? 'pa' : 'resident';
    const { data, error } = await supabase
      .from('members')
      .insert([{ name, role, year_level: newYearLevel }])
      .select()
      .single();
    if (!error && data) {
      setNewName('');
      setAdding(false);
      onRefresh();
      if (window.confirm(`"${name}"으로 시작하시겠어요?`)) {
        onSelect(data);
      }
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title} className="display-font">NS_To-Do</h1>
          <p style={styles.subtitle}>by WS.Kim</p>
          <p style={styles.askName}>본인을 선택해주세요</p>
        </header>

        {members.length === 0 && (
          <div style={styles.emptyHint}>
            아직 등록된 의국원이 없어요.<br />
            아래 "+ 의국원 추가"를 눌러 본인 정보를 먼저 입력해주세요.
          </div>
        )}

        {residents.length > 0 && (
          <section style={styles.group}>
            <div style={styles.groupHeader}>
              <span style={styles.groupLabel}>전공의</span>
              <span style={styles.groupCount}>{residents.length}명</span>
            </div>
            <div style={styles.grid}>
              {residents.map((m) => (
                <MemberCard key={m.id} member={m} onClick={() => onSelect(m)} />
              ))}
            </div>
          </section>
        )}

        {pas.length > 0 && (
          <section style={styles.group}>
            <div style={styles.groupHeader}>
              <span style={styles.groupLabel}>PA</span>
              <span style={styles.groupCount}>{pas.length}명</span>
            </div>
            <div style={styles.grid}>
              {pas.map((m) => (
                <MemberCard key={m.id} member={m} onClick={() => onSelect(m)} />
              ))}
            </div>
          </section>
        )}

        {adding ? (
          <div style={styles.addForm}>
            <input type="text" placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <select value={newYearLevel} onChange={(e) => setNewYearLevel(e.target.value)} style={{ marginTop: 8 }}>
              <option value="r1">전공의 1년차</option>
              <option value="r2">전공의 2년차</option>
              <option value="r3">전공의 3년차</option>
              <option value="r4">전공의 4년차</option>
              <option value="pa">PA</option>
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={addMember} style={styles.addBtn}>등록</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={styles.addMemberBtn}>+ 의국원 추가</button>
        )}

        <footer style={styles.footer}>
          한 번 선택하면 이 기기에 저장돼요. 다른 사람이라면 설정에서 변경 가능.
        </footer>
      </div>
    </main>
  );
}

function MemberCard({ member, onClick }) {
  const yl = YEAR_LEVELS[member.year_level] || YEAR_LEVELS.r1;
  return (
    <button onClick={onClick} style={styles.memberCard}>
      <div style={{ ...styles.badge, background: yl.bg, color: yl.color }}>{yl.label}</div>
      <div style={styles.memberName}>{member.name}</div>
    </button>
  );
}

const styles = {
  main: { minHeight: '100vh', padding: '24px 16px 40px' },
  container: { maxWidth: 560, margin: '0 auto' },
  header: { textAlign: 'center', padding: '20px 0 28px' },
  title: { fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 12, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.1em' },
  askName: { fontSize: 14, color: 'var(--text-2)', marginTop: 24 },
  emptyHint: {
    textAlign: 'center', padding: '32px 20px', background: 'var(--surface-2)',
    borderRadius: 12, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, marginBottom: 16,
  },
  group: { marginBottom: 24 },
  groupHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, padding: '0 4px' },
  groupLabel: { fontSize: 13, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.05em' },
  groupCount: { fontSize: 12, color: 'var(--text-3)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 },
  memberCard: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    transition: 'all 0.15s',
  },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100 },
  memberName: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  addMemberBtn: {
    width: '100%', padding: '14px', marginTop: 8, background: 'transparent',
    border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 14,
  },
  addForm: { background: 'var(--surface-2)', padding: 12, borderRadius: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, padding: 10, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text-2)',
  },
  addBtn: { flex: 1, padding: 10, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontWeight: 500 },
  footer: { textAlign: 'center', padding: '32px 0 0', fontSize: 11, color: 'var(--text-3)' },
};
