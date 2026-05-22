'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { relativeTime } from '../lib/utils';

export default function DutyScheduleModal({ scheduleKey, title, currentMember, onClose }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
    const channel = supabase.channel(`duty-${scheduleKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_schedules', filter: `key=eq.${scheduleKey}` },
        () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [scheduleKey]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('duty_schedules').select('*').eq('key', scheduleKey).maybeSingle();
    setSchedule(data);
    setLoading(false);
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 1, maxWidthOrHeight: 2000, useWebWorker: true,
        fileType: 'image/jpeg', initialQuality: 0.85,
      });

      // 기존 사진 삭제
      if (schedule?.photo_url) {
        const oldPath = schedule.photo_url.split('/').pop();
        await supabase.storage.from('duty-schedules').remove([oldPath]).catch(() => {});
      }

      const fileName = `${scheduleKey}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('duty-schedules').upload(fileName, compressed, { contentType: 'image/jpeg' });
      if (error) { alert('업로드 실패: ' + error.message); return; }
      const { data } = supabase.storage.from('duty-schedules').getPublicUrl(fileName);

      await supabase.from('duty_schedules').upsert({
        key: scheduleKey, photo_url: data.publicUrl,
        updated_at: new Date().toISOString(), updated_by: currentMember.name,
      });

      load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!schedule?.photo_url) return;
    if (!window.confirm('현재 당직표를 삭제할까요?')) return;
    const path = schedule.photo_url.split('/').pop();
    await supabase.storage.from('duty-schedules').remove([path]).catch(() => {});
    await supabase.from('duty_schedules').update({ photo_url: null, updated_at: new Date().toISOString(), updated_by: currentMember.name }).eq('key', scheduleKey);
    load();
  };

  if (enlarged && schedule?.photo_url) {
    return (
      <div onClick={() => setEnlarged(false)} style={styles.enlargedOverlay}>
        <button onClick={() => setEnlarged(false)} style={styles.enlargedClose}>×</button>
        <img src={schedule.photo_url} alt={title} onClick={(e) => e.stopPropagation()} style={styles.enlargedImg} />
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        {loading ? (
          <div style={styles.empty}>불러오는 중…</div>
        ) : !schedule?.photo_url ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>등록된 당직표가 없어요</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>아래 버튼으로 사진을 업로드해주세요</div>
          </div>
        ) : (
          <>
            <div style={styles.photoBox}>
              <img src={schedule.photo_url} alt={title} onClick={() => setEnlarged(true)} style={styles.photo} />
              <div style={styles.expandHint}>탭해서 크게 보기</div>
            </div>
            <div style={styles.meta}>
              {schedule.updated_at && <span>업데이트: {relativeTime(schedule.updated_at)}</span>}
              {schedule.updated_by && <span> · {schedule.updated_by}</span>}
            </div>
          </>
        )}

        <div style={styles.actions}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={styles.uploadBtn}>
            {uploading ? '업로드 중…' : schedule?.photo_url ? '📷 새 사진으로 교체' : '📷 사진 업로드'}
          </button>
          {schedule?.photo_url && (
            <button onClick={handleDelete} style={styles.deleteBtn}>삭제</button>
          )}
        </div>

        <p style={styles.hintText}>
          사진은 의국원 모두에게 실시간 공유돼요.<br />
          큰 사진(최대 2000px)으로 저장되어 글자가 잘 보입니다.
        </p>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  empty: { textAlign: 'center', padding: '40px 20px' },
  photoBox: { position: 'relative', background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  photo: { width: '100%', display: 'block', cursor: 'zoom-in' },
  expandHint: { position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, padding: '4px 10px', borderRadius: 100 },
  meta: { fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 12 },
  actions: { display: 'flex', gap: 8 },
  uploadBtn: { flex: 1, padding: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, fontSize: 13, fontWeight: 500 },
  deleteBtn: { padding: '0 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--danger)', fontSize: 13 },
  hintText: { fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 },
  enlargedOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  enlargedClose: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, fontSize: 28, color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  enlargedImg: { maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain' },
};
