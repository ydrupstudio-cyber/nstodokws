'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  YEAR_LEVELS, ASSIGNEE_ORDER, DEFAULT_ASSIGNEE,
  WARD_CHIPS, UPCOMING_DAYS,
} from '../lib/config';
import {
  todayStr, shiftDateStr, daysBetween, formatDateLabel, formatShortDateLabel,
  extractTimeFromText, extractTags, stripTags, extractWard,
  isTimeNear, isTimePast, formatTimeLabel, compressPhoto,
} from '../lib/utils';
import { useTheme } from '../lib/theme';
import { registerServiceWorker } from '../lib/push';
import MemberSelect from './MemberSelect';
import TaskRow from './TaskRow';
import SettingsModal from './SettingsModal';
import SearchView from './SearchView';
import PhotoViewer from './PhotoViewer';
import DutyScheduleModal from './DutyScheduleModal';
import NoticesModal from './NoticesModal';
import StatsView from './StatsView';
import UpcomingSection from './UpcomingSection';
import TemplatesPicker from './TemplatesPicker';
import EditTaskModal from './EditTaskModal';

const VISIBLE_DAYS = 180;

export default function Home() {
  useTheme();
  const [currentMember, setCurrentMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 입력 상태
  const [newTask, setNewTask] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [newUrgent, setNewUrgent] = useState(false);
  const [newYearLevel, setNewYearLevel] = useState(DEFAULT_ASSIGNEE);
  const [newTime, setNewTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newWard, setNewWard] = useState(null);
  const [newProfessor, setNewProfessor] = useState(null);
  const [newTargetDate, setNewTargetDate] = useState(todayStr());
  const [showDateForNew, setShowDateForNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // UI
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAttending, setShowAttending] = useState(false);
  const [showResident, setShowResident] = useState(false);
  const [showNotices, setShowNotices] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [noticeCount, setNoticeCount] = useState(0);

  // 토글 상태 (localStorage)
  const [doneCollapsed, setDoneCollapsed] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [sortMode, setSortMode] = useState('time'); // time, ward, professor, assignee
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [, forceUpdate] = useState(0);
  const fileInputRef = useRef(null);

  // Service Worker 등록
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // 1분마다 시간 임박 체크
  useEffect(() => {
    forceUpdate(v => v + 1);
    const t = setInterval(() => {
      forceUpdate(v => v + 1);
      // 1분마다 서버에 시간 임박 체크 요청
      if (currentMember) {
        fetch('/api/push/check-time', { method: 'POST' }).catch(() => {});
      }
    }, 60000);
    return () => clearInterval(t);
  }, [currentMember]);

  // 토글 상태 로드
  useEffect(() => {
    setDoneCollapsed(localStorage.getItem('doneCollapsed') === 'true');
    setUpcomingExpanded(localStorage.getItem('upcomingExpanded') === 'true');
    setSortMode(localStorage.getItem('sortMode') || 'time');
  }, []);

  const toggleDoneCollapsed = () => {
    const next = !doneCollapsed;
    setDoneCollapsed(next);
    localStorage.setItem('doneCollapsed', String(next));
  };
  const toggleUpcoming = () => {
    const next = !upcomingExpanded;
    setUpcomingExpanded(next);
    localStorage.setItem('upcomingExpanded', String(next));
  };
  const changeSortMode = (m) => {
    setSortMode(m);
    localStorage.setItem('sortMode', m);
    setShowSortMenu(false);
  };

  // 멤버 로드
  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('members').select('*').eq('active', true)
      .order('display_order', { ascending: true }).order('id', { ascending: true });
    setMembers(data || []);
  }, []);

  // 교수님 로드
  const loadProfessors = useCallback(async () => {
    const { data } = await supabase
      .from('professors').select('*').eq('active', true)
      .order('display_order', { ascending: true });
    setProfessors(data || []);
  }, []);

  // 초기
  useEffect(() => {
    loadMembers();
    loadProfessors();
    const savedId = localStorage.getItem('memberId');
    if (savedId) {
      supabase.from('members').select('*').eq('id', savedId).eq('active', true).single()
        .then(({ data }) => {
          if (data) setCurrentMember(data);
          else localStorage.removeItem('memberId');
        });
    }
  }, [loadMembers, loadProfessors]);

  // 실시간 접속자
  useEffect(() => {
    if (!currentMember) return;
    const channel = supabase.channel('online-users', {
      config: { presence: { key: String(currentMember.id) } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: currentMember.id, name: currentMember.name, online_at: new Date().toISOString() });
        }
      });
    return () => supabase.removeChannel(channel);
  }, [currentMember]);

  // 공지 카운트
  const loadNoticeCount = useCallback(async () => {
    const { count } = await supabase.from('notices').select('*', { count: 'exact', head: true });
    setNoticeCount(count || 0);
  }, []);
  useEffect(() => {
    if (!currentMember) return;
    loadNoticeCount();
    const ch = supabase.channel('notices-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => loadNoticeCount())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentMember, loadNoticeCount]);

  // 반복 할일 생성기
  useEffect(() => {
    if (!currentMember) return;
    if (currentDate !== todayStr()) return;
    generateRecurringForToday();
  }, [currentMember, currentDate]);

  async function generateRecurringForToday() {
    const today = todayStr();
    const { data: recurring } = await supabase.from('recurring_tasks').select('*').eq('active', true);
    if (!recurring) return;
    const dow = new Date().getDay();
    const dom = new Date().getDate();
    for (const rt of recurring) {
      if (rt.last_generated_date === today) continue;
      let shouldGen = false;
      if (rt.repeat_type === 'daily') shouldGen = true;
      else if (rt.repeat_type === 'weekly' && rt.repeat_days?.includes(dow)) shouldGen = true;
      else if (rt.repeat_type === 'monthly' && rt.repeat_day_of_month === dom) shouldGen = true;
      if (shouldGen) {
        const { data: existing } = await supabase
          .from('todos').select('id').eq('date', today).eq('text', rt.text).limit(1);
        if (existing && existing.length === 0) {
          await supabase.from('todos').insert([{
            text: rt.text, memo: rt.memo,
            year_level: rt.year_level || DEFAULT_ASSIGNEE,
            urgent: rt.urgent, due_time: rt.due_time, tags: rt.tags || [],
            date: today, created_by: '반복',
          }]);
        }
        await supabase.from('recurring_tasks').update({ last_generated_date: today }).eq('id', rt.id);
      }
    }
    loadTasks(currentDate);
  }

  // 할일 로드
  const loadTasks = useCallback(async (date) => {
    setLoading(true);
    const { data } = await supabase
      .from('todos').select('*').eq('date', date)
      .order('created_at', { ascending: true });
    setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentMember) return;
    loadTasks(currentDate);
    const channel = supabase.channel(`todos-${currentDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
        const row = payload.new || payload.old;
        if (row && row.date === currentDate) loadTasks(currentDate);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => loadMembers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professors' }, () => loadProfessors())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentMember, currentDate, loadTasks, loadMembers, loadProfessors]);

  // 사진
  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const slots = 5 - newPhotos.length;
    const toUpload = files.slice(0, slots);
    setUploading(true);
    try {
      const urls = [];
      for (const file of toUpload) {
        const compressed = await compressPhoto(file);
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('todo-photos').upload(fileName, compressed, { contentType: 'image/jpeg' });
        if (error) { alert('사진 업로드 실패: ' + error.message); continue; }
        const { data } = supabase.storage.from('todo-photos').getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
      setNewPhotos([...newPhotos, ...urls]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 푸시 알림 발송 헬퍼
  const sendPush = async (payload) => {
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, excludeMemberId: currentMember.id }),
      });
    } catch (e) {
      console.error('Push send failed:', e);
    }
  };

  // 할일 추가
  const addTask = async () => {
    const rawText = newTask.trim();
    if (!rawText) return;

    const tags = extractTags(rawText);
    const text = stripTags(rawText) || rawText;
    let timeToUse = newTime;
    if (!timeToUse) {
      const detected = extractTimeFromText(rawText);
      if (detected) timeToUse = detected;
    }
    // 병동 자동 인식 (수동 선택 우선)
    const ward = newWard || extractWard(text);

    // 메모는 그대로 (교수님 정보는 professor 컬럼에 따로 저장되어 [X] 뱃지로 표시됨)
    const memoFinal = newMemo.trim() || null;

    const targetDate = newTargetDate || currentDate;

    const { data: inserted, error } = await supabase.from('todos').insert([{
      text,
      memo: memoFinal,
      year_level: newYearLevel,
      urgent: newUrgent,
      due_time: timeToUse || null,
      tags,
      photo_urls: newPhotos,
      ward,
      professor: newProfessor,
      date: targetDate,
      created_by: currentMember.name,
    }]).select().single();

    if (error) {
      alert('추가 실패: ' + error.message);
      return;
    }

    // 긴급이면 푸시
    if (newUrgent && inserted) {
      sendPush({
        title: '🚨 새 긴급 할일',
        message: `${timeToUse ? formatTimeLabel(timeToUse) + ' — ' : ''}${text}`,
        urgent: true,
        targetYearLevel: newYearLevel,
        todoId: inserted.id,
      });
    }

    // 입력 리셋
    setNewTask(''); setNewMemo(''); setNewUrgent(false);
    setNewYearLevel(DEFAULT_ASSIGNEE);
    setNewTime(''); setShowTimePicker(false);
    setNewPhotos([]); setNewWard(null); setNewProfessor(null);
    setNewTargetDate(todayStr()); setShowDateForNew(false);

    if (targetDate === currentDate) loadTasks(currentDate);
  };

  const toggleDone = async (task) => {
    const newDone = !task.done;
    await supabase.from('todos').update({
      done: newDone,
      completed_at: newDone ? new Date().toISOString() : null,
      completed_by: newDone ? currentMember.name : null,
    }).eq('id', task.id);
    loadTasks(currentDate);
  };

  const toggleUrgent = async (task) => {
    const newUrg = !task.urgent;
    await supabase.from('todos').update({ urgent: newUrg }).eq('id', task.id);
    // 긴급으로 바뀌면 푸시
    if (newUrg && !task.done) {
      sendPush({
        title: '⚡ 긴급으로 변경됨',
        message: `${task.due_time ? formatTimeLabel(task.due_time) + ' — ' : ''}${task.text}`,
        urgent: true,
        targetYearLevel: task.year_level,
        todoId: task.id,
      });
    }
    loadTasks(currentDate);
  };

  const updateYearLevel = async (task, yl) => {
    await supabase.from('todos').update({ year_level: yl }).eq('id', task.id);
    loadTasks(currentDate);
  };

  const deleteTask = async (id) => {
    const task = tasks.find((t) => t.id === id);
    if (task?.photo_urls?.length) {
      const paths = task.photo_urls.map((url) => url.split('/').pop());
      await supabase.storage.from('todo-photos').remove(paths).catch(() => {});
    }
    await supabase.from('todos').delete().eq('id', id);
    loadTasks(currentDate);
  };

  if (!currentMember) {
    return <MemberSelect members={members} onSelect={(m) => {
      localStorage.setItem('memberId', m.id);
      setCurrentMember(m);
    }} onRefresh={loadMembers} />;
  }

  const daysFromToday = daysBetween(todayStr(), currentDate);
  const tooOld = daysFromToday < -VISIBLE_DAYS;

  const enhanced = tasks.map((t) => ({
    ...t,
    autoUrgent: !t.done && (isTimeNear(t.date, t.due_time) || isTimePast(t.date, t.due_time)),
    timePast: !t.done && isTimePast(t.date, t.due_time),
  }));

  let active = enhanced.filter((t) => !t.done);
  let done = enhanced.filter((t) => t.done);

  if (activeTag) {
    active = active.filter((t) => t.tags?.includes(activeTag));
    done = done.filter((t) => t.tags?.includes(activeTag));
  }

  // 정렬 — 긴급/일반 분리
  // 긴급끼리는 항상 시간순 (이른 시간이 위, 시간 없으면 등록순)
  // 일반끼리는 사용자가 선택한 정렬
  const urgentSortFn = (a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  };

  const normalSortFn = (a, b) => {
    if (sortMode === 'ward') {
      return (a.ward || 'zzz').localeCompare(b.ward || 'zzz');
    }
    if (sortMode === 'professor') {
      return (a.professor || 'zzz').localeCompare(b.professor || 'zzz');
    }
    if (sortMode === 'assignee') {
      const ord = { r1: 0, r2: 1, r3: 2, r4: 3, all: 4 };
      return (ord[a.year_level] ?? 9) - (ord[b.year_level] ?? 9);
    }
    // time (default)
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  };

  // 긴급/일반 분리해서 각각 정렬, 긴급을 위에 배치
  const urgentTasks = active.filter((t) => t.urgent || t.autoUrgent).sort(urgentSortFn);
  const normalTasks = active.filter((t) => !(t.urgent || t.autoUrgent)).sort(normalSortFn);
  active = [...urgentTasks, ...normalTasks];
  done.sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

  const tagCounts = {};
  tasks.forEach((t) => (t.tags || []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
  const popularTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);

  const isToday = currentDate === todayStr();
  const isFuture = currentDate > todayStr();

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div style={styles.headerLeft}>
              <button onClick={() => setShowSearch(true)} style={styles.iconBtn} title="검색">🔍</button>
              <button onClick={() => setShowAttending(true)} style={styles.letterBtn} title="교수님 당직표">A</button>
              <button onClick={() => setShowResident(true)} style={styles.letterBtn} title="전공의 당직표">R</button>
              <button onClick={() => setShowNotices(true)} style={styles.iconBtnBadge} title="공지사항">
                📌{noticeCount > 0 && <span style={styles.noticeBadge}>{noticeCount}</span>}
              </button>
              <button onClick={() => setShowStats(true)} style={styles.iconBtn} title="통계">📊</button>
            </div>
            <div style={styles.titleWrap}>
              <h1 style={styles.title} className="display-font">NS_To-Do</h1>
              <p style={styles.subtitle}>by WS.Kim</p>
            </div>
            <div style={styles.headerRight}>
              <button onClick={() => setShowSettings(true)} style={styles.iconBtn} title="설정">⚙</button>
            </div>
          </div>
          <div style={styles.currentUser}>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>접속중</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: YEAR_LEVELS[currentMember.year_level]?.color || 'var(--text)' }}>
              {currentMember.name} ({YEAR_LEVELS[currentMember.year_level]?.full || currentMember.role})
            </span>
            <span style={styles.presenceCount} className="pulse">● {onlineCount}명</span>
          </div>
        </header>

        {/* Date nav */}
        <div style={styles.dateNav}>
          <button onClick={() => setCurrentDate(shiftDateStr(currentDate, -1))} style={styles.arrowBtn}>‹</button>
          <button onClick={() => setShowDatePicker(!showDatePicker)} style={styles.dateLabel}>
            <span style={styles.dateText}>{formatDateLabel(currentDate)}</span>
            <span style={styles.dateSub}>{currentDate}</span>
          </button>
          <button onClick={() => setCurrentDate(shiftDateStr(currentDate, 1))} style={styles.arrowBtn}>›</button>
        </div>

        {showDatePicker && (
          <div style={styles.datePickerWrap} className="slide-down">
            <input type="date" value={currentDate} onChange={(e) => { setCurrentDate(e.target.value); setShowDatePicker(false); }} />
            <button onClick={() => { setCurrentDate(todayStr()); setShowDatePicker(false); }} style={styles.todayBtn}>오늘로</button>
          </div>
        )}

        {tooOld ? (
          <div style={styles.tooOld}>
            6개월 이상 지난 할일은 화면에 표시되지 않아요.<br />
            검색 기능에서 확인할 수 있어요. (최대 1년 보관)
          </div>
        ) : (
          <>
            {popularTags.length > 0 && (
              <div style={styles.tagBar}>
                {activeTag && <button onClick={() => setActiveTag(null)} style={styles.tagClear}>× 전체</button>}
                {popularTags.map((tag) => (
                  <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{ ...styles.tagChip, background: activeTag === tag ? 'var(--text)' : 'var(--surface-2)', color: activeTag === tag ? 'var(--bg)' : 'var(--text-2)' }}>
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {(isToday || isFuture) && (
              <div style={styles.inputCard}>
                {/* 교수님 칩 (입력창 위로 이동) */}
                {professors.length > 0 && (
                  <div style={styles.profRow}>
                    <span style={styles.profLabel}>교수</span>
                    <button onClick={() => setNewProfessor(null)} style={{ ...styles.profChip, background: !newProfessor ? 'var(--text-3)' : 'var(--surface)', color: !newProfessor ? 'var(--bg)' : 'var(--text-3)' }}>없음</button>
                    {professors.map((p) => (
                      <button key={p.id} onClick={() => setNewProfessor(newProfessor === p.initial ? null : p.initial)}
                        style={{ ...styles.profChip, background: newProfessor === p.initial ? 'var(--text)' : 'var(--surface)', color: newProfessor === p.initial ? 'var(--bg)' : 'var(--text)', fontWeight: 600 }}>
                        {p.initial}
                      </button>
                    ))}
                  </div>
                )}

                {/* 병동 칩 (입력창 위로 이동) */}
                <div style={styles.wardRow}>
                  <span style={styles.profLabel}>병동</span>
                  <button onClick={() => setNewWard(null)} style={{ ...styles.wardChip, background: !newWard ? 'var(--text-3)' : 'var(--surface)', color: !newWard ? 'var(--bg)' : 'var(--text-3)' }}>없음</button>
                  {WARD_CHIPS.map((w) => (
                    <button key={w} onClick={() => setNewWard(newWard === w ? null : w)}
                      style={{ ...styles.wardChip, background: newWard === w ? 'var(--info)' : 'var(--surface)', color: newWard === w ? 'white' : 'var(--text-2)' }}>
                      {w}
                    </button>
                  ))}
                </div>

                <div style={{ ...styles.taskInputRow, marginTop: 10 }}>
                  <input type="text" placeholder="할일 입력 (예: 14시 회진 자료 #회진)"
                    value={newTask} onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addTask()}
                    style={{ flex: 1 }} />
                  <button onClick={() => setShowTemplates(true)} style={styles.templateBtn} title="자주 쓰는 할일">⭐</button>
                </div>

                <textarea placeholder="메모 (선택)" value={newMemo} onChange={(e) => setNewMemo(e.target.value)}
                  rows={1} style={{ marginTop: 8, fontSize: 14 }} />

                {/* 사진 미리보기 */}
                {newPhotos.length > 0 && (
                  <div style={styles.photoPreview}>
                    {newPhotos.map((url) => (
                      <div key={url} style={styles.photoPreviewItem}>
                        <img src={url} alt="" style={styles.photoPreviewImg} />
                        <button onClick={() => setNewPhotos(newPhotos.filter(u => u !== url))} style={styles.photoRemove}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {showTimePicker && (
                  <div style={styles.timePickerRow} className="slide-down">
                    <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ flex: 1 }} />
                    <button onClick={() => { setNewTime(''); setShowTimePicker(false); }} style={styles.clearTimeBtn}>지우기</button>
                  </div>
                )}

                {showDateForNew && (
                  <div style={styles.timePickerRow} className="slide-down">
                    <input type="date" value={newTargetDate} min={todayStr()} onChange={(e) => setNewTargetDate(e.target.value)} style={{ flex: 1 }} />
                    <button onClick={() => { setNewTargetDate(todayStr()); setShowDateForNew(false); }} style={styles.clearTimeBtn}>오늘로</button>
                  </div>
                )}

                <div style={styles.inputActions}>
                  <select value={newYearLevel} onChange={(e) => setNewYearLevel(e.target.value)}
                    style={{ ...styles.yearSelect, color: YEAR_LEVELS[newYearLevel]?.color, background: YEAR_LEVELS[newYearLevel]?.bg }}>
                    {ASSIGNEE_ORDER.map((k) => <option key={k} value={k}>{YEAR_LEVELS[k].full}</option>)}
                  </select>

                  <button onClick={() => setShowTimePicker(!showTimePicker)}
                    style={{ ...styles.miniBtn, color: newTime ? 'var(--info)' : 'var(--text-3)' }} title="시간">
                    🕐{newTime ? ' ' + formatTimeLabel(newTime) : ''}
                  </button>

                  <button onClick={() => setShowDateForNew(!showDateForNew)}
                    style={{ ...styles.miniBtn, color: newTargetDate !== todayStr() ? 'var(--info)' : 'var(--text-3)' }} title="날짜">
                    📅{newTargetDate !== todayStr() ? ' ' + formatShortDateLabel(newTargetDate) : ''}
                  </button>

                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading || newPhotos.length >= 5}
                    style={styles.miniBtn} title="사진">
                    {uploading ? '⏳' : '📷'}{newPhotos.length > 0 ? ` ${newPhotos.length}` : ''}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />

                  <label style={styles.urgentToggle}>
                    <input type="checkbox" checked={newUrgent} onChange={(e) => setNewUrgent(e.target.checked)} />
                    <span style={{ color: newUrgent ? 'var(--danger)' : 'var(--text-2)' }}>긴급</span>
                  </label>

                  <button onClick={addTask} style={styles.addBtn} disabled={uploading}>+ 추가</button>
                </div>

                {newTargetDate !== todayStr() && (
                  <div style={styles.futureDateNotice}>
                    📅 <strong>{formatShortDateLabel(newTargetDate)}</strong>에 추가됩니다
                  </div>
                )}
              </div>
            )}

            {/* 정렬 옵션 */}
            <div style={styles.sortRow}>
              <button onClick={() => setShowSortMenu(!showSortMenu)} style={styles.sortBtn}>
                ⇅ 정렬: {sortMode === 'time' ? '시간순' : sortMode === 'ward' ? '병동별' : sortMode === 'professor' ? '교수님별' : '담당자별'}
              </button>
              {showSortMenu && (
                <>
                  <div onClick={() => setShowSortMenu(false)} style={styles.menuBackdrop} />
                  <div style={styles.sortMenu}>
                    {[
                      { k: 'time', l: '시간순' },
                      { k: 'ward', l: '병동별' },
                      { k: 'professor', l: '교수님별' },
                      { k: 'assignee', l: '담당자별' },
                    ].map((opt) => (
                      <button key={opt.k} onClick={() => changeSortMode(opt.k)}
                        style={{ ...styles.sortMenuItem, color: sortMode === opt.k ? 'var(--info)' : 'var(--text)', fontWeight: sortMode === opt.k ? 600 : 400 }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 진행중 */}
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>진행중</span>
                <span style={styles.sectionCount}>{active.length}</span>
              </div>
              {loading ? <div style={styles.empty}>불러오는 중…</div>
                : active.length === 0 ? <div style={styles.empty}>할일이 없어요</div>
                : <div style={styles.list}>
                    {active.map((task) => (
                      <TaskRow key={task.id} task={task} isDone={false} currentMember={currentMember}
                        professors={professors}
                        onToggle={() => toggleDone(task)} onUrgent={() => toggleUrgent(task)}
                        onYearChange={(yl) => updateYearLevel(task, yl)} onDelete={() => deleteTask(task.id)}
                        onEdit={() => setEditingTask(task)}
                        onPhotoClick={(url, urls) => setPhotoViewer({ url, urls })}
                        onTagClick={(tag) => setActiveTag(tag)} />
                    ))}
                  </div>
              }
            </section>

            {/* 완료 (접기/펼치기) */}
            {done.length > 0 && (
              <section style={styles.section}>
                <button onClick={toggleDoneCollapsed} style={styles.collapsibleHeader}>
                  <span style={styles.sectionTitle}>완료</span>
                  <span style={styles.sectionCount}>{done.length}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>
                    {doneCollapsed ? '▾ 펼치기' : '▴ 접기'}
                  </span>
                </button>
                {!doneCollapsed && (
                  <div style={styles.list}>
                    {done.map((task) => (
                      <TaskRow key={task.id} task={task} isDone={true} currentMember={currentMember}
                        professors={professors}
                        onToggle={() => toggleDone(task)} onUrgent={() => toggleUrgent(task)}
                        onYearChange={(yl) => updateYearLevel(task, yl)} onDelete={() => deleteTask(task.id)}
                        onEdit={() => setEditingTask(task)}
                        onPhotoClick={(url, urls) => setPhotoViewer({ url, urls })}
                        onTagClick={(tag) => setActiveTag(tag)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 다가오는 일정 */}
            {isToday && (
              <UpcomingSection
                days={UPCOMING_DAYS}
                expanded={upcomingExpanded}
                onToggle={toggleUpcoming}
                onDateClick={(d) => setCurrentDate(d)}
                currentMember={currentMember}
                professors={professors}
              />
            )}
          </>
        )}

        <footer style={styles.footer}>
          <div>실시간 동기화됨 · 의국원 공유</div>
          <div style={{ marginTop: 4, color: 'var(--text-3)' }}>⚠ 환자 식별 정보 입력 금지</div>
        </footer>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} currentMember={currentMember}
        onMemberChange={() => { localStorage.removeItem('memberId'); setCurrentMember(null); }} />}
      {showSearch && <SearchView onClose={() => setShowSearch(false)} onPhotoClick={(url, urls) => setPhotoViewer({ url, urls })} professors={professors} />}
      {showStats && <StatsView onClose={() => setShowStats(false)} />}
      {showAttending && <DutyScheduleModal scheduleKey="attending" title="교수님 당직표" currentMember={currentMember} onClose={() => setShowAttending(false)} />}
      {showResident && <DutyScheduleModal scheduleKey="resident" title="전공의 당직표" currentMember={currentMember} onClose={() => setShowResident(false)} />}
      {showNotices && <NoticesModal currentMember={currentMember} onClose={() => setShowNotices(false)} />}
      {showTemplates && <TemplatesPicker onClose={() => setShowTemplates(false)} onSelect={(text) => {
        setNewTask(newTask ? `${newTask} ${text}` : text);
        setShowTemplates(false);
      }} />}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          professors={professors}
          currentMember={currentMember}
          onClose={() => setEditingTask(null)}
          onSaved={() => loadTasks(currentDate)}
        />
      )}
      {photoViewer && <PhotoViewer url={photoViewer.url} urls={photoViewer.urls} onClose={() => setPhotoViewer(null)} />}
    </main>
  );
}

const styles = {
  main: { minHeight: '100vh', padding: '12px 12px 40px' },
  container: { maxWidth: 560, margin: '0 auto' },
  header: { padding: '8px 0 16px' },
  headerTop: { display: 'flex', alignItems: 'center', gap: 6 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  headerRight: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  titleWrap: { textAlign: 'center', flex: 1, minWidth: 0, padding: '0 8px' },
  title: { fontSize: 22, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.1em' },
  iconBtn: { width: 32, height: 32, fontSize: 15, color: 'var(--text-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnBadge: { width: 32, height: 32, fontSize: 15, color: 'var(--text-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  noticeBadge: { position: 'absolute', top: -2, right: -2, background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 600, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  letterBtn: { width: 28, height: 28, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, flexShrink: 0 },
  currentUser: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: '6px 12px', background: 'var(--surface-2)', borderRadius: 100, width: 'fit-content', margin: '10px auto 0' },
  presenceCount: { fontSize: 11, color: 'var(--success)', paddingLeft: 8, borderLeft: '1px solid var(--border)' },
  dateNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px', marginBottom: 12 },
  arrowBtn: { width: 36, height: 36, fontSize: 22, color: 'var(--text-2)', borderRadius: 8 },
  dateLabel: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' },
  dateText: { fontSize: 16, fontWeight: 500, color: 'var(--text)' },
  dateSub: { fontSize: 11, color: 'var(--text-3)', marginTop: 1 },
  datePickerWrap: { display: 'flex', gap: 8, marginBottom: 12 },
  todayBtn: { padding: '0 14px', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap' },
  tooOld: { textAlign: 'center', padding: '40px 20px', background: 'var(--surface-2)', borderRadius: 12, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 },
  tagBar: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, padding: '0 4px' },
  tagChip: { padding: '4px 10px', fontSize: 12, borderRadius: 100 },
  tagClear: { padding: '4px 10px', fontSize: 12, borderRadius: 100, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)' },
  inputCard: { background: 'var(--surface-2)', padding: 12, borderRadius: 12, marginBottom: 16 },
  taskInputRow: { display: 'flex', gap: 6, alignItems: 'stretch' },
  templateBtn: { padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, color: 'var(--text-2)' },
  profRow: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  profLabel: { fontSize: 11, color: 'var(--text-2)', marginRight: 2, fontWeight: 500, width: 30 },
  profChip: { padding: '4px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, minWidth: 28 },
  wardRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  wardChip: { padding: '4px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 },
  photoPreview: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  photoPreviewItem: { position: 'relative', width: 56, height: 56 },
  photoPreviewImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, fontSize: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  timePickerRow: { display: 'flex', gap: 6, marginTop: 8 },
  clearTimeBtn: { padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)', fontSize: 13 },
  inputActions: { display: 'flex', alignItems: 'center', marginTop: 10, gap: 4, flexWrap: 'wrap' },
  yearSelect: { width: 'auto', padding: '6px 8px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' },
  miniBtn: { padding: '6px 8px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 },
  urgentToggle: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', padding: '4px 6px' },
  addBtn: { padding: '8px 14px', background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontSize: 13, fontWeight: 500, marginLeft: 'auto' },
  futureDateNotice: { marginTop: 8, padding: '6px 10px', fontSize: 12, color: 'var(--info)', background: 'var(--surface)', borderRadius: 6, textAlign: 'center' },
  sortRow: { display: 'flex', justifyContent: 'flex-end', padding: '0 4px 8px', position: 'relative' },
  sortBtn: { fontSize: 11, color: 'var(--text-2)', padding: '4px 10px', borderRadius: 6, background: 'var(--surface-2)' },
  sortMenu: { position: 'absolute', right: 4, top: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  sortMenuItem: { display: 'block', padding: '6px 14px', fontSize: 12, textAlign: 'left', width: 110 },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 50 },
  section: { marginBottom: 16 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' },
  collapsibleHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 4px', width: '100%', background: 'transparent' },
  sectionTitle: { fontSize: 12, fontWeight: 500, color: 'var(--text-2)', letterSpacing: '0.05em' },
  sectionCount: { fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 10 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: 13 },
  footer: { textAlign: 'center', padding: '24px 0 0', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.03em', lineHeight: 1.6 },
};
