'use client';

// ============================================================
// 방 위에 겹쳐 뜨는 서랍들 — 가방 · 옷장 · 함께했던 친구들
//
// 방 화면(PetView)이 주인이고 이것들은 그 위에 덮이는 판이다.
// 모달을 또 띄우지 않는 이유: 방을 가리지 않고 아래에서 올라와야
// '키우기 게임' 처럼 읽힌다. 싸이월드 미니홈피의 서랍과 같은 자리다.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { ASSET_BASE } from '../lib/pet/room';
import UiIcon from './UiIcon';
import PetCanvas from './PetCanvas';
import { findAsset, SPECIES_LABEL } from '../lib/pet/assets';
import {
  feed, equip, release, loadPetHistory, josa, livedSpan, stageOf, WEAR_SLOTS, STAGE_LABELS,
} from '../lib/game';

/**
 * 떠난 친구의 마지막 모습.
 * 이름과 숫자만 남기면 목록이 글자뿐이라, 무엇을 입고 어떤 모습이었는지 그린다.
 * 기록이니까 움직이지 않는다 — 가만히 서 있는 한 장이다.
 */
function PetPortrait({ row, size = 64 }) {
  const [asset, setAsset] = useState(null);
  useEffect(() => {
    let dead = false;
    if (row.breed) findAsset(row.species, row.breed).then((a) => { if (!dead) setAsset(a); });
    return () => { dead = true; };
  }, [row.species, row.breed]);
  if (!asset) return <div style={{ width: size, height: size * 0.95, flexShrink: 0 }} />;
  return (
    <div style={{ width: size, flexShrink: 0 }}>
      <PetCanvas asset={asset} stage={row.stage ?? 3} action="idle" size={size}
                 wearing={row.equipped && Object.keys(row.equipped).length ? row.equipped : null} />
    </div>
  );
}

/** 아래에서 올라오는 판 */
export function Sheet({ title, onClose, children, foot, bottom = 62 }) {
  return (
    <div style={{ ...s.wrap, bottom }}>
      <div style={s.head}>
        <span style={s.headTitle}>{title}</span>
        <button onClick={onClose} style={s.headClose}>닫기</button>
      </div>
      <div style={s.body}>{children}</div>
      {foot}
    </div>
  );
}

// ============================================================
// 가방 — 사둔 간식을 꺼내 먹인다
//   사는 것은 상점, 먹이는 것은 여기. 돈은 살 때 이미 냈다.
// ============================================================
export function BagPanel({ currentMember, inventory, foods, fedToday, discovered, onClose, onFed, bottom }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3400); return () => clearTimeout(t); }, [msg]);

  // 가방에 든 먹이만 (수량 0 은 서버가 지운다)
  const rows = foods
    .map((f) => ({ ...f, qty: inventory[f.food_id] || 0 }))
    .filter((f) => f.qty > 0);

  const kindCount = (kind) =>
    fedToday.filter((x) => foods.find((o) => o.food_id === x)?.kind === kind).length;

  async function give(f) {
    if (busy) return;
    setBusy(f.food_id);
    const r = await feed(currentMember.id, f.food_id);
    setBusy(null);
    if (!r?.ok) { setMsg({ bad: true, text: r?.reason || '먹이지 못했어요' }); return; }
    setMsg({
      good: true,
      text: r.liked
        ? `${r.food} — 제일 좋아하는 거예요! 친밀도 +${r.gained}`
        : `${r.food} 맛있게 먹었어요. 친밀도 +${r.gained}`,
    });
    onFed?.(r);
  }

  return (
    <Sheet title="가방" onClose={onClose} bottom={bottom}>
      {msg && <div style={{ ...s.msg, ...(msg.bad ? s.msgBad : {}) }}>{msg.text}</div>}

      {rows.length === 0 ? (
        <div style={s.empty}>
          <UiIcon name="icon-bag" size={34} style={{ color: 'var(--text-3)', margin: '0 auto 10px' }} />
          가방이 비었어요.<br />
          <span style={s.emptySub}>상점에서 간식을 사면 여기에 들어옵니다.</span>
        </div>
      ) : (
        <div style={s.bagGrid}>
          {rows.map((f) => {
            const cap = f.kind === 'kibble' ? 1 : 2;
            const done = kindCount(f.kind) >= cap;
            const liked = discovered[f.food_id];
            return (
              <button key={f.food_id} onClick={() => give(f)} disabled={busy || done}
                style={{ ...s.bagCard, ...(done ? s.off : {}) }}>
                <span style={s.bagQty}>{f.qty}</span>
                <span style={s.bagName}>{f.name}{liked && <span style={s.heart}> ♥</span>}</span>
                <span style={s.bagMeta}>
                  {done ? '오늘은 그만' : `친밀도 +${f.affection}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p style={s.hint}>
        사료는 하루 한 번, 간식은 하루 두 번까지예요. 안 줘도 배고파지지 않습니다 —
        친밀도가 안 오를 뿐입니다. <b>이 친구가 좋아하는 간식이 두 가지 있어요.</b> 먹여보면 알 수 있습니다.
        비싼 간식일수록 친밀도가 많이 오릅니다.
      </p>
    </Sheet>
  );
}

// ============================================================
// 옷장 — 전체 / 자리별
// ============================================================
export function ClosetPanel({ currentMember, inventory, catalog, shopItems, equipped,
                              wearables = [], species, onClose, onChanged, bottom }) {
  const [cat, setCat] = useState('all');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); }, [msg]);

  // 가지고 있는 착용 아이템.
  // 자리·그림 경로는 manifest 의 wearables 가 정답이다 (에셋 카탈로그에는 없다).
  // 상점 표는 '파는 물건인가' 만 확인하는 데 쓴다.
  const owned = useMemo(() => {
    const byId = {};
    wearables.forEach((w) => { byId[w.id] = w; });
    shopItems.forEach((it) => {
      if (it.kind !== 'wearable' || byId[it.item_id]) return;
      byId[it.item_id] = { id: it.item_id, name: it.name, slot: it.slot || 'neck', path: null };
    });
    return Object.keys(inventory)
      .filter((id) => byId[id])
      .map((id) => ({ ...byId[id], id }));
  }, [inventory, shopItems, wearables]);

  /** 귀걸이는 귀가 있는 캐릭터만 — 뇌·척추는 부착점 자체가 없다 */
  const wearableHere = (item) =>
    !Array.isArray(item.available) || item.available.includes(species);

  const slotsWithItems = WEAR_SLOTS.filter((w) => owned.some((o) => o.slot === w.slot));
  const shown = cat === 'all' ? owned : owned.filter((o) => o.slot === cat);

  async function toggle(item) {
    if (busy) return;
    if (!wearableHere(item)) {
      setMsg({ bad: true, text: `${item.name} 은(는) 이 친구에게 채울 곳이 없어요` });
      return;
    }
    const on = equipped?.[item.slot] === item.id;
    setBusy(item.id);
    const r = await equip(currentMember.id, item.slot, on ? null : item.id);
    setBusy(null);
    if (!r?.ok) { setMsg({ bad: true, text: r?.reason || '입히지 못했어요' }); return; }
    setMsg({ text: on ? `${item.name} 벗었어요` : `${item.name} 입혔어요` });
    onChanged?.(r.equipped);
  }

  return (
    <Sheet title="옷장" onClose={onClose} bottom={bottom}>
      {msg && <div style={{ ...s.msg, ...(msg.bad ? s.msgBad : {}) }}>{msg.text}</div>}

      {owned.length === 0 ? (
        <div style={s.empty}>
          <UiIcon name="icon-closet" size={34} style={{ color: 'var(--text-3)', margin: '0 auto 10px' }} />
          아직 가진 옷이 없어요.<br />
          <span style={s.emptySub}>상점 <b>꾸미기</b> 칸에서 데려올 수 있습니다.</span>
        </div>
      ) : (
        <>
          <div style={s.chipRow}>
            <button onClick={() => setCat('all')}
              style={{ ...s.chip, ...(cat === 'all' ? s.chipOn : {}) }}>전체</button>
            {slotsWithItems.map((w) => (
              <button key={w.slot} onClick={() => setCat(w.slot)}
                style={{ ...s.chip, ...(cat === w.slot ? s.chipOn : {}) }}>{w.label}</button>
            ))}
          </div>

          <div style={s.wearGrid}>
            {shown.map((item) => {
              const on = equipped?.[item.slot] === item.id;
              const fits = wearableHere(item);
              return (
                <button key={item.id} onClick={() => toggle(item)} disabled={busy}
                  style={{ ...s.wearCard, ...(on ? s.wearOn : {}), ...(fits ? {} : s.off) }}>
                  <div style={s.wearThumb}>
                    {item.path
                      ? <img src={ASSET_BASE + item.path} alt="" style={s.wearImg} />
                      : <span style={s.wearNoImg}>?</span>}
                  </div>
                  <span style={s.wearName}>{item.name}</span>
                  <span style={s.wearState}>{!fits ? '못 채워요' : on ? '입는 중' : '입히기'}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <p style={s.hint}>
        한 자리에 하나씩 입힙니다. 입은 것을 다시 누르면 벗어요.
        독립시켜도 옷은 그대로 남습니다 — 다음 친구가 물려받아요.
      </p>
    </Sheet>
  );
}

// ============================================================
// 함께했던 친구들 + 독립시키기
//   '파양' 이라는 말은 쓰지 않는다. 졸업이고 독립이다.
// ============================================================
export function FamilyPanel({ currentMember, profile, onClose, onReleased, bottom }) {
  const [hist, setHist] = useState([]);
  const [step, setStep] = useState(0);     // 0 목록, 1 확인
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadPetHistory(currentMember.id).then(setHist); }, [currentMember.id]);

  async function doRelease() {
    setBusy(true);
    const r = await release(currentMember.id);
    setBusy(false);
    if (!r?.ok) { setMsg(r?.reason || '실패했습니다'); return; }
    onReleased?.(r);
  }

  const name = profile?.pet_name || '';

  return (
    <Sheet title="함께했던 친구들" onClose={onClose} bottom={bottom}>
      {profile?.species && (
        <div style={s.nowCard}>
          <PetPortrait row={{ ...profile, stage: stageOf(profile.affection || 0) }} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.nowName}>{profile.pet_name}</div>
            <div style={s.nowMeta}>
              지금 함께 · 친밀도 {(profile.affection || 0).toLocaleString()}
              {profile.generation > 1 && ` · ${profile.generation}번째 친구`}
            </div>
            <div style={s.histSpan}>{livedSpan(profile.adopted_at, null).text}
              {livedSpan(profile.adopted_at, null).days != null
                && ` · ${livedSpan(profile.adopted_at, null).days}일째`}</div>
          </div>
        </div>
      )}

      {hist.length === 0 ? (
        <p style={s.hint}>아직 독립한 친구가 없습니다.</p>
      ) : (
        hist.map((h) => {
          const span = livedSpan(h.adopted_at, h.released_at);
          return (
            <div key={h.id} style={s.histRow}>
              <span style={s.histGen}>{h.generation}</span>
              <PetPortrait row={h} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.histName}>{h.pet_name}</div>
                <div style={s.histMeta}>
                  {SPECIES_LABEL[h.species] || ''} · {STAGE_LABELS[h.stage] || ''}
                  {' · 친밀도 '}{(h.affection || 0).toLocaleString()}
                </div>
                <div style={s.histSpan}>
                  {span.text}{span.days != null && ` · ${span.days}일`}
                </div>
              </div>
            </div>
          );
        })
      )}

      {profile?.species && (
        <div style={s.releaseBox}>
          {step === 0 ? (
            <>
              <p style={s.hint}>
                독립시키면 {name}{josa(name, '은', '는')} 이 목록으로 옮겨집니다. 기록은 지워지지 않아요.
                방·가구·벽지·옷·점수는 그대로 남고, 친밀도 0 인 새 친구가 옵니다.
                <b> 친밀도는 되돌릴 수 없습니다.</b>
              </p>
              <button onClick={() => setStep(1)} style={s.releaseBtn}>독립시키기</button>
            </>
          ) : (
            <>
              <p style={s.confirmText}>
                정말 보내시겠어요? 확인을 위해 <b>{name}</b> 이라고 적어주세요.
              </p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)}
                placeholder={name} style={s.confirmInput} />
              {msg && <div style={{ ...s.msg, ...s.msgBad }}>{msg}</div>}
              <div style={s.confirmRow}>
                <button onClick={() => { setStep(0); setTyped(''); }} style={s.cancelBtn}>그만두기</button>
                <button onClick={doRelease} disabled={busy || typed.trim() !== name}
                  style={{ ...s.releaseBtn, ...(typed.trim() !== name ? s.off : {}) }}>
                  {busy ? '보내는 중…' : '보내주기'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

const s = {
  // bottom 은 하단 바 높이만큼 띄운다 (PetView 가 실측해서 넘겨준다).
  // 0 으로 두면 서랍이 하단 바를 덮어 다른 서랍으로 못 옮겨 간다 — 실제로 막혔다
  wrap: { position: 'absolute', left: 0, right: 0, maxHeight: '70%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg)', borderTop: '1px solid var(--border)',
          borderRadius: '14px 14px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,.14)', zIndex: 20 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' },
  headTitle: { fontSize: 14, fontWeight: 700 },
  headClose: { fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', padding: '4px 2px' },
  body: { overflowY: 'auto', padding: '12px 14px 18px' },

  msg: { padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)', fontSize: 13, marginBottom: 10 },
  msgBad: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  empty: { textAlign: 'center', padding: '28px 0', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.8 },
  emptySub: { fontSize: 12, color: 'var(--text-3)' },
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 12 },
  off: { opacity: .42 },
  heart: { color: '#c2607a' },

  bagGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 },
  bagCard: { position: 'relative', padding: '12px 4px 10px', border: '1px solid var(--border)',
             borderRadius: 11, background: 'var(--surface)', display: 'flex',
             flexDirection: 'column', gap: 3, alignItems: 'center' },
  bagQty: { position: 'absolute', top: 3, right: 5, fontSize: 10, fontWeight: 700,
            background: 'var(--text)', color: 'var(--bg)', borderRadius: 9, padding: '1px 6px' },
  bagName: { fontSize: 13, fontWeight: 600, textAlign: 'center', wordBreak: 'keep-all' },
  bagMeta: { fontSize: 10, color: 'var(--text-3)' },

  chipRow: { display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 },
  chip: { flexShrink: 0, padding: '6px 12px', borderRadius: 16, fontSize: 12,
          border: '1px solid var(--border)', color: 'var(--text-2)', whiteSpace: 'nowrap' },
  chipOn: { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)', fontWeight: 600 },
  wearGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 },
  wearCard: { border: '1px solid var(--border)', borderRadius: 11, padding: '6px 4px 7px',
              background: 'var(--surface)', textAlign: 'center' },
  wearOn: { borderColor: 'var(--text)', background: 'var(--surface-2)' },
  wearThumb: { height: 50, display: 'grid', placeItems: 'center' },
  wearImg: { width: 62, height: 50, objectFit: 'contain' },
  wearNoImg: { fontSize: 20, color: 'var(--text-3)' },
  wearName: { display: 'block', fontSize: 11, fontWeight: 600, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  wearState: { display: 'block', fontSize: 10, color: 'var(--text-3)', marginTop: 2 },

  nowCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
             border: '1px solid var(--text-3)', borderRadius: 11, background: 'var(--surface-2)',
             marginBottom: 12 },
  nowName: { fontSize: 15, fontWeight: 700 },
  nowMeta: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  histRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '10px 2px',
             borderBottom: '1px solid var(--border)' },
  histSpan: { fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontVariantNumeric: 'tabular-nums' },
  histGen: { width: 22, height: 22, flexShrink: 0, borderRadius: 11, background: 'var(--surface-2)',
             color: 'var(--text-3)', fontSize: 11, display: 'grid', placeItems: 'center' },
  histName: { fontSize: 13, fontWeight: 600 },
  histMeta: { fontSize: 11, color: 'var(--text-3)', marginTop: 1 },
  histDate: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0 },

  releaseBox: { marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' },
  releaseBtn: { width: '100%', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: '1px solid var(--border)', color: 'var(--text-2)', background: 'var(--surface)' },
  confirmText: { fontSize: 13, lineHeight: 1.7, marginBottom: 10 },
  confirmInput: { width: '100%', padding: 11, border: '1px solid var(--border)', borderRadius: 9,
                  fontSize: 14, background: 'var(--surface)', color: 'var(--text)', marginBottom: 10 },
  confirmRow: { display: 'flex', gap: 7 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600,
               background: 'var(--text)', color: 'var(--bg)' },
};
