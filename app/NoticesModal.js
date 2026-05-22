'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { relativeTime } from '../lib/utils';

export default function NoticesModal({ currentMember, onClose }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    load();
    const channel = supabase.channel('notices-modal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('notices').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }

  const addNotice = async () => {
    const content = newContent.trim();
    if (!content) return;
    await supabase.from('notices').insert([{ content, created_by: currentMember.name }]);
    setNewContent(''); setAdding(false);
  };

  const togglePin = async (n) => {
    await supabase.from('notices').update({ pinned: !n.pinned }).eq('id', n.id);
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditContent(n.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    await supabase.from('notices').update({
      content: editContent.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', editingId);
    setEditingId(null);
    setEditContent('');
  };

  const removeNotice = async (n) => {
    if (!window.confirm('이 공지를 삭제할까요?')) return;
    await supabase.from('notices').delete().eq('id', n.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>📌 공지사항</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        <p style={styles.hint}>의국 메모, 컨퍼런스 안내, 공유사항</p>

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : notices.length === 0 && !adding ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            등록된 공지가 없어요
          </div>
        ) : (
          <div style={styles.list}>
            {notices.map((n) => {
              if (editingId === n.id) {
                return (
                  <div key={n.id} style={styles.editBox}>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      rows={3} autoFocus />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>취소</button>
                      <button onClick={saveEdit} style={styles.confirmBtn}>저장</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={n.id} style={{ ...styles.item, background: n.pinned ? 'var(--surface-3)' : 'var(--surface)' }}>
                  <div style={styles.itemHeader}>
                    <button onClick={() => togglePin(n)} style={{ ...styles.pinBtn, color: n.pinned ? 'var(--danger)' : 'var(--text-3)' }} title={n.pinned ? '고정 해제' : '상단 고정'}>
                      📌
                    </button>
                    <span style={styles.author}>{n.created_by || '익명'}</span>
                    <span style={styles.time}>{relativeTime(n.updated_at || n.created_at)}</span>
                    <button onClick={() => startEdit(n)} style={styles.editBtn} title="수정">✎</button>
                    <button onClick={() => removeNotice(n)} style={styles.deleteBtn} title="삭제">×</button>
                  </div>
                  <div style={styles.content}>{n.content}</div>
                </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <div style={styles.addBox}>
            <textarea
              placeholder="공지 내용을 입력하세요"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={addNotice} style={styles.confirmBtn}>등록</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={styles.addNewBtn}>+ 공지 추가</button>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  hint: { fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  item: { border: '1px solid var(--border)', borderRadius: 10, padding: 10 },
  itemHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  pinBtn: { width: 22, height: 22, fontSize: 11, borderRadius: 4 },
  author: { fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  time: { fontSize: 10, color: 'var(--text-3)', flex: 1 },
  editBtn: { width: 22, height: 22, fontSize: 12, color: 'var(--text-3)', borderRadius: 4 },
  deleteBtn: { width: 22, height: 22, fontSize: 14, color: 'var(--text-3)', borderRadius: 4 },
  content: { fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  editBox: { background: 'var(--surface-2)', padding: 10, borderRadius: 10 },
  addBox: { background: 'var(--surface-2)', padding: 10, borderRadius: 10, marginBottom: 8 },
  cancelBtn: { flex: 1, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 },
  confirmBtn: { flex: 1, padding: 8, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  addNewBtn: { width: '100%', padding: 14, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 13 },
};
