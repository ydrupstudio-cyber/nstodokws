'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { YEAR_LEVELS, ASSIGNEE_ORDER, WARD_CHIPS } from '../lib/config';
import { compressPhoto, formatTimeLabel, parseProfessorBracket } from '../lib/utils';

export default function EditTaskModal({ task, professors = [], currentMember, onClose, onSaved }) {
  // [X] 패턴 자동 정리해서 초기값 설정
  const knownInitials = professors.map((p) => p.initial);
  const parsedText = parseProfessorBracket(task.text, knownInitials);
  const parsedMemo = parseProfessorBracket(task.memo, knownInitials);

  const [text, setText] = useState(parsedText.cleanText || task.text || '');
  const [memo, setMemo] = useState(parsedMemo.cleanText || task.memo || '');
  const [yearLevel, setYearLevel] = useState(task.year_level || 'r1');
  const [dueTime, setDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : '');
  const [ward, setWard] = useState(task.ward || null);
  const [professor, setProfessor] = useState(task.professor || parsedText.profInitial || parsedMemo.profInitial || null);
  const [urgent, setUrgent] = useState(task.urgent || false);
  const [tags, setTags] = useState(task.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [photos, setPhotos] = useState(task.photo_urls || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) { setTagInput(''); return; }
    setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t) => setTags(tags.filter((x) => x !== t));

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const slots = 5 - photos.length;
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
      setPhotos([...photos, ...urls]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (url) => {
    setPhotos(photos.filter((u) => u !== url));
    // 스토리지에서도 삭제
    const path = url.split('/').pop();
    if (path) {
      await supabase.storage.from('todo-photos').remove([path]).catch(() => {});
    }
  };

  const save = async () => {
    if (!text.trim()) {
      alert('할일 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('todos')
        .update({
          text: text.trim(),
          memo: memo.trim() || null,
          year_level: yearLevel,
          due_time: dueTime || null,
          ward: ward,
          professor: professor,
          urgent: urgent,
          tags: tags,
          photo_urls: photos,
          updated_at: new Date().toISOString(),
          updated_by: currentMember?.name || '익명',
        })
        .eq('id', task.id);

      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>할일 수정</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        {/* 교수님 칩 */}
        {professors.length > 0 && (
          <div style={styles.chipRow}>
            <span style={styles.chipLabel}>교수</span>
            <button onClick={() => setProfessor(null)} style={{ ...styles.chip, background: !professor ? 'var(--text-3)' : 'var(--surface)', color: !professor ? 'var(--bg)' : 'var(--text-3)' }}>없음</button>
            {professors.map((p) => (
              <button key={p.id} onClick={() => setProfessor(professor === p.initial ? null : p.initial)}
                style={{ ...styles.chip, background: professor === p.initial ? 'var(--text)' : 'var(--surface)', color: professor === p.initial ? 'var(--bg)' : 'var(--text)', fontWeight: 600 }}>
                {p.initial}
              </button>
            ))}
          </div>
        )}

        {/* 병동 칩 */}
        <div style={styles.chipRow}>
          <span style={styles.chipLabel}>병동</span>
          <button onClick={() => setWard(null)} style={{ ...styles.chip, background: !ward ? 'var(--text-3)' : 'var(--surface)', color: !ward ? 'var(--bg)' : 'var(--text-3)' }}>없음</button>
          {WARD_CHIPS.map((w) => (
            <button key={w} onClick={() => setWard(ward === w ? null : w)}
              style={{ ...styles.chip, background: ward === w ? 'var(--info)' : 'var(--surface)', color: ward === w ? 'white' : 'var(--text-2)' }}>
              {w}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={styles.fieldLabel}>할일</label>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="할일 내용" />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={styles.fieldLabel}>메모</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="메모 (선택)" />
        </div>

        <div style={styles.row2}>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>담당자</label>
            <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}>
              {ASSIGNEE_ORDER.map((k) => <option key={k} value={k}>{YEAR_LEVELS[k].full}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>시간</label>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
        </div>

        {/* 태그 */}
        <div style={{ marginTop: 10 }}>
          <label style={styles.fieldLabel}>태그</label>
          <div style={styles.tagInputRow}>
            <input type="text" value={tagInput} placeholder="새 태그 입력 후 Enter"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              style={{ flex: 1 }} />
            <button onClick={addTag} style={styles.tagAddBtn}>+</button>
          </div>
          {tags.length > 0 && (
            <div style={styles.tagsList}>
              {tags.map((t) => (
                <span key={t} style={styles.tagPill}>
                  #{t}
                  <button onClick={() => removeTag(t)} style={styles.tagRemove}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 사진 */}
        <div style={{ marginTop: 10 }}>
          <label style={styles.fieldLabel}>사진 ({photos.length}/5)</label>
          {photos.length > 0 && (
            <div style={styles.photoGrid}>
              {photos.map((url) => (
                <div key={url} style={styles.photoItem}>
                  <img src={url} alt="" style={styles.photoImg} />
                  <button onClick={() => removePhoto(url)} style={styles.photoRemove}>×</button>
                </div>
              ))}
            </div>
          )}
          {photos.length < 5 && (
            <>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={styles.photoAddBtn}>
                {uploading ? '⏳ 업로드 중...' : '📷 사진 추가'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />
            </>
          )}
        </div>

        {/* 긴급 */}
        <label style={styles.urgentRow}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          <span style={{ color: urgent ? 'var(--danger)' : 'var(--text)', fontWeight: urgent ? 600 : 400 }}>
            긴급으로 표시
          </span>
        </label>

        {/* 버튼 */}
        <div style={styles.btnRow}>
          <button onClick={onClose} style={styles.cancelBtn} disabled={saving}>취소</button>
          <button onClick={save} style={styles.saveBtn} disabled={saving || uploading}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  chipRow: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  chipLabel: { fontSize: 11, color: 'var(--text-2)', marginRight: 2, fontWeight: 500, width: 30 },
  chip: { padding: '4px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, minWidth: 28 },
  fieldLabel: { display: 'block', fontSize: 11, color: 'var(--text-2)', marginBottom: 4, fontWeight: 500 },
  row2: { display: 'flex', gap: 8, marginTop: 10 },
  tagInputRow: { display: 'flex', gap: 6 },
  tagAddBtn: { width: 40, padding: 0, fontSize: 18, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontWeight: 600 },
  tagsList: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagPill: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 100 },
  tagRemove: { fontSize: 14, color: 'var(--text-3)', padding: 0, marginLeft: 2 },
  photoGrid: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  photoItem: { position: 'relative', width: 64, height: 64 },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, fontSize: 13, background: 'var(--text)', color: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  photoAddBtn: { width: '100%', padding: 10, background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 },
  urgentRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  btnRow: { display: 'flex', gap: 8, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)', fontSize: 14 },
  saveBtn: { flex: 2, padding: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontSize: 14, fontWeight: 500 },
};
