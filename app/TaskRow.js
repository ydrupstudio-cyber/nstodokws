'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { award } from '../lib/game';
import { YEAR_LEVELS, ASSIGNEE_ORDER } from '../lib/config';
import { formatTimeLabel, relativeTime, parseProfessorBracket, formatShortDateLabel } from '../lib/utils';

export default function TaskRow({
  task,
  isDone,
  onToggle,
  onUrgent,
  onYearChange,
  onDelete,
  onEdit,
  onPhotoClick,
  onTagClick,
  currentMember,
  professors = [],
}) {
  const [showYearMenu, setShowYearMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  // 메모 접기 — 한 줄만 보이고, 넘치면 '더보기'
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoClamped, setMemoClamped] = useState(false);
  const memoRef = useRef(null);

  // 본문/메모에서 [X] 패턴 자동 추출
  const knownInitials = professors.map((p) => p.initial);
  const parsedText = parseProfessorBracket(task.text, knownInitials);
  const parsedMemo = parseProfessorBracket(task.memo, knownInitials);
  const displayText = parsedText.cleanText;
  const displayMemo = parsedMemo.cleanText;
  // 표시할 교수: 컬럼 값 우선, 없으면 본문에서 추출
  const displayProf = task.professor || parsedText.profInitial || parsedMemo.profInitial;

  // 푸터 한 줄에 들어갈 짧은 메타와, 길게 눌렀을 때 보이는 전체 메타
  const doneStamp = task.completed_at
    ? new Date(task.completed_at).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const metaShort = [
    task.created_by,
    task.updated_by && task.updated_at
      ? `수정 ${relativeTime(task.updated_at)}`
      : task.created_at ? relativeTime(task.created_at) : '',
    isDone && task.completed_by ? `✓ ${task.completed_by}` : '',
  ].filter(Boolean).join(' · ');
  const metaFull = [
    task.created_by && `등록: ${task.created_by}${task.created_at ? ` (${relativeTime(task.created_at)})` : ''}`,
    task.updated_by && task.updated_at && `수정: ${task.updated_by} (${relativeTime(task.updated_at)})`,
    isDone && task.completed_by && `완료: ${task.completed_by}${doneStamp ? ` ${doneStamp}` : ''}`,
  ].filter(Boolean).join(' · ');

  const yl = YEAR_LEVELS[task.year_level] || YEAR_LEVELS.r1;
  const showAsUrgent = !isDone && (task.urgent || task.autoUrgent);
  const isCarried = !isDone && !!task.carried_from;
  const textColor = isDone ? 'var(--text-3)' : showAsUrgent ? 'var(--danger)' : 'var(--text)';
  const bgColor = !isDone && showAsUrgent ? 'var(--danger-bg)' : 'var(--surface)';
  const borderColor = !isDone && showAsUrgent ? 'var(--danger-border)' : isCarried ? '#E8963E' : 'var(--border)';

  // 메모가 한 줄에 다 들어가는지 확인한다. 펼친 상태에서는 재지 않는다
  useEffect(() => {
    if (memoOpen) return;
    const el = memoRef.current;
    if (el) setMemoClamped(el.scrollWidth > el.clientWidth + 1);
  }, [displayMemo, memoOpen]);

  // 댓글 수 가져오기
  useEffect(() => {
    let cancel = false;
    supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('todo_id', task.id)
      .then(({ count }) => {
        if (!cancel) setCommentCount(count || 0);
      });
    return () => { cancel = true; };
  }, [task.id]);

  // 댓글 펼칠 때 로드
  useEffect(() => {
    if (!showComments) return;
    setLoadingComments(true);
    supabase
      .from('comments')
      .select('*')
      .eq('todo_id', task.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments(data || []);
        setLoadingComments(false);
      });

    const channel = supabase
      .channel(`comments-${task.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'comments',
        filter: `todo_id=eq.${task.id}`,
      }, () => {
        supabase
          .from('comments')
          .select('*')
          .eq('todo_id', task.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => setComments(data || []));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [showComments, task.id]);

  const addComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    const { data: ins } = await supabase.from('comments').insert([{
      todo_id: task.id,
      content,
      created_by: currentMember?.name || '익명',
    }]).select('id').single();
    setNewComment('');
    setCommentCount(c => c + 1);
    // 점수는 할일당 첫 댓글만 (ref 에 todo_id 를 쓰므로 두 번째부터는 서버가 걸러낸다)
    if (ins && currentMember?.id) award(currentMember.id, 'comment', `comment:${ins.id}`, task.text);
  };

  const deleteComment = async (id) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    await supabase.from('comments').delete().eq('id', id);
    setCommentCount(c => Math.max(0, c - 1));
  };

  return (
    <div style={{ ...styles.wrap, background: bgColor, borderColor, borderWidth: isCarried ? 1.5 : 1 }}>
      <div style={styles.row}>
        <button
          onClick={onToggle}
          style={{
            ...styles.checkbox,
            background: isDone ? 'var(--accent)' : 'transparent',
            borderColor: isDone ? 'var(--accent)' : 'var(--text-3)',
          }}
          aria-label={isDone ? '완료 취소' : '완료'}
        >
          {isDone && <span style={styles.checkmark}>✓</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 첫 줄은 제목에 최대한 내준다. 연차 뱃지는 푸터로 내렸고,
              '긴급' 글자는 카드가 빨개지는 것으로 이미 드러나서 뺐다 (2026-09-28). */}
          <div style={styles.firstLine}>
            {task.due_time && (
              <span style={{ ...styles.timeBadge, color: task.timePast ? 'var(--danger)' : isDone ? 'var(--text-3)' : 'var(--info)', fontWeight: task.timePast ? 600 : 500 }}>
                {task.timePast && !isDone ? '⏰ ' : ''}
                {formatTimeLabel(task.due_time)}
              </span>
            )}

            {task.ward && (
              <span style={{ ...styles.wardBadge, opacity: isDone ? 0.5 : 1 }}>
                {task.ward}
              </span>
            )}

            {displayProf && (
              <span style={{ ...styles.profBadge, opacity: isDone ? 0.5 : 1 }}>
                {displayProf}
              </span>
            )}

            <span style={{
              color: textColor,
              textDecoration: isDone ? 'line-through' : 'none',
              fontWeight: showAsUrgent ? 500 : 400,
              fontSize: 15, wordBreak: 'break-word', flex: 1,
            }}>
              {isCarried && (
                <span style={styles.carriedBadge}>⏮ {formatShortDateLabel(task.carried_from)} 이월</span>
              )}
              {displayText}
            </span>
          </div>

          {displayMemo && (
            <div style={{
              ...styles.memo,
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'var(--text-3)' : 'var(--text-2)',
            }}>
              {memoOpen ? (
                <div style={styles.memoBodyOpen}>
                  {displayMemo}{' '}
                  <button onClick={() => setMemoOpen(false)} style={styles.memoToggle}>
                    접기
                  </button>
                </div>
              ) : (
                <div style={styles.memoRow}>
                  <span ref={memoRef} style={styles.memoBodyClamped}>{displayMemo}</span>
                  {memoClamped && (
                    <button onClick={() => setMemoOpen(true)} style={styles.memoToggle}>
                      더보기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {task.photo_urls && task.photo_urls.length > 0 && (
            <button onClick={() => onPhotoClick?.(task.photo_urls[0], task.photo_urls)} style={styles.photoIcon}>
              📎 사진 {task.photo_urls.length}장
            </button>
          )}

          {/* 푸터 한 줄 — 태그 · 등록자 · 댓글 · 수정.
              예전엔 이 셋이 각각 한 줄씩 차지해 카드가 5~6줄이었다.
              액팅이 많은 날 목록이 안 읽혀서 한 줄로 합쳤다 (2026-09-28). */}
          <div style={styles.footer}>
            <button
              onClick={() => setShowYearMenu(!showYearMenu)}
              style={{ ...styles.yearBadge, background: yl.bg, color: yl.color, opacity: isDone ? 0.6 : 1 }}
              title={yl.full}
              aria-label={`처리 연차 ${yl.full}`}
            >
              {yl.label}
            </button>

            {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
              <button key={tag} onClick={() => onTagClick?.(tag)} style={{ ...styles.tagPill, opacity: isDone ? 0.5 : 1 }}>
                #{tag}
              </button>
            ))}

            {/* 한 줄에 다 넣으려면 짧아야 한다. 수정된 건은 등록 시각 대신
                수정 시각을 보여준다 — 목록에서 궁금한 건 '얼마나 최근인가' 다.
                전체 내역은 title 로 남겨 길게 눌러 볼 수 있게 한다. */}
            <span style={styles.footerMeta} title={metaFull}>
              {metaShort}
            </span>

            <button
              onClick={() => setShowComments(!showComments)}
              style={{
                ...styles.footerBtn,
                color: commentCount > 0 ? 'var(--info)' : 'var(--text-3)',
              }}
              aria-label={commentCount > 0 ? `댓글 ${commentCount}개` : '댓글'}
              title={commentCount > 0 ? `댓글 ${commentCount}` : '댓글'}
            >
              💬{commentCount > 0 ? ` ${commentCount}` : ''}
            </button>
            <button
              onClick={() => onEdit?.()}
              style={styles.footerBtn}
              aria-label="수정"
              title="수정"
            >
              ✎
            </button>
          </div>
        </div>

        {/* ⚡ 와 × 를 세로로 쌓는다. 가로로 두면 28px 를 더 먹어 제목이 그만큼 좁아진다. */}
        <div style={styles.sideBtns}>
          <button
            onClick={() => { if (window.confirm('이 할일을 삭제할까요?')) onDelete(); }}
            style={styles.iconBtn}
            title="삭제"
            aria-label="삭제"
          >
            ×
          </button>
          {!isDone && (
            <button
              onClick={onUrgent}
              style={{ ...styles.iconBtn, color: task.urgent ? 'var(--danger)' : 'var(--text-3)' }}
              title="긴급 토글"
              aria-label={task.urgent ? '긴급 해제' : '긴급으로'}
              aria-pressed={!!task.urgent}
            >
              ⚡
            </button>
          )}
        </div>

        {showYearMenu && (
          <>
            <div onClick={() => setShowYearMenu(false)} style={styles.menuBackdrop} />
            <div style={styles.menu}>
              {ASSIGNEE_ORDER.map((k) => (
                <button key={k} onClick={() => { onYearChange(k); setShowYearMenu(false); }} style={{ ...styles.menuItem, background: YEAR_LEVELS[k].bg, color: YEAR_LEVELS[k].color }}>
                  {YEAR_LEVELS[k].full}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 댓글 영역 (펼침) */}
      {showComments && (
        <div style={styles.commentsArea} className="fade-in">
          {loadingComments ? (
            <div style={styles.commentEmpty}>불러오는 중…</div>
          ) : comments.length === 0 ? (
            <div style={styles.commentEmpty}>아직 댓글이 없어요</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={styles.commentItem}>
                <div style={styles.commentHeader}>
                  <span style={styles.commentAuthor}>{c.created_by}</span>
                  <span style={styles.commentTime}>{relativeTime(c.created_at)}</span>
                  <button onClick={() => deleteComment(c.id)} style={styles.commentDelete} title="삭제">×</button>
                </div>
                <div style={styles.commentContent}>{c.content}</div>
              </div>
            ))
          )}
          <div style={styles.commentInputRow}>
            <input
              type="text"
              placeholder="댓글 추가..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              style={styles.commentInput}
            />
            <button onClick={addComment} style={styles.commentSubmit} disabled={!newComment.trim()}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    border: '1px solid', borderRadius: 12, position: 'relative',
    transition: 'background 0.15s',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
  },
  checkbox: {
    width: 22, height: 22, border: '2px solid', borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2, transition: 'all 0.15s',
  },
  checkmark: { color: 'var(--bg)', fontSize: 14, fontWeight: 700, lineHeight: 1 },
  firstLine: { display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  yearBadge: {
    fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 100,
    border: 'none', cursor: 'pointer', lineHeight: 1.5, flexShrink: 0,
  },
  timeBadge: { fontSize: 12, padding: '2px 0', flexShrink: 0 },
  wardBadge: {
    fontSize: 11, fontWeight: 500, padding: '2px 7px',
    background: 'var(--surface-3)', color: 'var(--text-2)', borderRadius: 4,
    flexShrink: 0,
  },
  profBadge: {
    fontSize: 14, fontWeight: 700, color: 'var(--text)',
    flexShrink: 0, letterSpacing: '0.05em',
  },
  carriedBadge: {
    display: 'inline-block', fontSize: 10, fontWeight: 600, color: '#B4700F',
    background: '#FDF3E3', padding: '2px 6px', borderRadius: 4, marginRight: 6,
    verticalAlign: 'middle', border: '1px solid #E8963E', letterSpacing: '0.02em',
  },
  tagPill: {
    flexShrink: 0,
    fontSize: 11, color: 'var(--text-2)', background: 'var(--surface-2)',
    padding: '2px 8px', borderRadius: 100,
  },
  memo: { fontSize: 13, marginTop: 4, lineHeight: 1.5 },
  memoRow: { display: 'flex', alignItems: 'baseline', gap: 4 },
  memoBodyClamped: {
    flex: 1, minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  memoBodyOpen: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' },
  memoToggle: {
    flexShrink: 0, background: 'none', border: 'none', padding: 0,
    fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  photoIcon: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: 'var(--info)', background: 'var(--surface-2)',
    padding: '4px 10px', borderRadius: 6, marginTop: 6,
  },
  // 푸터 한 줄: [#태그…] [등록자 · 시각] ……… [💬] [✎]
  footer: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, minWidth: 0,
  },
  // 등록자·시각. 길면 줄바꿈 대신 말줄임 — 푸터가 두 줄이 되면 합친 의미가 없다.
  // color 는 --text-3 이었는데 카드 배경 대비 2.9:1 로 WCAG 4.5:1 미달이라 올렸다.
  footerMeta: {
    flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text-2)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  // 손가락으로 눌러야 하니 글자는 작아도 누르는 자리는 넓힌다.
  // 위아래 음수 마진으로 푸터 줄 높이는 그대로 두고 터치 영역만 키웠다.
  footerBtn: {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 30, minHeight: 30, margin: '-5px 0',
    fontSize: 13, padding: '0 4px', borderRadius: 6,
    background: 'transparent', color: 'var(--text-3)',
  },
  // × 와 ⚡ 를 담는 오른쪽 세로 열. 가로 28px 만 쓴다.
  sideBtns: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0,
  },
  iconBtn: {
    width: 28, height: 28, fontSize: 18, color: 'var(--text-3)', borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 50 },
  menu: {
    position: 'absolute', top: '100%', left: 40, marginTop: 4,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: 4, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 51,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  menuItem: {
    padding: '6px 14px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 6,
    textAlign: 'left', minWidth: 90, cursor: 'pointer',
  },
  commentsArea: {
    padding: '8px 14px 12px',
    borderTop: '1px dashed var(--border)',
    background: 'var(--surface-2)',
    borderRadius: '0 0 11px 11px',
  },
  commentEmpty: {
    textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '12px 0',
  },
  commentItem: {
    background: 'var(--surface)',
    padding: '8px 10px',
    borderRadius: 8,
    marginBottom: 6,
  },
  commentHeader: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3,
  },
  commentAuthor: { fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  commentTime: { fontSize: 10, color: 'var(--text-3)', flex: 1 },
  commentDelete: {
    width: 18, height: 18, fontSize: 13, color: 'var(--text-3)', borderRadius: 4,
  },
  commentContent: { fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.5 },
  commentInputRow: { display: 'flex', gap: 6, marginTop: 8 },
  commentInput: {
    flex: 1, padding: '6px 10px', fontSize: 13,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8,
  },
  commentSubmit: {
    width: 32, padding: 0, fontSize: 18, fontWeight: 600,
    background: 'var(--text)', color: 'var(--bg)', borderRadius: 8,
  },
};
