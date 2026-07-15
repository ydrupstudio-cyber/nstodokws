'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS, YEAR_ORDER, ASSIGNEE_ORDER, DEFAULT_ASSIGNEE } from '../lib/config';
import { applyTheme } from '../lib/theme';
import {
  isPushSupported, getNotificationPermission, subscribeToPush, unsubscribeFromPush,
  checkSubscriptionStatus,
} from '../lib/push';

export default function SettingsModal({ onClose, currentMember, onMemberChange }) {
  const [tab, setTab] = useState('main');
  const [theme, setTheme] = useState('system');
  const [members, setMembers] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [professors, setProfessors] = useState([]);

  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'system');
    loadMembers();
    loadRecurring();
    loadProfessors();
  }, []);

  async function loadMembers() {
    const { data } = await supabase.from('members').select('*').order('role').order('year_level').order('id');
    setMembers(data || []);
  }
  async function loadRecurring() {
    const { data } = await supabase.from('recurring_tasks').select('*').order('created_at', { ascending: false });
    setRecurring(data || []);
  }
  async function loadProfessors() {
    const { data } = await supabase.from('professors').select('*').order('display_order').order('id');
    setProfessors(data || []);
  }

  const changeTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    applyTheme(t);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          {tab === 'main' ? (
            <>
              <h2 style={styles.title}>설정</h2>
              <button onClick={onClose} style={styles.closeBtn}>×</button>
            </>
          ) : (
            <>
              <button onClick={() => setTab('main')} style={styles.backBtn}>‹ 뒤로</button>
              <h2 style={styles.title}>
                {tab === 'members' ? '의국원 명단'
                : tab === 'recurring' ? '반복 할일'
                : tab === 'professors' ? '교수님 이니셜'
                : tab === 'push' ? '알림 설정'
                : ''}
              </h2>
              <div style={{ width: 40 }} />
            </>
          )}
        </div>

        {tab === 'main' && (
          <div style={styles.content}>
            <div style={styles.currentBox}>
              <div style={styles.boxLabel}>현재 접속</div>
              <div style={styles.currentName}>{currentMember.name}</div>
              <div style={styles.currentRole}>{YEAR_LEVELS[currentMember.year_level]?.full}</div>
              <button onClick={onMemberChange} style={styles.changeBtn}>본인 변경</button>
            </div>

            <button onClick={() => setTab('push')} style={styles.menuRow}>
              <span>🔔 알림 설정</span><span style={styles.arrow}>›</span>
            </button>
            <button onClick={() => setTab('members')} style={styles.menuRow}>
              <span>의국원 명단 관리</span><span style={styles.arrow}>›</span>
            </button>
            <button onClick={() => setTab('professors')} style={styles.menuRow}>
              <span>교수님 이니셜 관리</span><span style={styles.arrow}>›</span>
            </button>
            <button onClick={() => setTab('recurring')} style={styles.menuRow}>
              <span>반복 할일 관리</span><span style={styles.arrow}>›</span>
            </button>

            <div style={styles.themeSection}>
              <div style={styles.boxLabel}>화면 테마</div>
              <div style={styles.themeBtns}>
                {[
                  { k: 'light', label: '☀ 라이트' },
                  { k: 'dark', label: '☾ 다크' },
                  { k: 'system', label: '⚙ 자동' },
                ].map((t) => (
                  <button key={t.k} onClick={() => changeTheme(t.k)}
                    style={{ ...styles.themeBtn, background: theme === t.k ? 'var(--text)' : 'var(--surface)', color: theme === t.k ? 'var(--bg)' : 'var(--text)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'push' && <PushTab currentMember={currentMember} />}
        {tab === 'members' && <MembersTab members={members} onReload={loadMembers} />}
        {tab === 'professors' && <ProfessorsTab professors={professors} onReload={loadProfessors} />}
        {tab === 'recurring' && <RecurringTab recurring={recurring} onReload={loadRecurring} />}
      </div>
    </div>
  );
}

function PushTab({ currentMember }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    if (!await isPushSupported()) {
      setStatus({ supported: false });
      return;
    }
    const s = await checkSubscriptionStatus(currentMember.id);
    setStatus(s);
  }

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush(currentMember.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush(currentMember.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div style={styles.empty}>확인 중…</div>;

  if (!status.supported) {
    return (
      <div style={styles.content}>
        <div style={styles.pushBox}>
          <div style={styles.pushIcon}>📵</div>
          <div style={styles.pushTitle}>이 브라우저는 알림을 지원하지 않아요</div>
          <div style={styles.pushDesc}>
            iPhone Safari에서는 <strong>홈 화면에 추가한 후</strong> 알림이 가능해요.<br /><br />
            Android는 Chrome, 삼성 인터넷에서 작동합니다.
          </div>
        </div>
      </div>
    );
  }

  if (status.permission === 'denied') {
    return (
      <div style={styles.content}>
        <div style={styles.pushBox}>
          <div style={styles.pushIcon}>🚫</div>
          <div style={styles.pushTitle}>알림이 차단되어 있어요</div>
          <div style={styles.pushDesc}>
            브라우저 설정에서 이 사이트의 알림을 허용한 후<br />
            다시 이 화면으로 돌아와주세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.content}>
      <div style={styles.pushBox}>
        <div style={styles.pushIcon}>{status.subscribed && status.enabled ? '🔔' : '🔕'}</div>
        <div style={styles.pushTitle}>
          {status.subscribed && status.enabled ? '알림 활성화됨' : '알림이 꺼져있어요'}
        </div>
        <div style={styles.pushDesc}>
          긴급 할일이 추가되거나<br />
          시간 2시간 이내로 임박했을 때<br />
          푸시 알림을 보내드려요.
        </div>
        {status.subscribed && status.enabled ? (
          <button onClick={disable} disabled={busy} style={styles.disableBtn}>
            {busy ? '...' : '알림 끄기'}
          </button>
        ) : (
          <button onClick={enable} disabled={busy} style={styles.enableBtn}>
            {busy ? '...' : '알림 켜기'}
          </button>
        )}
        {error && <div style={styles.errorMsg}>{error}</div>}
      </div>

      <p style={styles.hintText}>
        ⓘ 알림 설정은 본인 프로필에 저장돼요. 다른 기기에서도 본인으로 접속하면<br />
        그 기기에서도 알림을 받을 수 있어요 (각 기기에서 한 번 켜야 함).
      </p>
    </div>
  );
}

function MembersTab({ members, onReload }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [yearLevel, setYearLevel] = useState('r1');

  const addMember = async () => {
    if (!name.trim()) return;
    const role = yearLevel === 'pa' ? 'pa' : 'resident';
    await supabase.from('members').insert([{ name: name.trim(), role, year_level: yearLevel }]);
    setName(''); setAdding(false); onReload();
  };
  const toggleActive = async (m) => {
    await supabase.from('members').update({ active: !m.active }).eq('id', m.id);
    onReload();
  };
  const removeMember = async (m) => {
    if (!window.confirm(`"${m.name}"을 삭제할까요?`)) return;
    await supabase.from('members').delete().eq('id', m.id);
    onReload();
  };

  return (
    <div style={styles.content}>
      <p style={styles.hintText}>등록된 인원은 본인 선택 화면에 표시돼요.</p>
      {members.length === 0 && <div style={styles.empty}>등록된 인원이 없어요.</div>}
      {members.map((m) => {
        const yl = YEAR_LEVELS[m.year_level] || YEAR_LEVELS.r1;
        return (
          <div key={m.id} style={{ ...styles.memberItem, opacity: m.active ? 1 : 0.5 }}>
            <span style={{ ...styles.memberBadge, background: yl.bg, color: yl.color }}>{yl.label}</span>
            <span style={styles.memberName}>{m.name}</span>
            <button onClick={() => toggleActive(m)} style={styles.smallBtn}>{m.active ? '비활성' : '활성'}</button>
            <button onClick={() => removeMember(m)} style={{ ...styles.smallBtn, color: 'var(--danger)' }}>삭제</button>
          </div>
        );
      })}
      {adding ? (
        <div style={styles.addBox}>
          <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} style={{ marginTop: 8 }}>
            <option value="r1">전공의 1년차</option>
            <option value="r2">전공의 2년차</option>
            <option value="r3">전공의 3년차</option>
            <option value="r4">전공의 4년차</option>
            <option value="pa">PA</option>
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
            <button onClick={addMember} style={styles.confirmBtn}>등록</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={styles.addNewBtn}>+ 의국원 추가</button>
      )}
    </div>
  );
}

function ProfessorsTab({ professors, onReload }) {
  const [adding, setAdding] = useState(false);
  const [initial, setInitial] = useState('');
  const [name, setName] = useState('');

  const addProf = async () => {
    const init = initial.trim().toUpperCase();
    if (!init || init.length !== 1) {
      alert('이니셜은 영문 1글자로 입력해주세요.');
      return;
    }
    const { error } = await supabase.from('professors').insert([{
      initial: init,
      name: name.trim() || null,
      display_order: professors.length + 1,
    }]);
    if (error) {
      alert('등록 실패 (이미 존재하는 이니셜일 수 있어요): ' + error.message);
      return;
    }
    setInitial(''); setName(''); setAdding(false); onReload();
  };
  const removeProf = async (p) => {
    if (!window.confirm(`교수님 [${p.initial}]을 삭제할까요?`)) return;
    await supabase.from('professors').delete().eq('id', p.id);
    onReload();
  };

  return (
    <div style={styles.content}>
      <p style={styles.hintText}>
        할일 입력 시 교수님 이니셜을 선택하면 메모 앞에 [X] 표시가 자동으로 들어가요.<br />
        검색에서도 활용됩니다.
      </p>
      {professors.length === 0 && <div style={styles.empty}>등록된 교수님이 없어요.</div>}
      <div style={styles.profGrid}>
        {professors.map((p) => (
          <div key={p.id} style={styles.profItem}>
            <div style={styles.profInitial}>{p.initial}</div>
            <div style={styles.profName}>{p.name || '—'}</div>
            <button onClick={() => removeProf(p)} style={styles.profRemove}>×</button>
          </div>
        ))}
      </div>
      {adding ? (
        <div style={styles.addBox}>
          <input type="text" placeholder="이니셜 (영문 1글자)" value={initial} maxLength={1}
            onChange={(e) => setInitial(e.target.value.toUpperCase())} autoFocus />
          <input type="text" placeholder="이름 (선택)" value={name} onChange={(e) => setName(e.target.value)}
            style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
            <button onClick={addProf} style={styles.confirmBtn}>등록</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={styles.addNewBtn}>+ 교수님 추가</button>
      )}
    </div>
  );
}

function RecurringTab({ recurring, onReload }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [yearLevel, setYearLevel] = useState(DEFAULT_ASSIGNEE);
  const [repeatType, setRepeatType] = useState('daily');
  const [weekDays, setWeekDays] = useState([1, 2, 3, 4, 5]);
  const [time, setTime] = useState('');

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const toggleDay = (d) => {
    if (weekDays.includes(d)) setWeekDays(weekDays.filter((x) => x !== d));
    else setWeekDays([...weekDays, d].sort());
  };

  const addRecurring = async () => {
    if (!text.trim()) return;
    await supabase.from('recurring_tasks').insert([{
      text: text.trim(), memo: memo.trim() || null,
      year_level: yearLevel, repeat_type: repeatType,
      repeat_days: repeatType === 'weekly' ? weekDays : [],
      due_time: time || null,
    }]);
    setText(''); setMemo(''); setTime(''); setAdding(false); onReload();
  };
  const toggleActive = async (rt) => {
    await supabase.from('recurring_tasks').update({ active: !rt.active }).eq('id', rt.id);
    onReload();
  };
  const remove = async (rt) => {
    if (!window.confirm(`"${rt.text}"을 삭제할까요?`)) return;
    await supabase.from('recurring_tasks').delete().eq('id', rt.id);
    onReload();
  };
  const labelFor = (rt) => {
    if (rt.repeat_type === 'daily') return '매일';
    if (rt.repeat_type === 'weekly') return '매주 ' + rt.repeat_days.map((d) => dayLabels[d]).join(',');
    return '';
  };

  return (
    <div style={styles.content}>
      <p style={styles.hintText}>자정에 자동으로 그날의 할일 목록에 추가돼요.</p>
      {recurring.length === 0 && <div style={styles.empty}>아직 등록된 반복 할일이 없어요.</div>}
      {recurring.map((rt) => {
        const yl = YEAR_LEVELS[rt.year_level] || YEAR_LEVELS.r1;
        return (
          <div key={rt.id} style={{ ...styles.recurringItem, opacity: rt.active ? 1 : 0.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ ...styles.memberBadge, background: yl.bg, color: yl.color }}>{yl.label}</span>
                {rt.due_time && <span style={{ fontSize: 11, color: 'var(--info)' }}>{rt.due_time.slice(0, 5)}</span>}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{rt.text}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{labelFor(rt)}</div>
            </div>
            <button onClick={() => toggleActive(rt)} style={styles.smallBtn}>{rt.active ? '끄기' : '켜기'}</button>
            <button onClick={() => remove(rt)} style={{ ...styles.smallBtn, color: 'var(--danger)' }}>삭제</button>
          </div>
        );
      })}
      {adding ? (
        <div style={styles.addBox}>
          <input type="text" placeholder="할일 내용" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <textarea placeholder="메모 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} rows={1} style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} style={{ flex: 1 }}>
              {ASSIGNEE_ORDER.map((k) => <option key={k} value={k}>{YEAR_LEVELS[k].full}</option>)}
            </select>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['daily', 'weekly'].map((type) => (
              <button key={type} onClick={() => setRepeatType(type)}
                style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: repeatType === type ? 'var(--text)' : 'var(--surface)', color: repeatType === type ? 'var(--bg)' : 'var(--text)', fontSize: 13 }}>
                {type === 'daily' ? '매일' : '매주'}
              </button>
            ))}
          </div>
          {repeatType === 'weekly' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {dayLabels.map((label, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  style={{ flex: 1, padding: '8px 0', border: '1px solid var(--border)', borderRadius: 6, background: weekDays.includes(i) ? 'var(--info)' : 'var(--surface)', color: weekDays.includes(i) ? 'var(--bg)' : 'var(--text-2)', fontSize: 13 }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
            <button onClick={addRecurring} style={styles.confirmBtn}>등록</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={styles.addNewBtn}>+ 반복 할일 추가</button>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: 500 },
  closeBtn: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8, textAlign: 'right' },
  backBtn: { width: 'auto', padding: '0 4px', fontSize: 14, color: 'var(--text-2)' },
  content: { display: 'flex', flexDirection: 'column', gap: 12 },
  currentBox: { background: 'var(--surface-2)', borderRadius: 12, padding: 16, textAlign: 'center' },
  boxLabel: { fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 6 },
  currentName: { fontSize: 18, fontWeight: 500 },
  currentRole: { fontSize: 12, color: 'var(--text-2)', marginTop: 2 },
  changeBtn: { marginTop: 12, padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' },
  menuRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text)', textAlign: 'left' },
  arrow: { color: 'var(--text-3)' },
  themeSection: { background: 'var(--surface-2)', padding: 14, borderRadius: 12 },
  themeBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 },
  themeBtn: { padding: '10px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 },
  hintText: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, padding: '0 4px', marginBottom: 4 },
  empty: { textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 },
  memberItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 },
  memberBadge: { fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 100, flexShrink: 0 },
  memberName: { flex: 1, fontSize: 14, fontWeight: 500 },
  smallBtn: { padding: '4px 10px', fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 6 },
  recurringItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 },
  addBox: { background: 'var(--surface-2)', padding: 12, borderRadius: 12 },
  cancelBtn: { flex: 1, padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)' },
  confirmBtn: { flex: 1, padding: 10, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontWeight: 500 },
  addNewBtn: { width: '100%', padding: 14, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 14 },
  profGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 },
  profItem: { position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' },
  profInitial: { fontSize: 24, fontWeight: 700, color: 'var(--text)' },
  profName: { fontSize: 11, color: 'var(--text-2)', marginTop: 2 },
  profRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, fontSize: 14, color: 'var(--text-3)', borderRadius: 4 },
  pushBox: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center' },
  pushIcon: { fontSize: 48, marginBottom: 12 },
  pushTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 },
  pushDesc: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 },
  enableBtn: { padding: '12px 28px', background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontWeight: 500, fontSize: 14 },
  disableBtn: { padding: '12px 28px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 },
  errorMsg: { marginTop: 12, padding: 10, background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 12 },
};
