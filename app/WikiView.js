'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { award } from '../lib/game';
import { relativeTime, compressPhoto } from '../lib/utils';

// ── 간단 마크다운 렌더러 ──
function renderContent(content, onImageClick) {
  if (!content) return null;
  const lines = content.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const key = `l${i}`;
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      out.push(
        <img key={key} src={img[2]} alt={img[1]} onClick={() => onImageClick?.(img[2])}
          style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0', border: '1px solid var(--border)', cursor: 'zoom-in' }} />
      );
      return;
    }
    let text = line;
    // 인라인 이미지가 문장 중간에 있으면 그냥 제거하고 텍스트만
    text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    // bold 마커 제거(표시 단순화)
    const isH1 = /^#\s+/.test(text);
    const isH2 = /^##\s+/.test(text);
    const isH3 = /^###\s+/.test(text);
    const isHr = /^---+\s*$/.test(text);
    const isLi = /^(\s*)[-*]\s+/.test(text);
    const liDepth = isLi ? (text.match(/^(\s*)/)[1].length >= 4 ? 1 : 0) : 0;
    text = text.replace(/^#{1,3}\s+/, '').replace(/^(\s*)[-*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1');

    if (isHr) {
      out.push(<hr key={key} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />);
    } else if (isH1 || isH2) {
      out.push(<div key={key} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 12, marginBottom: 4 }}>{text}</div>);
    } else if (isH3) {
      out.push(<div key={key} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 8, marginBottom: 2 }}>{text}</div>);
    } else if (isLi) {
      out.push(
        <div key={key} style={{ display: 'flex', gap: 6, paddingLeft: 8 + liDepth * 16, fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
          <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>•</span>
          <span style={{ wordBreak: 'break-word' }}>{text}</span>
        </div>
      );
    } else if (text.trim() === '') {
      out.push(<div key={key} style={{ height: 6 }} />);
    } else {
      out.push(<div key={key} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', wordBreak: 'break-word' }}>{text}</div>);
    }
  });
  return out;
}

export default function WikiView({ currentMember, onClose, onPhotoClick }) {
  const [categories, setCategories] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKw, setSearchKw] = useState('');
  const [openDoc, setOpenDoc] = useState(null); // 보기 중인 문서
  const [editing, setEditing] = useState(null); // { id?, title, content, category_id, parent_id }
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [browseCat, setBrowseCat] = useState(null); // 카테고리 상세 진입 (null=홈 카드 화면)
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleWikiPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const parts = [];
      for (const file of files.slice(0, 5)) {
        const compressed = await compressPhoto(file);
        const fileName = `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage.from('wiki-images').upload(fileName, compressed, { contentType: 'image/jpeg' });
        if (error) { alert('사진 업로드 실패: ' + error.message); continue; }
        const { data } = supabase.storage.from('wiki-images').getPublicUrl(fileName);
        parts.push(`![사진](${data.publicUrl})`);
      }
      if (parts.length > 0) {
        setEditing((ed) => ({ ...ed, content: (ed.content ? ed.content + '\n\n' : '') + parts.join('\n') }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: documents }] = await Promise.all([
      supabase.from('wiki_categories').select('*').order('display_order').order('id'),
      supabase.from('wiki_documents').select('*').order('display_order').order('title'),
    ]);
    setCategories(cats || []);
    setDocs(documents || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('wiki-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wiki_documents' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wiki_categories' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  // openDoc을 최신 데이터로 동기화
  useEffect(() => {
    if (openDoc) {
      const fresh = docs.find((d) => d.id === openDoc.id);
      if (fresh && (fresh.content !== openDoc.content || fresh.title !== openDoc.title)) setOpenDoc(fresh);
    }
  }, [docs]);

  const kw = searchKw.trim().toLowerCase();
  // 검색: 제목 + 본문 전체 (하위 페이지 포함 — 모든 문서가 대상)
  const searched = kw
    ? docs.filter((d) => (d.title || '').toLowerCase().includes(kw) || (d.content || '').toLowerCase().includes(kw))
    : null;

  const topDocs = docs.filter((d) => !d.parent_id);

  const childrenOf = (id) => docs.filter((d) => d.parent_id === id);
  const catName = (id) => categories.find((c) => c.id === id)?.name || '';

  const saveDoc = async () => {
    const t = editing.title.trim();
    if (!t) { alert('제목을 입력해주세요.'); return; }
    if (editing.id) {
      await supabase.from('wiki_documents').update({
        title: t, content: editing.content,
        category_id: editing.category_id,
        updated_by: currentMember?.name || '익명',
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
      // 보강은 100자 이상 바뀌었을 때만 인정한다 (오타 하나로 40점은 과하다)
      if (currentMember?.id && (editing.content || '').length >= 100) {
        award(currentMember.id, 'wiki_edit', `wikiedit:${editing.id}`, t);
      }
    } else {
      const { data: doc } = await supabase.from('wiki_documents').insert([{
        title: t, content: editing.content,
        category_id: editing.category_id,
        parent_id: editing.parent_id || null,
        created_by: currentMember?.name || '익명',
      }]).select('id').single();
      if (doc && currentMember?.id) award(currentMember.id, 'wiki_new', `wikinew:${doc.id}`, t);
    }
    setEditing(null);
    load();
  };

  const deleteDoc = async (doc) => {
    const kids = childrenOf(doc.id);
    const msg = kids.length > 0
      ? `"${doc.title}"과 하위 페이지 ${kids.length}개를 모두 삭제할까요?`
      : `"${doc.title}"을 삭제할까요?`;
    if (!window.confirm(msg)) return;
    await supabase.from('wiki_documents').delete().eq('id', doc.id);
    setOpenDoc(null);
    load();
  };

  const addCategory = async () => {
    const n = newCatName.trim();
    if (!n) return;
    await supabase.from('wiki_categories').insert([{ name: n, display_order: categories.length + 1 }]);
    setNewCatName('');
  };
  const deleteCategory = async (c) => {
    const cnt = docs.filter((d) => d.category_id === c.id).length;
    if (!window.confirm(`"${c.name}" 카테고리를 삭제할까요?${cnt ? ` (문서 ${cnt}개는 미분류로 남습니다)` : ''}`)) return;
    await supabase.from('wiki_categories').delete().eq('id', c.id);
  };

  // ───────── 편집 화면 ─────────
  if (editing) {
    return (
      <div className="modal-overlay" onClick={() => setEditing(null)}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
          <div style={styles.header}>
            <h2 style={styles.title}>{editing.id ? '문서 수정' : editing.parent_id ? '하위 페이지 추가' : '새 문서'}</h2>
            <button onClick={() => setEditing(null)} style={styles.close}>×</button>
          </div>
          <input type="text" placeholder="제목" value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus />
          {!editing.parent_id && (
            <select value={editing.category_id || ''} onChange={(e) => setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })}
              style={{ marginTop: 8 }}>
              <option value="">카테고리 없음</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <textarea placeholder={"내용 입력...\n\n간단 서식:\n## 제목\n- 목록"} value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            rows={14} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={styles.photoAddBtn}>
            {uploading ? '⏳ 업로드 중...' : '📷 사진 추가 (본문 끝에 삽입)'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleWikiPhoto} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(null)} style={styles.cancelBtn}>취소</button>
            <button onClick={saveDoc} style={styles.saveBtn} disabled={uploading}>저장</button>
          </div>
        </div>
      </div>
    );
  }

  // ───────── 문서 보기 ─────────
  if (openDoc) {
    const kids = childrenOf(openDoc.id);
    const parent = openDoc.parent_id ? docs.find((d) => d.id === openDoc.parent_id) : null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
          <div style={styles.header}>
            <button onClick={() => setOpenDoc(parent || null)} style={styles.backBtn}>
              ‹ {parent ? parent.title.slice(0, 10) : '목록'}
            </button>
            <button onClick={onClose} style={styles.close}>×</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, flex: 1, wordBreak: 'break-word' }}>{openDoc.title}</h2>
          </div>
          <div style={styles.docMeta}>
            {openDoc.category_id && <span style={styles.catBadge}>{catName(openDoc.category_id)}</span>}
            {openDoc.created_by && <span>등록: {openDoc.created_by}</span>}
            {openDoc.updated_by && <span> · 수정: {openDoc.updated_by} ({relativeTime(openDoc.updated_at)})</span>}
          </div>

          <div style={styles.docActions}>
            <button onClick={() => setEditing({ id: openDoc.id, title: openDoc.title, content: openDoc.content || '', category_id: openDoc.category_id, parent_id: openDoc.parent_id })}
              style={styles.actionBtn}>✎ 수정</button>
            <button onClick={() => setEditing({ title: '', content: '', category_id: openDoc.category_id, parent_id: openDoc.id })}
              style={styles.actionBtn}>+ 하위 페이지</button>
            <button onClick={() => deleteDoc(openDoc)} style={{ ...styles.actionBtn, color: 'var(--danger)' }}>삭제</button>
          </div>

          {kids.length > 0 && (
            <div style={styles.childList}>
              {kids.map((k) => (
                <button key={k.id} onClick={() => setOpenDoc(k)} style={styles.childItem}>
                  📄 {k.title}
                </button>
              ))}
            </div>
          )}

          <div style={styles.docBody}>
            {renderContent(openDoc.content, (url) => onPhotoClick?.(url, [url]))}
          </div>
        </div>
      </div>
    );
  }

  // ───────── 목록 화면 ─────────
  const browseCatObj = browseCat ? categories.find((c) => c.id === browseCat) : null;
  const catDocs = browseCat ? topDocs.filter((d) => d.category_id === browseCat) : [];
  const uncategorized = topDocs.filter((d) => !d.category_id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '95vh' }}>
        <div style={styles.header}>
          {browseCat && !kw ? (
            <button onClick={() => setBrowseCat(null)} style={styles.backBtn}>‹ 전체</button>
          ) : (
            <h2 style={styles.title}>📖 의국 노트</h2>
          )}
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        <input type="text" placeholder="전체 검색 (제목 + 내용, 하위 페이지 포함)"
          value={searchKw} onChange={(e) => setSearchKw(e.target.value)} />

        {/* ── 검색 결과 ── */}
        {kw ? (
          loading ? (
            <div style={styles.empty}>불러오는 중…</div>
          ) : searched.length === 0 ? (
            <div style={styles.empty}>검색 결과가 없어요</div>
          ) : (
            <div style={styles.list}>
              <div style={styles.resultCount}>{searched.length}건</div>
              {searched.map((d) => (
                <DocRow key={d.id} d={d} kids={childrenOf(d.id)} catName={catName} onOpen={() => setOpenDoc(d)} />
              ))}
            </div>
          )
        ) : browseCat ? (
          /* ── 카테고리 상세 ── */
          <>
            <div style={styles.catDetailHead}>
              <span style={styles.catDetailName}>{browseCatObj?.name}</span>
              <span style={styles.catDetailCount}>{catDocs.length}개 문서</span>
            </div>
            {loading ? (
              <div style={styles.empty}>불러오는 중…</div>
            ) : catDocs.length === 0 ? (
              <div style={styles.empty}>이 카테고리에 문서가 없어요</div>
            ) : (
              <div style={styles.list}>
                {catDocs.map((d) => (
                  <DocRow key={d.id} d={d} kids={childrenOf(d.id)} catName={null} onOpen={() => setOpenDoc(d)} />
                ))}
              </div>
            )}
            <button onClick={() => setEditing({ title: '', content: '', category_id: browseCat, parent_id: null })}
              style={styles.addNewBtn}>+ 이 카테고리에 새 문서</button>
          </>
        ) : (
          /* ── 홈: 카테고리 카드 ── */
          <>
            {loading ? (
              <div style={styles.empty}>불러오는 중…</div>
            ) : (
              <div style={styles.catGrid}>
                {categories.map((c) => {
                  const cnt = topDocs.filter((d) => d.category_id === c.id).length;
                  return (
                    <button key={c.id} onClick={() => setBrowseCat(c.id)} style={styles.catCard}>
                      <span style={styles.catCardIcon}>📁</span>
                      <span style={styles.catCardName}>{c.name}</span>
                      <span style={styles.catCardCount}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {uncategorized.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.uncatLabel}>미분류 {uncategorized.length}</div>
                <div style={styles.list}>
                  {uncategorized.map((d) => (
                    <DocRow key={d.id} d={d} kids={childrenOf(d.id)} catName={null} onOpen={() => setOpenDoc(d)} />
                  ))}
                </div>
              </div>
            )}

            {managingCats && (
              <div style={styles.catManage} className="fade-in">
                {categories.map((c) => (
                  <div key={c.id} style={styles.catManageRow}>
                    <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                    <button onClick={() => deleteCategory(c)} style={styles.catDelBtn}>삭제</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input type="text" placeholder="새 카테고리" value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
                  <button onClick={addCategory} style={styles.catAddBtn}>추가</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button onClick={() => setEditing({ title: '', content: '', category_id: null, parent_id: null })}
                style={{ ...styles.addNewBtn, marginTop: 0, flex: 1 }}>+ 새 문서</button>
              <button onClick={() => setManagingCats(!managingCats)}
                style={{ ...styles.addNewBtn, marginTop: 0, width: 90, flexShrink: 0 }}>⚙ 분류</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DocRow({ d, kids, catName, onOpen }) {
  return (
    <button onClick={onOpen} style={styles.docItem}>
      <div style={styles.docItemTitle}>
        {d.parent_id ? '↳ ' : ''}{d.title}
        {kids.length > 0 && <span style={styles.kidCount}> 📄{kids.length}</span>}
      </div>
      <div style={styles.docItemMeta}>
        {catName && d.category_id && <span style={styles.catBadgeSmall}>{catName(d.category_id)}</span>}
        <span style={styles.docPreview}>
          {(d.content || '').replace(/[#\-*!\[\]()]/g, ' ').replace(/https?:\/\/\S+/g, '').trim().slice(0, 40)}
        </span>
      </div>
    </button>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  backBtn: { padding: '4px 8px', fontSize: 14, color: 'var(--text-2)' },
  catRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  catChip: { padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 100 },
  catGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 },
  catCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '14px 12px', textAlign: 'left',
  },
  catCardIcon: { fontSize: 18, flexShrink: 0 },
  catCardName: { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'keep-all' },
  catCardCount: { fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 10, flexShrink: 0 },
  catDetailHead: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12, marginBottom: 8, padding: '0 2px' },
  catDetailName: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  catDetailCount: { fontSize: 11, color: 'var(--text-3)' },
  uncatLabel: { fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, padding: '0 2px' },
  photoAddBtn: { width: '100%', padding: 10, marginTop: 8, background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 },
  catManage: { background: 'var(--surface-2)', padding: 10, borderRadius: 10, marginTop: 8 },
  catManageRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' },
  catDelBtn: { fontSize: 11, color: 'var(--danger)', padding: '2px 8px' },
  catAddBtn: { padding: '6px 14px', fontSize: 12, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  resultCount: { fontSize: 11, color: 'var(--text-3)' },
  docItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'left' },
  docItemTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' },
  kidCount: { fontSize: 10, color: 'var(--text-3)', fontWeight: 400 },
  docItemMeta: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 },
  catBadgeSmall: { fontSize: 10, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 100, flexShrink: 0 },
  docPreview: { fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  empty: { textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 },
  addNewBtn: { width: '100%', padding: 14, marginTop: 12, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--text-2)', fontSize: 13 },
  docMeta: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 6 },
  catBadge: { fontSize: 11, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 100 },
  docActions: { display: 'flex', gap: 6, marginTop: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' },
  actionBtn: { padding: '6px 12px', fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)' },
  childList: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, padding: 8, background: 'var(--surface-2)', borderRadius: 10 },
  childItem: { padding: '8px 10px', fontSize: 13, fontWeight: 500, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'left' },
  docBody: { marginTop: 12, paddingBottom: 8 },
};
