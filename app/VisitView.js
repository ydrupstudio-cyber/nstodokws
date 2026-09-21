'use client';

// ============================================================
// 놀러가기
//
// 다른 의국원의 방에 들어간다. 그 집 펫이 살고 있고, 내 펫도 같이 있는다.
// 남의 방이라 가구는 못 건드린다 — 보고, 쓰다듬고, 선물만 한다.
//
// 방문과 선물은 전부 활동 기록(point_ledger)에 남는다.
// 누가 누구 방에 다녀갔고 누가 누구에게 무엇을 줬는지 다 보인다.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import RoomView from './RoomView';
import UiIcon from './UiIcon';
import { Sheet } from './PetPanels';
import { findAsset, SPECIES_LABEL } from '../lib/pet/assets';
import {
  loadNeighbours, visit, gift, loadInventory, loadShopItems,
  stageOf, STAGE_LABELS, BOND_LABELS, josa,
} from '../lib/game';

export default function VisitView({ currentMember, myProfile, onClose, onChanged }) {
  const [list, setList] = useState(null);
  const [host, setHost] = useState(null);       // 지금 놀러간 집
  const [hostAsset, setHostAsset] = useState(null);
  const [myAsset, setMyAsset] = useState(null);
  const [msg, setMsg] = useState(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [inv, setInv] = useState({});
  const [shopItems, setShopItems] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => { loadNeighbours(currentMember.id).then(setList); }, [currentMember.id]);
  useEffect(() => {
    if (myProfile?.breed) findAsset(myProfile.species, myProfile.breed).then(setMyAsset);
  }, [myProfile?.species, myProfile?.breed]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3400); return () => clearTimeout(t); }, [msg]);

  const openGift = useCallback(async () => {
    const [i, sh] = await Promise.all([loadInventory(currentMember.id), loadShopItems()]);
    setInv(i); setShopItems(sh); setGiftOpen(true);
  }, [currentMember.id]);

  async function go(row) {
    setHost(row);
    setHostAsset(row.breed ? await findAsset(row.species, row.breed) : null);
    const r = await visit(currentMember.id, row.member_id);
    if (!r?.ok) { setMsg({ bad: true, text: r?.reason || '들어가지 못했어요' }); return; }
    const a = r.award;
    setMsg(a?.awarded
      ? { text: `${row.members?.name} 님의 방에 왔습니다 · +${a.points}점` }
      : { text: `${row.members?.name} 님의 방에 왔습니다` });
    onChanged?.();
  }

  async function send(itemId, name) {
    if (busy) return;
    setBusy(itemId);
    const r = await gift(currentMember.id, host.member_id, itemId);
    setBusy(null);
    if (!r?.ok) { setMsg({ bad: true, text: r?.reason || '주지 못했어요' }); return; }
    setMsg({ text: `${host.members?.name} 님께 ${name}${josa(name, '을', '를')} 드렸어요` });
    setGiftOpen(false);
    setInv(await loadInventory(currentMember.id));
    onChanged?.();
  }

  // 선물할 수 있는 것 = 가방에 있고 상점이 아는 물건
  const giftable = useMemo(() => {
    const byId = {}; shopItems.forEach((x) => { byId[x.item_id] = x; });
    return Object.entries(inv)
      .filter(([id, q]) => q > 0 && byId[id] && ['food', 'furniture', 'wearable'].includes(byId[id].kind))
      .map(([id, q]) => ({ id, qty: q, ...byId[id] }))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.price - b.price);
  }, [inv, shopItems]);

  // ── 방 목록 ──
  if (!host) {
    return (
      <Sheet title="놀러가기" onClose={onClose}>
        <p style={s.hint}>
          다른 의국원의 방에 들를 수 있어요. 내 펫도 같이 갑니다.
          하루 세 곳까지 점수가 붙고, 같은 방은 하루 한 번만 셉니다.
        </p>
        {list == null && <div style={s.empty}>불러오는 중…</div>}
        {list?.length === 0 && (
          <div style={s.empty}>
            아직 친구를 데려온 분이 없어요.<br />
            <span style={s.sub}>누군가 펫을 데려오면 여기에 뜹니다.</span>
          </div>
        )}
        {(list || []).map((row) => {
          const st = stageOf(row.affection || 0);
          return (
            <button key={row.member_id} onClick={() => go(row)} style={s.row}>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={s.rowName}>{row.members?.name}</div>
                <div style={s.rowSub}>
                  {row.pet_name} · {SPECIES_LABEL[row.species] || ''} {STAGE_LABELS[st]}
                  {row.generation > 1 && ` · ${row.generation}번째 친구`}
                </div>
              </div>
              <span style={s.rowGo}>›</span>
            </button>
          );
        })}
      </Sheet>
    );
  }

  // ── 남의 방 ──
  const hostStage = stageOf(host.affection || 0);
  return (
    <div style={s.visitWrap}>
      <div style={s.visitHead}>
        <button onClick={() => { setHost(null); setGiftOpen(false); }} style={s.back}>‹ 목록</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={s.visitTitle}>{host.members?.name} 님의 미니룸</div>
          <div style={s.visitSub}>
            {host.pet_name} · {STAGE_LABELS[hostStage]} · {BOND_LABELS[hostStage]}
          </div>
        </div>
        <button onClick={onClose} style={s.back}>닫기</button>
      </div>

      <RoomView currentMember={currentMember} profile={host} hostId={host.member_id}
                readOnly bond={hostStage}
                guestPet={myAsset && myProfile?.species
                  ? { asset: myAsset, profile: myProfile, name: myProfile.pet_name } : null} />

      {msg && <div style={{ ...s.msg, ...(msg.bad ? s.msgBad : {}) }}>{msg.text}</div>}

      <div style={s.visitBar}>
        <button onClick={openGift} style={s.giftBtn}>
          <UiIcon name="icon-bag" size={18} style={{ color: 'var(--bg)' }} />
          선물하기
        </button>
      </div>
      <p style={s.hint}>
        남의 방이라 가구는 옮길 수 없어요. 펫을 누르면 쓰다듬고, 바닥을 누르면 내 펫이 그리로 갑니다.
      </p>

      {giftOpen && (
        <Sheet title={`${host.members?.name} 님께 선물`} onClose={() => setGiftOpen(false)} bottom={0}>
          {giftable.length === 0 ? (
            <div style={s.empty}>
              가방에 줄 것이 없어요.<br />
              <span style={s.sub}>상점에서 산 간식·가구·꾸미기를 선물할 수 있습니다.</span>
            </div>
          ) : (
            <div style={s.giftGrid}>
              {giftable.map((g) => (
                <button key={g.id} onClick={() => send(g.id, g.name)} disabled={busy}
                        style={s.giftCard}>
                  <span style={s.giftQty}>{g.qty}</span>
                  <span style={s.giftName}>{g.name}</span>
                  <span style={s.giftKind}>
                    {g.kind === 'food' ? '간식' : g.kind === 'furniture' ? '가구' : '꾸미기'}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p style={s.hint}>
            준 물건은 가방에서 빠지고 상대 가방으로 들어갑니다. 점수는 넘어가지 않아요.
            <b> 주고받은 기록은 둘 다 활동 기록에 남습니다.</b>
          </p>
        </Sheet>
      )}
    </div>
  );
}

const s = {
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, margin: '10px 0' },
  sub: { fontSize: 12, color: 'var(--text-3)' },
  empty: { textAlign: 'center', padding: '30px 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.8 },
  row: { display: 'flex', alignItems: 'center', gap: 8, width: '100%',
         padding: '12px 2px', borderBottom: '1px solid var(--border)', background: 'none' },
  rowName: { fontSize: 14, fontWeight: 600 },
  rowSub: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  rowGo: { fontSize: 20, color: 'var(--text-3)', flexShrink: 0 },

  visitWrap: { position: 'absolute', inset: 0, zIndex: 40, background: 'var(--bg)',
               padding: '0 2px', overflowY: 'auto' },
  visitHead: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 10px',
               borderBottom: '1px solid var(--border)', marginBottom: 10 },
  visitTitle: { fontSize: 14, fontWeight: 700 },
  visitSub: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  back: { fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', padding: '4px 2px', flexShrink: 0 },
  visitBar: { marginTop: 12 },
  giftBtn: { width: '100%', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 700,
             background: 'var(--text)', color: 'var(--bg)', border: 'none',
             display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  msg: { marginTop: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13 },
  msgBad: { background: 'var(--danger-bg)', color: 'var(--danger)' },

  giftGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 },
  giftCard: { position: 'relative', padding: '12px 4px 10px', border: '1px solid var(--border)',
              borderRadius: 11, background: 'var(--surface)', display: 'flex',
              flexDirection: 'column', gap: 3, alignItems: 'center' },
  giftQty: { position: 'absolute', top: 3, right: 5, fontSize: 10, fontWeight: 700,
             background: 'var(--text)', color: 'var(--bg)', borderRadius: 9, padding: '1px 6px' },
  giftName: { fontSize: 12, fontWeight: 600, textAlign: 'center', wordBreak: 'keep-all' },
  giftKind: { fontSize: 10, color: 'var(--text-3)' },
};
