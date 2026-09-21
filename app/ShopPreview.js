'use client';

// ============================================================
// 상점 미리보기
//
// 사기 전에 보고 고를 수 있어야 한다. 셋 다 같은 판 위에 뜨고,
// 같은 카드를 다시 누르면 닫힌다.
//   가구  — 크게, 네 방향 전부
//   꾸미기 — 내 펫에게 실제로 입혀서
//   벽지  — 내 방에 발라서
// ============================================================
import { useMemo } from 'react';
import PetCanvas from './PetCanvas';
import { ASSET_BASE, floorCorners, wallShapes, wallBaseboard, viewBoxFor } from '../lib/pet/room';
import { project } from '../lib/pet/room-engine';   // 좌표 계산은 킷 원본에 있다
import { stageOf } from '../lib/game';

const DIR = ['정면', '오른쪽', '뒤', '왼쪽'];

export function PreviewSheet({ title, sub, onClose, children, foot }) {
  return (
    <div style={s.wrap} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.title}>{title}</div>
            {sub && <div style={s.sub}>{sub}</div>}
          </div>
          <button onClick={onClose} style={s.close}>닫기</button>
        </div>
        <div style={s.body}>{children}</div>
        {foot}
      </div>
    </div>
  );
}

/** 가구 — 크게 보고 네 방향을 돌려본다 */
export function FurniturePreview({ asset, item, onClose, foot }) {
  if (!asset) return null;
  const [w, h] = asset.rotations?.[0]?.footprint || asset.footprint || [1, 1];
  return (
    <PreviewSheet title={asset.name}
      sub={`${asset.rarity} · ${w}×${h}칸 · ${item?.price?.toLocaleString?.() ?? ''}점`}
      onClose={onClose} foot={foot}>
      <div style={s.bigBox}>
        <img src={ASSET_BASE + asset.path} alt="" style={s.big} />
      </div>
      <div style={s.dirRow}>
        {(asset.rotations || []).map((r, i) => (
          <div key={i} style={s.dirCell}>
            <img src={ASSET_BASE + r.source} alt="" style={s.dirImg} />
            <span style={s.dirName}>{DIR[i]}</span>
          </div>
        ))}
      </div>
      <p style={s.note}>
        방에 놓은 뒤 <b>돌리기</b>로 방향을 바꿉니다.
        {asset.interaction && ' 펫이 이 가구를 쓰러 옵니다.'}
      </p>
    </PreviewSheet>
  );
}

/** 꾸미기 — 내 펫에게 입혀본다 */
export function WearPreview({ meta, item, petAsset, profile, equipped, onClose, foot }) {
  const stage = stageOf(profile?.affection || 0);
  // 지금 입은 것 위에 이 아이템만 얹어서 본다
  const tryOn = useMemo(() => ({ ...(equipped || {}), [meta.slot]: meta.id }), [equipped, meta]);
  const blocked = Array.isArray(meta.available) && !meta.available.includes(profile?.species);

  return (
    <PreviewSheet title={meta.name}
      sub={`${meta.rarity} · ${item?.price?.toLocaleString?.() ?? ''}점`}
      onClose={onClose} foot={foot}>
      {blocked ? (
        <div style={s.blocked}>
          이 친구에게는 채울 곳이 없어요.<br />
          <span style={s.sub}>귀걸이는 귀가 있는 친구만 찰 수 있습니다.</span>
        </div>
      ) : (
        <div style={s.tryRow}>
          <div style={s.tryCell}>
            {petAsset && <PetCanvas asset={petAsset} stage={stage} action="idle" size={130}
                                    wearing={equipped && Object.keys(equipped).length ? equipped : null} />}
            <span style={s.tryName}>지금</span>
          </div>
          <span style={s.arrow}>→</span>
          <div style={{ ...s.tryCell, ...s.tryOn }}>
            {petAsset && <PetCanvas asset={petAsset} stage={stage} action="show" size={130} wearing={tryOn} />}
            <span style={s.tryName}>입어보면</span>
          </div>
        </div>
      )}
      <div style={s.itemRow}>
        <img src={ASSET_BASE + meta.path} alt="" style={s.itemImg} />
        <p style={{ ...s.note, margin: 0 }}>
          한 자리에 하나씩 입습니다. 사면 <b>옷장</b>에 들어가고, 독립시켜도 남아요.
        </p>
      </div>
    </PreviewSheet>
  );
}

/** 벽지 — 내 방에 발라본다 */
export function WallpaperPreview({ coll, item, owned, roomSize = 8, onClose, foot }) {
  const wallH = 96;
  const vb = viewBoxFor(roomSize, wallH);
  const walls = wallShapes(roomSize, wallH);
  const corners = floorCorners(roomSize);
  const tiles = [];
  for (let x = 0; x < roomSize; x++) for (let y = 0; y < roomSize; y++) {
    const p = project(x + 0.5, y + 0.5, roomSize);
    tiles.push(<image key={`t${x}-${y}`} href={ASSET_BASE + 'room/floor/floor-wood.svg'}
      x={p.x - 32} y={p.y - 16} width={64} height={32} />);
  }
  const pid = 'wp-prev-' + coll.id;
  return (
    <PreviewSheet title={coll.name}
      sub={`${owned ? '소장중' : (item?.price?.toLocaleString?.() ?? coll.price) + '점'}`}
      onClose={onClose} foot={foot}>
      <div style={s.roomBox}>
        <svg viewBox={vb.join(' ')} style={{ display: 'block', width: '100%', height: 'auto' }}
             role="img" aria-label={coll.name + ' 미리보기'}>
          {coll.patternSource && (
            <defs>
              <pattern id={pid} width="120" height="60" patternUnits="userSpaceOnUse">
                <image href={ASSET_BASE + coll.patternSource} width="120" height="60" />
              </pattern>
            </defs>
          )}
          <polygon points={walls.left} fill={coll.side} />
          <polygon points={walls.right} fill={coll.base} />
          {/* 무늬 없는 벽지(기본 벽)는 단색 그대로 둔다 — 없는 파일을 깔면
              깨진 이미지가 벽 전체에 타일로 찍힌다 (실제로 그랬다) */}
          {coll.patternSource && <>
            <polygon points={walls.left} fill={`url(#${pid})`} />
            <polygon points={walls.right} fill={`url(#${pid})`} />
          </>}
          {coll.baseColor && (() => {
            const bb = wallBaseboard(roomSize, coll.baseboardHeight || 20);
            return (<>
              <polygon points={bb.right} fill={coll.baseColor} />
              <polygon points={bb.left} fill={coll.baseColor} />
            </>);
          })()}
          <polygon points={walls.left} fill="#000" opacity="0.10" />
          <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill="#EFE7DA" />
          {tiles}
        </svg>
      </div>
      <div style={s.swatchRow}>
        {[['base', coll.base], ['side', coll.side], ['ink', coll.ink], ['accent', coll.accent]]
          .filter(([, c]) => c)
          .map(([k, c]) => <span key={k} style={{ ...s.swatch, background: c }} title={k} />)}
        <span style={s.note}>{coll.description || coll.story}</span>
      </div>
    </PreviewSheet>
  );
}

const s = {
  wrap: { position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg)', borderRadius: '16px 16px 0 0',
          boxShadow: '0 -10px 30px rgba(0,0,0,.2)' },
  head: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)' },
  title: { fontSize: 15, fontWeight: 700 },
  sub: { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  close: { fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', padding: '2px 0' },
  body: { overflowY: 'auto', padding: '14px 16px 18px' },
  note: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 12 },

  bigBox: { display: 'grid', placeItems: 'center', background: 'var(--surface-2)',
            borderRadius: 12, padding: 10 },
  big: { width: '86%', maxWidth: 300, height: 'auto', objectFit: 'contain' },
  dirRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 },
  dirCell: { textAlign: 'center', border: '1px solid var(--border)', borderRadius: 9, padding: '4px 2px' },
  dirImg: { width: '100%', height: 46, objectFit: 'contain' },
  dirName: { display: 'block', fontSize: 10, color: 'var(--text-3)' },

  tryRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tryCell: { flex: 1, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 12,
             padding: '6px 2px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tryOn: { borderColor: 'var(--text-2)', background: 'var(--surface-2)' },
  tryName: { fontSize: 11, color: 'var(--text-3)' },
  arrow: { color: 'var(--text-3)', flexShrink: 0 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 },
  itemImg: { width: 60, height: 60, objectFit: 'contain', flexShrink: 0 },
  blocked: { textAlign: 'center', padding: '28px 0', fontSize: 14, lineHeight: 1.8, color: 'var(--text-2)' },

  roomBox: { borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' },
  swatchRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  swatch: { width: 18, height: 18, borderRadius: 5, border: '1px solid var(--border)', flexShrink: 0 },
};
