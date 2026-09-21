'use client';

// ============================================================
// 상점 — 가구 · 벽지 · 방 넓히기
//
// 가격·재고·중복 결제 판정은 전부 서버(game_buy)가 한다.
// 이 화면은 목록을 보여주고 요청을 보내는 일만 한다.
// 같은 요청이 두 번 가도 한 번만 결제되도록 requestId 를 만들어 보낸다.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ASSET_BASE } from '../lib/pet/room';

const KIND_LABEL = {
  seating: '앉는 것', surface: '놓는 것', 'pet-supply': '펫 용품',
  plant: '식물', light: '조명', 'wall-decor': '벽걸이', misc: '잡화',
};
const RARITY_COLOR = { 일반: 'var(--text-3)', 고급: '#5b7a99', 희귀: '#7a5b8e', 특별: '#8a6e4b' };

function reqId(memberId, itemId) {
  return `${memberId}:${itemId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export default function ShopView({ currentMember, manifest, room, balance, onDone, onClose }) {
  const [tab, setTab] = useState('furniture');
  const [shop, setShop] = useState([]);
  const [inv, setInv] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const catalog = useMemo(() => {
    const c = {}; manifest.assets.forEach((a) => { c[a.id] = a; }); return c;
  }, [manifest]);

  const load = async () => {
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase.from('shop_items').select('*'),
      supabase.from('pet_inventory').select('asset_id, qty').eq('member_id', currentMember.id),
    ]);
    setShop(s || []);
    const map = {}; (i || []).forEach((r) => { map[r.asset_id] = r.qty; });
    setInv(map);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); }, [msg]);

  async function buy(item) {
    if (busy) return;
    setBusy(item.item_id);
    const { data, error } = await supabase.rpc('game_buy', {
      p_member: currentMember.id, p_item: item.item_id, p_request: reqId(currentMember.id, item.item_id),
    });
    setBusy(null);
    if (error) { setMsg({ bad: true, text: '구매하지 못했어요' }); return; }
    if (!data?.ok) { setMsg({ bad: true, text: data?.reason || '구매하지 못했어요' }); return; }
    setMsg({ text: `${data.item} 을(를) 들였어요` });
    await load();
    onDone?.();
  }

  const furniture = shop.filter((s) => s.kind === 'furniture');
  const byKind = {};
  furniture.forEach((s) => {
    const k = catalog[s.item_id]?.kind || 'misc';
    (byKind[k] = byKind[k] || []).push(s);
  });

  const wallpapers = manifest.wallpaperCollections || [];
  const owned = room?.owned_wallpapers || ['plain'];
  const rooms = shop.filter((s) => s.kind === 'room').sort((a, b) => a.level - b.level);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={s.header}>
          <h2 style={s.title}>상점</h2>
          <span style={s.balance}>{(balance || 0).toLocaleString()}점</span>
          <button onClick={onClose} style={s.close}>×</button>
        </div>

        <div style={s.tabs}>
          {[['furniture', '가구'], ['wallpaper', '벽지'], ['room', '방 넓히기']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ ...s.tab, ...(tab === k ? s.tabOn : {}) }}>{l}</button>
          ))}
        </div>

        {msg && <div style={{ ...s.msg, ...(msg.bad ? s.msgBad : {}) }}>{msg.text}</div>}

        {/* ── 가구 ── */}
        {tab === 'furniture' && Object.entries(byKind).map(([kind, list]) => (
          <div key={kind} style={{ marginBottom: 18 }}>
            <div style={s.sectionHead}>{KIND_LABEL[kind] || kind}</div>
            <div style={s.grid}>
              {list.map((item) => {
                const a = catalog[item.item_id];
                const have = inv[item.item_id] || 0;
                const poor = (balance || 0) < item.price;
                return (
                  <div key={item.item_id} style={s.card}>
                    <div style={s.thumb}>
                      <img src={ASSET_BASE + a.path} alt="" style={s.thumbImg} />
                      {have > 0 && <span style={s.haveTag}>{have}</span>}
                    </div>
                    <div style={s.cardName}>{item.name}</div>
                    <div style={{ ...s.rarity, color: RARITY_COLOR[a.rarity] }}>{a.rarity}</div>
                    <button onClick={() => buy(item)} disabled={busy || poor || have >= 4}
                      style={{ ...s.buy, ...((poor || have >= 4) ? s.buyOff : {}) }}>
                      {have >= 4 ? '가득' : poor ? `${item.price}점` : `${item.price}점`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── 벽지 ── */}
        {tab === 'wallpaper' && (
          <div>
            <p style={s.hint}>
              벽지는 이 게임만의 컬렉션입니다. 등급은 취향과 희소성일 뿐,
              점수를 더 주거나 성장을 빠르게 하지 않아요.
            </p>
            {wallpapers.map((w) => {
              const item = shop.find((x) => x.item_id === w.id);
              const has = owned.includes(w.id);
              const poor = item && (balance || 0) < item.price;
              return (
                <div key={w.id} style={s.wpRow}>
                  <div style={{ ...s.wpSwatch, background: w.base }}>
                    <span style={{ ...s.wpSide, background: w.side }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.wpName}>{w.name}</div>
                    <div style={s.wpStory}>{w.story}</div>
                  </div>
                  {has ? <span style={s.ownedTag}>소장중</span> : (
                    <button onClick={() => buy(item)} disabled={busy || poor || !item}
                      style={{ ...s.buyRow, ...(poor ? s.buyOff : {}) }}>{w.price}점</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 방 ── */}
        {tab === 'room' && (
          <div>
            <p style={s.hint}>
              방을 넓혀도 가구 위치와 소장품은 그대로 유지됩니다. 순서대로만 넓힐 수 있어요.
            </p>
            {(manifest.roomLevels || []).map((lv) => {
              const item = rooms.find((r) => r.level === lv.id);
              const current = (room?.level || 0) === lv.id;
              const done = (room?.level || 0) > lv.id;
              const next = (room?.level || 0) + 1 === lv.id;
              const poor = item && (balance || 0) < item.price;
              return (
                <div key={lv.id} style={{ ...s.roomRow, ...(current ? s.roomNow : {}) }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.wpName}>{lv.name}</div>
                    <div style={s.wpStory}>{lv.size}×{lv.size} · {lv.size * lv.size}칸</div>
                  </div>
                  {done || current ? <span style={s.ownedTag}>{current ? '지금 이 방' : '지남'}</span>
                    : next && item ? (
                      <button onClick={() => buy(item)} disabled={busy || poor}
                        style={{ ...s.buyRow, ...(poor ? s.buyOff : {}) }}>{item.price}점</button>
                    ) : <span style={s.lockTag}>잠김</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500, flex: 1 },
  balance: { fontSize: 15, fontWeight: 700 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  tabs: { display: 'flex', gap: 6, marginBottom: 12 },
  tab: { flex: 1, padding: 9, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' },
  tabOn: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-3)', fontWeight: 600 },
  msg: { padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)', fontSize: 13, marginBottom: 10 },
  msgBad: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: 12 },
  sectionHead: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 },
  card: { border: '1px solid var(--border)', borderRadius: 10, padding: '6px 5px 7px', background: 'var(--surface)', textAlign: 'center' },
  thumb: { position: 'relative', height: 54, display: 'grid', placeItems: 'center', overflow: 'hidden' },
  thumbImg: { width: 76, height: 66, objectFit: 'contain' },
  haveTag: { position: 'absolute', top: 0, right: 2, fontSize: 10, fontWeight: 700,
             background: 'var(--text)', color: 'var(--bg)', borderRadius: 10, padding: '1px 6px' },
  cardName: { fontSize: 11, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rarity: { fontSize: 10, marginBottom: 4 },
  buy: { width: '100%', padding: '5px 0', borderRadius: 7, fontSize: 11, fontWeight: 600,
         background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  // 목록 행(벽지·방)용. width:100% 를 쓰면 옆의 설명 칸이 한 글자 폭으로 눌린다
  buyRow: { flexShrink: 0, whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  buyOff: { background: 'var(--surface-2)', color: 'var(--text-3)' },
  wpRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' },
  wpSwatch: { width: 40, height: 40, borderRadius: 8, flexShrink: 0, position: 'relative', overflow: 'hidden' },
  wpSide: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%' },
  wpName: { fontSize: 13, fontWeight: 600, wordBreak: 'keep-all' },
  wpStory: { fontSize: 11, color: 'var(--text-3)', marginTop: 1, lineHeight: 1.45 },
  ownedTag: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0 },
  lockTag: { fontSize: 11, color: 'var(--text-3)', opacity: .6, flexShrink: 0 },
  roomRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 10px', marginBottom: 6,
             border: '1px solid var(--border)', borderRadius: 10 },
  roomNow: { background: 'var(--surface-2)', borderColor: 'var(--text-3)' },
};
