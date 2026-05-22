'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS, ASSIGNEE_ORDER } from '../lib/config';
import { formatTimeLabel, relativeTime, parseProfessorBracket } from '../lib/utils';

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

  // 본문/메모에서 [X] 패턴 자동 추출
  const knownInitials = professors.map((p) => p.initial);
  const parsedText = parseProfessorBracket(task.text, knownInitials);
  const parsedMemo = parseProfessorBracket(task.memo, knownInitials);
  const displayText = parsedText.cleanText;
  const displayMemo = parsedMemo.cleanText;
  // 표시할 교수: 컬럼 값 우선, 없으면 본문에서 추출
  const displayProf = task.professor || parsedText.profInitial || parsedMemo.profInitial;

  const yl = YEAR_LEVELS[task.year_level] || YEAR_LEVELS.r1;
  const showAsUrgent = !isDone && (task.urgent || task.autoUrgent);
  const textColor = isDone ? 'var(--text-3)' : showAsUrgent ? 'var(--danger)' : 'var(--text)';
  const bgColor = !isDone && showAsUrgent ? 'var(--danger-bg)' : 'var(--surface)';
  const borderColor = !isDone && showAsUrgent ? 'var(--danger-border)' : 'var(--border)';

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
    await supabase.from('comments').insert([{
      todo_id: task.id,
      content,
      created_by: currentMember?.name || '익명',
    }]);
    setNewComment('');
    setCommentCount(c => c + 1);
  };

  const deleteComment = async (id) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    await supabase.from('comments').delete().eq('id', id);
    setCommentCount(c => Math.max(0, c - 1));
  };

  return (
    <div style={{ ...styles.wrap, background: bgColor, borderColor }}>
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
          <div style={styles.firstLine}>
            <button onClick={() => setShowYearMenu(!showYearMenu)} style={{ ...styles.yearBadge, background: yl.bg, color: yl.color, opacity: isDone ? 0.6 : 1 }} title={yl.full}>
              {yl.label}
            </button>

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
              {showAsUrgent && task.urgent && <span style={styles.urgentBadge}>긴급</span>}
              {displayText}
            </span>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div style={styles.tags}>
              {task.tags.map((tag) => (
                <button key={tag} onClick={() => onTagClick?.(tag)} style={{ ...styles.tagPill, opacity: isDone ? 0.5 : 1 }}>
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {displayMemo && (
            <div style={{
              ...styles.memo,
              textDecoration: isDone ? 'line-through' : 'none',
              color: isDone ? 'var(--text-3)' : 'var(--text-2)',
            }}>
              {displayMemo}
            </div>
          )}

          {task.photo_urls && task.photo_urls.length > 0 && (
            <button onClick={() => onPhotoClick?.(task.photo_urls[0], task.photo_urls)} style={styles.photoIcon}>
              📎 사진 {task.photo_urls.length}장
            </button>
          )}

          {/* 댓글 토글 버튼 */}
          {/* 댓글 + 수정 토글 버튼 */}
          <div style={styles.actionRow}>
            <button
              onClick={() => setShowComments(!showComments)}
              style={{
                ...styles.commentToggle,
                color: commentCount > 0 ? 'var(--info)' : 'var(--text-3)',
              }}
            >
              💬 {commentCount > 0 ? `댓글 ${commentCount}` : '댓글'}
            </button>
            <button
              onClick={() => onEdit?.()}
              style={styles.editToggle}
              title="수정"
            >
              ✎ 수정
            </button>
          </div>

          <div style={styles.metaLine}>
            {task.created_by && (
              <span>
                등록: {task.created_by}
                {task.created_at && ` (${relativeTime(task.created_at)})`}
              </span>
            )}
            {task.updated_by && task.updated_at && (
              <span>
                {task.created_by && ' · '}
                수정: {task.updated_by} ({relativeTime(task.updated_at)})
              </span>
            )}
            {isDone && task.completed_by && (
              <span style={{ display: 'block', marginTop: 2 }}>
                ✓ {task.completed_by}{' '}
                {task.completed_at && new Date(task.completed_at).toLocaleString('ko-KR', {
                  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {!isDone && (
          <button onClick={onUrgent} style={{ ...styles.iconBtn, color: task.urgent ? 'var(--danger)' : 'var(--text-3)' }} title="긴급 토글">
            ⚡
          </button>
        )}
        <button onClick={() => { if (window.confirm('이 할일을 삭제할까요?')) onDelete(); }} style={styles.iconBtn} title="삭제">
          ×
        </button>

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
  urgentBadge: {
    display: 'inline-block', fontSize: 10, fontWeight: 600, color: 'var(--danger)',
    background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, marginRight: 6,
    verticalAlign: 'middle', border: '1px solid var(--danger)', letterSpacing: '0.05em',
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagPill: {
    fontSize: 11, color: 'var(--text-2)', background: 'var(--surface-2)',
    padding: '2px 8px', borderRadius: 100,
  },
  memo: { fontSize: 13, marginTop: 4, wordBreak: 'break-word', lineHeight: 1.5 },
  photoIcon: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: 'var(--info)', background: 'var(--surface-2)',
    padding: '4px 10px', borderRadius: 6, marginTop: 6,
  },
  actionRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 },
  commentToggle: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, padding: '4px 8px', borderRadius: 6,
    background: 'transparent',
  },
  editToggle: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, padding: '4px 8px', borderRadius: 6,
    background: 'transparent', color: 'var(--text-3)',
  },
  metaLine: { fontSize: 11, color: 'var(--text-3)', marginTop: 6 },
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
