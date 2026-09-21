'use client';

import { useState, useEffect, useCallback } from 'react';
import { YEAR_LEVELS } from '../lib/config';
import PetCanvas from './PetCanvas';
import { grouped, findAsset, petAssets, SPECIES_LABEL, STAGE_LABEL, BOND_LABEL } from '../lib/pet/assets';
import {
  loadProfile, loadFeed, loadRanking, adopt, feed, loadFoods, loadFeedState,
  report, voidEntry, todaySlots, todayKST, SLOT_LABELS,
} from '../lib/game';

const ACTION_VERB = {
  attend: '출석했습니다', attend_full: '하루 네 구간을 모두 채웠습니다',
  streak: '연속 출석 중입니다', milestone: '장기 연속을 달성했습니다',
  todo_done: '액팅을 완료했습니다', todo_done_own: '본인이 올린 액팅을 완료했습니다',
  todo_create: '액팅을 등록했습니다', comment: '댓글을 남겼습니다',
  memo_fill: '메모를 채웠습니다', photo: '사진을 첨부했습니다',
  wiki_new: '의국 노트를 작성했습니다', wiki_edit: '의국 노트를 보강했습니다',
  template: '템플릿을 등록했습니다', board: '근무표를 갱신했습니다',
  praise_send: '칭찬을 보냈습니다', praise_recv: '칭찬을 받았습니다',
  visit: '친구 방에 다녀왔습니다', team_goal: '의국 전체 목표를 달성했습니다',
};

// 성장 기준선. 서버의 game_stage() 와 같은 값이어야 한다
const STAGE_NEED = [0, 2000, 8000, 20000];
const BOND_NEED  = [0, 100, 400, 1000, 2500];

function stageOf(total, affection) {
  if (total >= 20000 && affection >= 2500) return 4;
  if (total >= 20000) return 3;
  if (total >= 8000) return 2;
  if (total >= 2000) return 1;
  return 0;
}
function bondOf(a) { let i = 0; BOND_NEED.forEach((n, k) => { if (a >= n) i = k; }); return i; }

function timeLabel(iso) {
  const d = new Date(iso), now = new Date();
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return d.toDateString() === now.toDateString() ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export default function PetView({ currentMember, onClose }) {
  const [tab, setTab] = useState('pet');
  const [profile, setProfile] = useState(null);
  const [asset, setAsset] = useState(null);
  const [slots, setSlots] = useState([]);
  const [feedRows, setFeedRows] = useState([]);
  const [rank, setRank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('idle');

  // 먹이
  const [foods, setFoods] = useState([]);
  const [fedToday, setFedToday] = useState([]);
  const [discovered, setDiscovered] = useState({});
  const [feeding, setFeeding] = useState(false);
  const [feedMsg, setFeedMsg] = useState(null);

  // 입양 폼
  const [pool, setPool] = useState(null);
  const [pickSpecies, setPickSpecies] = useState('cat');
  const [pickBreed, setPickBreed] = useState(null);
  const [pickName, setPickName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const today = todayKST();
    const [p, s, fs] = await Promise.all([
      loadProfile(currentMember.id), todaySlots(currentMember.id),
      loadFeedState(currentMember.id, today),
    ]);
    setProfile(p); setSlots(s);
    setFedToday(fs.todayIds); setDiscovered(fs.discovered);
    if (p?.breed) setAsset(await findAsset(p.species, p.breed));
    setLoading(false);
  }, [currentMember.id]);

  useEffect(() => { refresh(); loadFoods().then(setFoods); }, [refresh]);
  useEffect(() => { if (!profile?.species) grouped().then((g) => { setPool(g); setPickBreed(g.cat[0]?.breed || null); }); }, [profile]);
  useEffect(() => { if (tab === 'feed') loadFeed().then(setFeedRows); if (tab === 'rank') loadRanking().then(setRank); }, [tab]);
  useEffect(() => { if (!feedMsg) return; const t = setTimeout(() => setFeedMsg(null), 3600); return () => clearTimeout(t); }, [feedMsg]);

  async function doAdopt() {
    if (!pickName.trim() || !pickBreed) return;
    setSaving(true);
    const r = await adopt(currentMember.id, pickSpecies, pickBreed, pickName.trim());
    setSaving(false);
    if (!r?.ok) { alert(r?.reason || '실패했습니다'); return; }
    refresh();
  }

  async function doFeed(food) {
    if (feeding) return;
    setFeeding(true);
    const r = await feed(currentMember.id, food.food_id);
    setFeeding(false);
    if (!r?.ok) { setFeedMsg({ bad: true, text: r?.reason || '실패했습니다' }); return; }
    setFeedMsg({
      text: r.liked
        ? `${r.food} — 제일 좋아하는 거예요! 친밀도 +${r.gained}`
        : `${r.food} 를 맛있게 먹었어요. 친밀도 +${r.gained}`,
      liked: r.liked,
    });
    setAction('eat');
    setTimeout(() => setAction(r.liked ? 'play' : 'idle'), 2600);
    setTimeout(() => setAction('idle'), 5200);
    refresh();
  }

  async function doReport(row) {
    const reason = prompt(`"${row.member_name}" 의 이 기록을 신고합니다.\n사유 (선택)`);
    if (reason === null) return;
    const r = await report(row.id, currentMember.id, currentMember.name, reason);
    if (!r.ok) { alert(r.reason); return; }
    alert('신고했습니다. 확인 후 처리됩니다.');
    loadFeed().then(setFeedRows);
  }

  async function doVoid(row) {
    if (!confirm(`${row.member_name} 의 ${row.points}점을 무효 처리할까요?`)) return;
    const r = await voidEntry(row.id, currentMember.name);
    if (!r?.ok) { alert(r?.reason || '실패'); return; }
    loadFeed().then(setFeedRows); refresh();
  }

  const total = profile?.total_earned || 0;
  const affection = profile?.affection || 0;
  const si = stageOf(total, affection);
  const bi = bondOf(affection);
  const adopted = !!profile?.species;

  // 다음 단계까지
  let nextText = null;
  if (si < 3) nextText = `다음 단계 ${STAGE_LABEL[si + 1]} 까지 ${(STAGE_NEED[si + 1] - total).toLocaleString()}점`;
  else if (si === 3) nextText = `단짝이 되려면 친밀도 ${(2500 - affection).toLocaleString()} 더`;
  const stageRatio = si < 3 ? (total - STAGE_NEED[si]) / (STAGE_NEED[si + 1] - STAGE_NEED[si])
                    : si === 3 ? affection / 2500 : 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>🐾 내 펫</h2>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        <div style={styles.tabs}>
          {[['pet', '내 펫'], ['food', '먹이'], ['feed', '활동 기록'], ['rank', '랭킹']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ ...styles.tab, ...(tab === k ? styles.tabOn : {}) }}>{label}</button>
          ))}
        </div>

        {loading ? <div style={styles.empty}>불러오는 중…</div> : <>

          {/* ───────── 입양 ───────── */}
          {!adopted && tab === 'pet' && pool && (
            <div>
              <p style={styles.adoptLead}>함께 지낼 친구를 고르세요.<br />
                <span style={styles.adoptSub}>한 번 고르면 종류와 품종은 바꿀 수 없습니다 (이름은 언제든지)</span></p>

              <div style={styles.speciesRow}>
                {['cat', 'dog', 'special'].map((sp) => (
                  <button key={sp} onClick={() => { setPickSpecies(sp); setPickBreed(pool[sp][0]?.breed); }}
                    style={{ ...styles.speciesBtn, ...(pickSpecies === sp ? styles.speciesOn : {}) }}>
                    {SPECIES_LABEL[sp]}
                  </button>
                ))}
              </div>

              <div style={styles.breedGrid}>
                {(pool[pickSpecies] || []).map((a) => (
                  <button key={a.id} onClick={() => setPickBreed(a.breed)}
                    style={{ ...styles.breedCard, ...(pickBreed === a.breed ? styles.breedOn : {}) }}>
                    <PetCanvas asset={a} stage={3} size={78} action="idle" />
                    <span style={styles.breedName}>{a.name}</span>
                  </button>
                ))}
              </div>

              <input value={pickName} onChange={(e) => setPickName(e.target.value)}
                placeholder="이름을 지어주세요" maxLength={12} style={styles.nameInput} />
              <button onClick={doAdopt} disabled={saving || !pickName.trim()} style={styles.adoptBtn}>
                {saving ? '데려오는 중…' : '데려오기'}
              </button>
            </div>
          )}

          {/* ───────── 내 펫 ───────── */}
          {adopted && tab === 'pet' && (
            <div>
              <div style={styles.stage}>
                {asset ? <PetCanvas asset={asset} stage={si} action={action} size={230} />
                       : <div style={{ height: 210 }} />}
              </div>

              <div style={styles.nameRow}>
                <span style={styles.petName}>{profile.pet_name}</span>
                <span style={styles.badge}>{STAGE_LABEL[si]}</span>
                <span style={styles.bondBadge}>{BOND_LABEL[bi]}</span>
              </div>

              <div style={styles.progWrap}>
                <div style={styles.progTrack}>
                  <div style={{ ...styles.progFill, width: `${Math.round(Math.min(1, Math.max(0, stageRatio)) * 100)}%` }} />
                </div>
                <div style={styles.progText}>{nextText || '다 자랐습니다. 오래오래 함께 지내요.'}</div>
              </div>

              <div style={styles.statGrid}>
                <Stat label="누적 획득" value={total.toLocaleString()} />
                <Stat label="쓸 수 있는 점수" value={(profile.balance || 0).toLocaleString()} />
                <Stat label="친밀도" value={affection.toLocaleString()} />
                <Stat label="연속 출석" value={`${profile.total_streak || 0}일`} />
              </div>

              <div style={styles.sectionHead}>오늘 출석</div>
              <div style={styles.slotRow}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} style={{ ...styles.slot, ...(slots.includes(n) ? styles.slotOn : {}) }}>
                    <span style={{ fontSize: 10 }}>{slots.includes(n) ? '●' : '○'}</span>
                    <span>{SLOT_LABELS[n]}</span>
                  </div>
                ))}
              </div>
              <p style={styles.hint}>네 구간을 다 채우면 보너스가 붙습니다. 16시 이후 접속은 출석으로 세지 않아요.</p>
            </div>
          )}

          {/* ───────── 먹이 ───────── */}
          {tab === 'food' && (
            adopted ? (
              <div>
                <div style={styles.foodTop}>
                  {asset && <PetCanvas asset={asset} stage={si} action={action} size={130} />}
                  <div>
                    <div style={styles.foodBal}>{(profile.balance || 0).toLocaleString()}점</div>
                    <div style={styles.foodBond}>친밀도 {affection.toLocaleString()} · {BOND_LABEL[bi]}</div>
                  </div>
                </div>

                {feedMsg && (
                  <div style={{ ...styles.feedMsg, ...(feedMsg.bad ? styles.feedMsgBad : {}),
                                ...(feedMsg.liked ? styles.feedMsgLiked : {}) }}>{feedMsg.text}</div>
                )}

                <p style={styles.hint}>
                  사료는 하루 한 번, 간식은 하루 두 번까지예요. 안 줘도 펫은 배고파지지 않습니다 —
                  친밀도만 천천히 쌓입니다. <b>이 친구가 좋아하는 간식이 두 가지 있어요.</b> 먹여보면 알 수 있습니다.
                </p>

                <div style={styles.foodGrid}>
                  {foods.map((f) => {
                    const liked = discovered[f.food_id];
                    const count = fedToday.filter((x) => x === f.food_id).length;
                    const kindCount = fedToday.filter((x) =>
                      foods.find((o) => o.food_id === x)?.kind === f.kind).length;
                    const capped = kindCount >= (f.kind === 'kibble' ? 1 : 2);
                    const poor = (profile.balance || 0) < f.price;
                    return (
                      <button key={f.food_id} onClick={() => doFeed(f)}
                        disabled={feeding || capped || poor}
                        style={{ ...styles.foodCard, ...((capped || poor) ? styles.foodOff : {}) }}>
                        <span style={styles.foodName}>
                          {f.name}{liked && <span style={styles.heart}> ♥</span>}
                        </span>
                        <span style={styles.foodPrice}>{f.price}점</span>
                        <span style={styles.foodMeta}>
                          {capped ? '오늘 다 줬어요' : poor ? '점수 부족' : `친밀도 +${f.affection}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={styles.sectionHead}>도감</div>
                <p style={styles.hint}>
                  {Object.keys(discovered).length}/{foods.length} 종류를 먹여봤어요.
                  ♥ 는 이 친구가 좋아하는 것입니다.
                </p>
              </div>
            ) : <div style={styles.empty}>먼저 펫을 데려오세요</div>
          )}

          {/* ───────── 활동 기록 ───────── */}
          {tab === 'feed' && (
            <div>
              <p style={styles.hint}>누가 무엇으로 점수를 받았는지 전부 남습니다. 이상하면 신고해주세요.</p>
              {feedRows.length === 0 && <div style={styles.empty}>아직 기록이 없습니다</div>}
              {feedRows.map((row) => {
                const reports = row.point_reports || [];
                return (
                  <div key={row.id} style={{ ...styles.feedRow, ...(row.voided ? styles.feedVoid : {}) }}>
                    <span style={styles.feedTime}>{timeLabel(row.created_at)}</span>
                    <span style={styles.feedBody}>
                      <b>{row.member_name}</b> 이(가) {ACTION_VERB[row.action] || row.action}
                      {row.detail && <span style={styles.feedDetail}> — {row.detail}</span>}
                    </span>
                    <span style={{ ...styles.feedPts, ...(row.voided ? { textDecoration: 'line-through' } : {}) }}>+{row.points}</span>
                    {row.voided ? <span style={styles.voidTag}>무효</span>
                      : reports.length > 0
                        ? <button onClick={() => doVoid(row)} style={styles.flagged}
                            title={reports.map((r) => `${r.reporter}: ${r.reason || '사유 없음'}`).join('\n')}>⚠ {reports.length}</button>
                        : <button onClick={() => doReport(row)} style={styles.reportBtn}>신고</button>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ───────── 랭킹 ───────── */}
          {tab === 'rank' && (
            <div>
              <p style={styles.hint}>누적 획득 점수 기준입니다. 먹이를 사도 줄어들지 않아요.</p>
              {rank.length === 0 && <div style={styles.empty}>아직 아무도 시작하지 않았습니다</div>}
              {rank.map((r, i) => <RankRow key={r.member_id} row={r} no={i + 1} />)}
            </div>
          )}
        </>}
      </div>
    </div>
  );
}

function RankRow({ row, no }) {
  const [a, setA] = useState(null);
  useEffect(() => { if (row.breed) findAsset(row.species, row.breed).then(setA); }, [row.species, row.breed]);
  const m = row.members || {};
  const meta = YEAR_LEVELS[m.year_level];
  const si = stageOf(row.total_earned || 0, row.affection || 0);
  return (
    <div style={styles.rankRow}>
      <span style={styles.rankNo}>{no}</span>
      <div style={{ width: 42, flexShrink: 0 }}>
        {a && <PetCanvas asset={a} stage={si} action="idle" size={42} />}
      </div>
      <span style={styles.rankName}>
        {m.name}{meta && <span style={{ fontSize: 11, color: meta.color }}> {meta.label}</span>}
      </span>
      <span style={styles.rankPet}>{row.pet_name}</span>
      <span style={styles.rankPts}>{(row.total_earned || 0).toLocaleString()}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 500 },
  close: { width: 40, height: 40, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  tabs: { display: 'flex', gap: 5, marginBottom: 14 },
  tab: { flex: 1, padding: '9px 4px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-2)' },
  tabOn: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-3)' },
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' },
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, margin: '10px 0' },

  adoptLead: { fontSize: 14, lineHeight: 1.7, textAlign: 'center', marginBottom: 14 },
  adoptSub: { fontSize: 12, color: 'var(--text-3)' },
  speciesRow: { display: 'flex', gap: 6, marginBottom: 12 },
  speciesBtn: { flex: 1, padding: 9, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' },
  speciesOn: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-3)', fontWeight: 600 },
  breedGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 },
  breedCard: { padding: '6px 0 8px', border: '2px solid var(--border)', borderRadius: 12, background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  breedOn: { borderColor: 'var(--text-2)', background: 'var(--surface-2)' },
  breedName: { fontSize: 11, fontWeight: 500 },
  nameInput: { width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, marginBottom: 10, background: 'var(--surface)', color: 'var(--text)' },
  adoptBtn: { width: '100%', padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 600, background: 'var(--text)', color: 'var(--bg)' },

  stage: { display: 'flex', justifyContent: 'center' },
  nameRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  petName: { fontSize: 19, fontWeight: 600 },
  badge: { fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-2)' },
  bondBadge: { fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'var(--surface-3)', color: 'var(--text-2)' },

  progWrap: { marginBottom: 18 },
  progTrack: { height: 8, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' },
  progFill: { height: '100%', background: 'var(--text-2)', borderRadius: 6, transition: 'width .4s' },
  progText: { fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 7 },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 11, color: 'var(--text-3)', marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: 600 },

  sectionHead: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.03em' },
  slotRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 },
  slot: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12, color: 'var(--text-3)' },
  slotOn: { color: 'var(--text)', borderColor: 'var(--text-3)', background: 'var(--surface-2)' },

  foodTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  foodBal: { fontSize: 22, fontWeight: 700 },
  foodBond: { fontSize: 12, color: 'var(--text-3)' },
  feedMsg: { padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13, margin: '4px 0 2px' },
  feedMsgLiked: { background: 'var(--surface-3)', fontWeight: 600 },
  feedMsgBad: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  foodGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18 },
  foodCard: { padding: '10px 4px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' },
  foodOff: { opacity: .42 },
  foodName: { fontSize: 13, fontWeight: 600 },
  heart: { color: '#c2607a' },
  foodPrice: { fontSize: 12, color: 'var(--text-2)' },
  foodMeta: { fontSize: 10, color: 'var(--text-3)' },

  feedRow: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  feedVoid: { opacity: 0.45 },
  feedTime: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0, width: 46, fontVariantNumeric: 'tabular-nums' },
  feedBody: { flex: 1, minWidth: 0, lineHeight: 1.5 },
  feedDetail: { color: 'var(--text-3)' },
  feedPts: { flexShrink: 0, fontWeight: 600, fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' },
  reportBtn: { flexShrink: 0, fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer' },
  flagged: { flexShrink: 0, fontSize: 11, color: '#b4553f', background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer' },
  voidTag: { flexShrink: 0, fontSize: 11, color: 'var(--text-3)' },

  rankRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  rankNo: { width: 20, textAlign: 'right', color: 'var(--text-3)', fontSize: 12, flexShrink: 0 },
  rankName: { fontWeight: 500, flexShrink: 0 },
  rankPet: { flex: 1, minWidth: 0, color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rankPts: { fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
};
