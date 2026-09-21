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
import { WEAR_SLOTS, josa } from '../lib/game';
import { FurniturePreview, WearPreview, WallpaperPreview } from './ShopPreview';

const KIND_LABEL = {
  seating: '앉는 것', surface: '놓는 것', 'pet-supply': '펫 용품',
  plant: '식물', light: '조명', 'wall-decor': '벽 장식', misc: '잡화',
  storage: '수납', pet: '펫 전용', rug: '바닥깔개', wall: '벽걸이',
};
const RARITY_COLOR = { 일반: 'var(--text-3)', 고급: '#5b7a99', 희귀: '#7a5b8e', 특별: '#8a6e4b' };

function reqId(memberId, itemId) {
  return `${memberId}:${itemId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export default function ShopView({ currentMember, manifest, room, balance,
                                   profile, petAsset, onDone, onClose }) {
  const [tab, setTab] = useState('furniture');
  const [shop, setShop] = useState([]);
  const [foods, setFoods] = useState([]);
  const [inv, setInv] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  // 사기 전에 크게 보고 입혀보는 판. 같은 카드를 다시 누르면 닫힌다
  const [preview, setPreview] = useState(null);   // { kind, id }
  const peek = (kind, id) =>
    setPreview((p) => (p && p.kind === kind && p.id === id ? null : { kind, id }));

  const catalog = useMemo(() => {
    const c = {}; manifest.assets.forEach((a) => { c[a.id] = a; }); return c;
  }, [manifest]);

  const load = async () => {
    const [{ data: s }, { data: i }, { data: f }] = await Promise.all([
      supabase.from('shop_items').select('*'),
      supabase.from('pet_inventory').select('asset_id, qty').eq('member_id', currentMember.id),
      supabase.from('food_items').select('*').neq('kind', 'special').order('sort_order'),
    ]);
    setShop(s || []);
    setFoods(f || []);
    const map = {}; (i || []).forEach((r) => { if (r.qty > 0) map[r.asset_id] = r.qty; });
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
    setMsg({ text: `${data.item}${josa(data.item, '을', '를')} 들였어요` });
    await load();
    onDone?.();
  }

  // 벽걸이(거울·달력)는 벽면 배치 UI 가 생기기 전까지 상점에 올리지 않는다.
  // 바닥 배치기에 넣으면 좌표계가 어긋난다 — 킷 인계서가 경고한 부분이다
  const furniture = shop.filter((x) => x.kind === 'furniture')
    .filter((x) => catalog[x.item_id] && catalog[x.item_id].layer !== 'wall');
  const byKind = {};
  furniture.forEach((x) => {
    const k = catalog[x.item_id]?.kind || 'misc';
    (byKind[k] = byKind[k] || []).push(x);
  });
  Object.values(byKind).forEach((list) => list.sort((a, b) => a.price - b.price));

  const wallpapers = manifest.wallpaperCollections || [];
  const owned = room?.owned_wallpapers || ['plain'];
  const rooms = shop.filter((s) => s.kind === 'room').sort((a, b) => a.level - b.level);

  // 간식 — 가격이 비쌀수록 친밀도가 많이 오른다 (친밀도 값은 food_items 가 갖고 있다)
  const foodIcon = {};
  (manifest.foods || []).forEach((f) => { foodIcon[f.id] = f.path; });
  const snacks = shop.filter((x) => x.kind === 'food')
    .map((x) => ({ ...x, food: foods.find((f) => f.food_id === x.item_id) }))
    .filter((x) => x.food)
    .sort((a, b) => a.price - b.price);

  // 꾸미기 — 파는 것은 shop_items 가, 생김새·자리는 manifest.wearables 가 정답이다.
  // (착용 아이템은 에셋 카탈로그가 아니라 별도 목록에 있다)
  const wearMeta = {};
  (manifest.wearables || []).forEach((w) => { wearMeta[w.id] = w; });
  const wearables = shop.filter((x) => x.kind === 'wearable')
    .map((x) => ({ ...x, meta: wearMeta[x.item_id] }))
    .filter((x) => x.meta);
  const bySlot = {};
  wearables.forEach((x) => { (bySlot[x.meta.slot] = bySlot[x.meta.slot] || []).push(x); });
  Object.values(bySlot).forEach((list) => list.sort((a, b) => a.price - b.price));

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={s.header}>
          <h2 style={s.title}>상점</h2>
          <span style={s.balance}>{(balance || 0).toLocaleString()}점</span>
          <button onClick={onClose} style={s.close}>×</button>
        </div>

        <div style={s.tabs}>
          {[['furniture', '가구'], ['snack', '간식'], ['wear', '꾸미기'],
            ['wallpaper', '벽지'], ['room', '방']].map(([k, l]) => (
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
                    <button onClick={() => peek('furniture', item.item_id)} style={s.peekBtn}>
                      <div style={s.thumb}>
                        <img src={ASSET_BASE + a.path} alt="" style={s.thumbImg} />
                        {have > 0 && <span style={s.haveTag}>{have}</span>}
                      </div>
                      <div style={s.cardName}>{item.name}</div>
                      <div style={{ ...s.rarity, color: RARITY_COLOR[a.rarity] }}>{a.rarity}</div>
                    </button>
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

        {/* ── 간식 ── */}
        {tab === 'snack' && (
          <div>
            <p style={s.hint}>
              산 간식은 <b>가방</b> 에 들어갑니다. 방에서 꺼내 먹이세요.
              비쌀수록 친밀도가 많이 오르고, 이 친구가 좋아하는 것이면 두 배 넘게 오릅니다.
              하루에 사료 1번, 간식 2번까지 먹일 수 있어요.
            </p>
            <div style={s.grid}>
              {snacks.map((item) => {
                const have = inv[item.item_id] || 0;
                const poor = (balance || 0) < item.price;
                const full = have >= 20;
                return (
                  <div key={item.item_id} style={s.card}>
                    <div style={s.thumb}>
                      {foodIcon[item.item_id]
                        ? <img src={ASSET_BASE + foodIcon[item.item_id]} alt="" style={s.wearImg} />
                        : <span style={s.noImg}>{item.food.name}</span>}
                      {have > 0 && <span style={s.haveTag}>{have}</span>}
                    </div>
                    <div style={s.cardName}>{item.food.name}</div>
                    <div style={s.snackKind}>
                      {item.food.kind === 'kibble' ? '사료' : '간식'} · 친밀도 +{item.food.affection}
                    </div>
                    <button onClick={() => buy(item)} disabled={busy || poor || full}
                      style={{ ...s.buy, ...((poor || full) ? s.buyOff : {}) }}>
                      {full ? '가득' : `${item.price}점`}
                    </button>
                  </div>
                );
              })}
            </div>
            {snacks.length === 0 && <div style={s.none}>아직 상점에 올라온 간식이 없습니다</div>}
          </div>
        )}

        {/* ── 꾸미기 ── */}
        {tab === 'wear' && (
          <div>
            <p style={s.hint}>
              한 자리에 하나씩 입힙니다. 산 것은 <b>옷장</b> 에 들어가요.
              독립시켜도 옷은 남습니다 — 다음 친구가 물려받습니다.
            </p>
            {WEAR_SLOTS.filter((w) => bySlot[w.slot]?.length).map((w) => (
              <div key={w.slot} style={{ marginBottom: 18 }}>
                <div style={s.sectionHead}>{w.label}</div>
                <div style={s.grid}>
                  {bySlot[w.slot].map((item) => {
                    const meta = item.meta;
                    const have = (inv[item.item_id] || 0) > 0;
                    const poor = (balance || 0) < item.price;
                    const limited = Array.isArray(meta.available);
                    return (
                      <div key={item.item_id} style={s.card}>
                        <button onClick={() => peek('wear', item.item_id)} style={s.peekBtn}>
                          <div style={s.thumb}>
                            <img src={ASSET_BASE + meta.path} alt="" style={s.wearImg} />
                          </div>
                          <div style={s.cardName}>{meta.name}</div>
                          <div style={{ ...s.rarity, color: RARITY_COLOR[meta.rarity] }}>
                            {meta.rarity}{limited && ' · 동물만'}
                          </div>
                        </button>
                        {have ? <span style={s.ownedTag}>소장중</span> : (
                          <button onClick={() => buy(item)} disabled={busy || poor}
                            style={{ ...s.buy, ...(poor ? s.buyOff : {}) }}>{item.price}점</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {wearables.length === 0 && (
              <div style={s.none}>
                꾸미기 아이템은 준비 중입니다.<br />
                <span style={{ fontSize: 11 }}>모자·목도리·망토·신발이 곧 들어옵니다.</span>
              </div>
            )}
          </div>
        )}

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
                  <button onClick={() => peek('wallpaper', w.id)} style={s.wpPeek}>
                    {/* 색 칩만 보여주면 전부 비슷해 보인다. 실제 도안을 깐다 */}
                    <div style={{ ...s.wpSwatch, background: w.base }}>
                      <img src={ASSET_BASE + w.patternSource} alt="" style={s.wpPattern} />
                      <span style={{ ...s.wpSide, background: w.side, opacity: .55 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={s.wpName}>{w.name}</div>
                      <div style={s.wpStory}>{w.description || w.story}</div>
                    </div>
                  </button>
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
        {preview && (() => {
          const close = () => setPreview(null);
          if (preview.kind === 'furniture') {
            const a = catalog[preview.id];
            const item = shop.find((x) => x.item_id === preview.id);
            const have = inv[preview.id] || 0;
            return <FurniturePreview asset={a} item={item} onClose={close}
              foot={<div style={s.pvFoot}>
                {have >= 4 ? <span style={s.pvFull}>가득 (4개까지)</span> : (
                  <button onClick={() => { buy(item); close(); }}
                    disabled={busy || (balance || 0) < item.price}
                    style={{ ...s.pvBuy, ...((balance || 0) < item.price ? s.buyOff : {}) }}>
                    {item.price.toLocaleString()}점으로 들이기{have > 0 ? ` (${have}개 보유)` : ''}
                  </button>)}
              </div>} />;
          }
          if (preview.kind === 'wear') {
            const meta = wearMeta[preview.id];
            const item = shop.find((x) => x.item_id === preview.id);
            const have = (inv[preview.id] || 0) > 0;
            return <WearPreview meta={meta} item={item} petAsset={petAsset} profile={profile}
              equipped={profile?.equipped || {}} onClose={close}
              foot={<div style={s.pvFoot}>
                {have ? <span style={s.pvFull}>소장중 — 옷장에서 입힐 수 있어요</span> : (
                  <button onClick={() => { buy(item); close(); }}
                    disabled={busy || (balance || 0) < item.price}
                    style={{ ...s.pvBuy, ...((balance || 0) < item.price ? s.buyOff : {}) }}>
                    {item.price.toLocaleString()}점으로 들이기
                  </button>)}
              </div>} />;
          }
          const w = wallpapers.find((x) => x.id === preview.id);
          const item = shop.find((x) => x.item_id === preview.id);
          const has = owned.includes(preview.id);
          return <WallpaperPreview coll={w} item={item} owned={has}
            roomSize={manifest.roomLevels?.[room?.level || 0]?.size || 8} onClose={close}
            foot={<div style={s.pvFoot}>
              {has ? <span style={s.pvFull}>소장중</span> : item ? (
                <button onClick={() => { buy(item); close(); }}
                  disabled={busy || (balance || 0) < item.price}
                  style={{ ...s.pvBuy, ...((balance || 0) < item.price ? s.buyOff : {}) }}>
                  {item.price.toLocaleString()}점으로 바르기
                </button>) : <span style={s.pvFull}>아직 팔지 않습니다</span>}
            </div>} />;
        })()}
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500, flex: 1 },
  balance: { fontSize: 15, fontWeight: 700 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  tabs: { display: 'flex', gap: 4, marginBottom: 12 },
  tab: { flex: 1, padding: '9px 2px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)' },
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
  pvFoot: { padding: '10px 16px 16px', borderTop: '1px solid var(--border)' },
  pvBuy: { width: '100%', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700,
           background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  pvFull: { display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--text-3)', padding: 6 },
  peekBtn: { width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'center', cursor: 'pointer' },
  wpPeek: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer' },
  buy: { width: '100%', padding: '5px 0', borderRadius: 7, fontSize: 11, fontWeight: 600,
         background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  // 목록 행(벽지·방)용. width:100% 를 쓰면 옆의 설명 칸이 한 글자 폭으로 눌린다
  buyRow: { flexShrink: 0, whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: 'var(--text)', color: 'var(--bg)', border: 'none' },
  buyOff: { background: 'var(--surface-2)', color: 'var(--text-3)' },
  wpRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' },
  wpSwatch: { width: 44, height: 44, borderRadius: 8, flexShrink: 0, position: 'relative', overflow: 'hidden',
              border: '1px solid var(--border)' },
  wpPattern: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  wpSide: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%' },
  wpName: { fontSize: 13, fontWeight: 600, wordBreak: 'keep-all' },
  wpStory: { fontSize: 11, color: 'var(--text-3)', marginTop: 1, lineHeight: 1.45 },
  ownedTag: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0 },
  lockTag: { fontSize: 11, color: 'var(--text-3)', opacity: .6, flexShrink: 0 },
  roomRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 10px', marginBottom: 6,
             border: '1px solid var(--border)', borderRadius: 10 },
  roomNow: { background: 'var(--surface-2)', borderColor: 'var(--text-3)' },
  none: { textAlign: 'center', padding: '30px 0', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7 },
  noImg: { fontSize: 11, color: 'var(--text-3)' },
  wearImg: { width: 62, height: 54, objectFit: 'contain' },
  snackTop: { position: 'relative', paddingTop: 6, minHeight: 34, display: 'grid', placeItems: 'center' },
  snackName: { fontSize: 13, fontWeight: 600, wordBreak: 'keep-all', lineHeight: 1.3 },
  snackKind: { fontSize: 10, color: 'var(--text-3)', marginBottom: 5 },
};
