'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function TemplatesPicker({ onClose, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    load();
    const ch = supabase.channel('templates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('task_templates').select('*')
      .order('display_order', { ascending: true }).order('id', { ascending: true });
    setTemplates(data || []);
    setLoading(false);
  }

  const addTemplate = async () => {
    const t = newText.trim();
    if (!t) return;
    await supabase.from('task_templates').insert([{ text: t }]);
    setNewText('');
    setAdding(false);
  };

  const removeTemplate = async (id) => {
    if (!window.confirm('이 템플릿을 삭제할까요?')) return;
    await supabase.from('task_templates').delete().eq('id', id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>자주 쓰는 할일</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        <p style={styles.hint}>
          클릭하면 입력창에 자동으로 들어가요. 그 뒤에 환자 정보 등을 덧붙이면 편해요.
        </p>

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : templates.length === 0 ? (
          <div style={styles.empty}>등록된 템플릿이 없어요.<br />아래 "+"로 자주 쓰는 할일을 추가해보세요.</div>
        ) : (
          <div style={styles.list}>
            {templates.map((t) => (
              <div key={t.id} style={styles.item}>
                <button onClick={() => onSelect(t.text)} style={styles.itemBtn}>
                  {t.text}
                </button>
                <button onClick={() => removeTemplate(t.id)} style={styles.removeBtn}>×</button>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div style={styles.addBox}>
            <input
              type="text"
              placeholder="새 템플릿 (예: 처방 확인)"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => setAdding(false)} style={styles.cancelBtn}>취소</button>
              <button onClick={addTemplate} style={styles.confirmBtn}>추가</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={styles.addNewBtn}>+ 템플릿 추가</button>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  hint: { fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 12, lineHeight: 1.5 },
  empty: { textAlign: 'center', padding: '32px 20px', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7 },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  item: { display: 'flex', gap: 6 },
  itemBtn: {
    flex: 1, padding: '12px 14px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 10, fontSize: 14,
    color: 'var(--text)', textAlign: 'left',
  },
  removeBtn: {
    width: 38, padding: 0, fontSize: 16, color: 'var(--text-3)',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  },
  addBox: { background: 'var(--surface-2)', padding: 10, borderRadius: 10 },
  cancelBtn: { flex: 1, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 },
  confirmBtn: { flex: 1, padding: 8, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  addNewBtn: { width: '100%', padding: 14, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 13 },
};
