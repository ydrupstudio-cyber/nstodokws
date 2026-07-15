'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { relativeTime, compressPhoto } from '../lib/utils';

export default function ScheduleBoardsView({ currentMember, onClose, onPhotoClick }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBoard, setOpenBoard] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, title, content, photo_urls }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('schedule_boards').select('*')
      .order('display_order').order('id');
    setBoards(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('boards-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_boards' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  useEffect(() => {
    if (openBoard) {
      const fresh = boards.find((b) => b.id === openBoard.id);
      if (fresh) setOpenBoard(fresh);
    }
  }, [boards]);

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files.slice(0, 5)) {
        const compressed = await compressPhoto(file);
        const fileName = `board_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage.from('duty-schedules').upload(fileName, compressed, { contentType: 'image/jpeg' });
        if (error) { alert('사진 업로드 실패: ' + error.message); continue; }
        const { data } = supabase.storage.from('duty-schedules').getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
      setEditing({ ...editing, photo_urls: [...(editing.photo_urls || []), ...urls] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (url) => {
    setEditing({ ...editing, photo_urls: editing.photo_urls.filter((u) => u !== url) });
  };

  const saveBoard = async () => {
    const t = editing.title.trim();
    if (!t) { alert('이름을 입력해주세요.'); return; }
    if (editing.id) {
      await supabase.from('schedule_boards').update({
        title: t, content: editing.content?.trim() || null,
        photo_urls: editing.photo_urls || [],
        updated_by: currentMember?.name || '익명',
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('schedule_boards').insert([{
        title: t, content: editing.content?.trim() || null,
        photo_urls: editing.photo_urls || [],
        display_order: boards.length + 1,
        created_by: currentMember?.name || '익명',
      }]);
    }
    setEditing(null);
    load();
  };

  const deleteBoard = async (b) => {
    if (!window.confirm(`"${b.title}"을 삭제할까요?`)) return;
    // 사진도 스토리지에서 정리
    if (b.photo_urls?.length) {
      const paths = b.photo_urls.map((u) => u.split('/').pop());
      await supabase.storage.from('duty-schedules').remove(paths).catch(() => {});
    }
    await supabase.from('schedule_boards').delete().eq('id', b.id);
    setOpenBoard(null);
    load();
  };

  // ── 편집 화면 ──
  if (editing) {
    return (
      <div className="modal-overlay" onClick={() => setEditing(null)}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
          <div style={styles.header}>
            <h2 style={styles.title}>{editing.id ? '근무표 수정' : '새 근무표·일정'}</h2>
            <button onClick={() => setEditing(null)} style={styles.close}>×</button>
          </div>
          <input type="text" placeholder="이름 (예: CV 근무표)" value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus />
          <textarea placeholder="텍스트 내용 (선택)" value={editing.content || ''}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={5} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }} />

          {editing.photo_urls?.length > 0 && (
            <div style={styles.photoGrid}>
              {editing.photo_urls.map((url) => (
                <div key={url} style={styles.photoItem}>
                  <img src={url} alt="" style={styles.photoImg} />
                  <button onClick={() => removePhoto(url)} style={styles.photoRemove}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={styles.photoAddBtn}>
            {uploading ? '⏳ 업로드 중...' : '📷 사진 추가'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(null)} style={styles.cancelBtn}>취소</button>
            <button onClick={saveBoard} style={styles.saveBtn} disabled={uploading}>저장</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 상세 보기 ──
  if (openBoard) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
          <div style={styles.header}>
            <button onClick={() => setOpenBoard(null)} style={styles.backBtn}>‹ 목록</button>
            <button onClick={onClose} style={styles.close}>×</button>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{openBoard.title}</h2>
          <div style={styles.meta}>
            {openBoard.updated_by
              ? <span>업데이트: {openBoard.updated_by} ({relativeTime(openBoard.updated_at)})</span>
              : openBoard.created_by && <span>등록: {openBoard.created_by}</span>}
          </div>
          <div style={styles.actions}>
            <button onClick={() => setEditing({ id: openBoard.id, title: openBoard.title, content: openBoard.content || '', photo_urls: openBoard.photo_urls || [] })}
              style={styles.actionBtn}>✎ 수정</button>
            <button onClick={() => deleteBoard(openBoard)} style={{ ...styles.actionBtn, color: 'var(--danger)' }}>삭제</button>
          </div>

          {(openBoard.photo_urls || []).map((url) => (
            <img key={url} src={url} alt={openBoard.title}
              onClick={() => onPhotoClick?.(url, openBoard.photo_urls)}
              style={styles.bigPhoto} />
          ))}

          {openBoard.content && (
            <div style={styles.contentBox}>{openBoard.content}</div>
          )}

          {(!openBoard.photo_urls || openBoard.photo_urls.length === 0) && !openBoard.content && (
            <div style={styles.empty}>
              아직 내용이 없어요.<br />✎ 수정을 눌러 사진이나 텍스트를 추가해주세요.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>📋 근무표 · 일정</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : (
          <div style={styles.list}>
            {boards.map((b) => (
              <button key={b.id} onClick={() => setOpenBoard(b)} style={styles.boardItem}>
                <span style={styles.boardIcon}>
                  {(b.photo_urls?.length || 0) > 0 ? '🖼' : '📄'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={styles.boardTitle}>{b.title}</span>
                  <span style={styles.boardMeta}>
                    {b.updated_at ? relativeTime(b.updated_at) : b.created_at ? relativeTime(b.created_at) : ''}
                  </span>
                </span>
                <span style={{ color: 'var(--text-3)' }}>›</span>
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setEditing({ title: '', content: '', photo_urls: [] })} style={styles.addNewBtn}>
          + 새 근무표 · 일정 추가
        </button>
        <p style={styles.hint}>예: CV 근무표, 마취과 콜 번호, 검사실 일정 등 자유롭게</p>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  backBtn: { padding: '4px 8px', fontSize: 14, color: 'var(--text-2)' },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  boardItem: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'left' },
  boardIcon: { fontSize: 20, flexShrink: 0 },
  boardTitle: { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  boardMeta: { display: 'block', fontSize: 10, color: 'var(--text-3)', marginTop: 1 },
  addNewBtn: { width: '100%', padding: 14, marginTop: 12, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 13 },
  hint: { fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 6 },
  meta: { fontSize: 11, color: 'var(--text-3)', marginTop: 4 },
  actions: { display: 'flex', gap: 6, marginTop: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 },
  actionBtn: { padding: '6px 12px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)' },
  bigPhoto: { width: '100%', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 8, cursor: 'zoom-in', display: 'block' },
  contentBox: { fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface-2)', padding: 12, borderRadius: 10 },
  empty: { textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7 },
  photoGrid: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  photoItem: { position: 'relative', width: 72, height: 72 },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, fontSize: 13, background: 'var(--text)', color: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  photoAddBtn: { width: '100%', padding: 10, marginTop: 8, background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)' },
  saveBtn: { flex: 2, padding: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontWeight: 500 },
};
