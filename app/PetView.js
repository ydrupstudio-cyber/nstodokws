'use client';

// ============================================================
// 내 펫 — 방이 곧 화면이다
//
// 들어오면 바로 방에 있는 친구가 보인다. 탭을 눌러 '펫 화면' 으로
// 들어가는 구조가 아니다. 주변 UI 에 점수·친밀도가 늘 떠 있고,
// 아래 서랍에서 가방·옷장·상점·가구를 연다. 미니홈피와 같은 배치다.
//
// 성장은 친밀도가 정한다 (V12). 누적 점수로는 크지 않는다 —
// 점수는 사는 데 쓰고, 먹이고 돌본 만큼 자란다.
// ============================================================
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { YEAR_LEVELS } from '../lib/config';
import PetCanvas from './PetCanvas';
import AttendCalendar from './AttendCalendar';
import RoomView from './RoomView';
import ShopView from './ShopView';
import { BagPanel, ClosetPanel, FamilyPanel, Sheet } from './PetPanels';
import { loadManifest, grouped, findAsset, SPECIES_LABEL } from '../lib/pet/assets';
import { supabase } from '../lib/supabase';
import {
  loadProfile, loadFeed, loadRanking, adopt, loadFoods, loadFeedState,
  loadInventory, loadShopItems, report, voidEntry, todaySlots, todayKST, SLOT_LABELS,
  stageOf, stageProgress, josa, STAGE_LABELS, BOND_LABELS,
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
  admin_grant: '운영 지급을 받았습니다',
};

// 하단 바의 '더보기' 가 열어 주는 것들. 이 중 하나가 떠 있으면 더보기는 '켜짐' 이다
const MORE_PANELS = ['more', 'family', 'attend', 'feed', 'rank'];

function timeLabel(iso) {
  const d = new Date(iso), now = new Date();
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return d.toDateString() === now.toDateString() ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export default function PetView({ currentMember, onClose }) {
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);      // 상점이 벽지·방 크기를 알아야 한다
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);

  // 서랍: null | bag | closet | more | family | attend | feed | rank
  const [panel, setPanel] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // 방에 시킬 동작 (간식을 먹였다 등). id 가 바뀌면 방이 한 번 재생한다
  const [guest, setGuest] = useState(null);
  const [flash, setFlash] = useState(null);

  // 딸린 자료
  const [slots, setSlots] = useState([]);
  const [foods, setFoods] = useState([]);
  const [fedToday, setFedToday] = useState([]);
  const [discovered, setDiscovered] = useState({});
  const [inventory, setInventory] = useState({});
  const [shopItems, setShopItems] = useState([]);
  const [feedRows, setFeedRows] = useState([]);
  const [rank, setRank] = useState([]);

  // 입양 폼
  const [pool, setPool] = useState(null);
  const [pickSpecies, setPickSpecies] = useState('cat');
  const [pickBreed, setPickBreed] = useState(null);
  const [pickName, setPickName] = useState('');
  const [saving, setSaving] = useState(false);

  const roomReload = useRef(null);   // RoomView 가 자기 새로고침 함수를 여기에 꽂는다

  // 서랍을 하단 바 위에 띄우려면 바가 실제로 몇 px 인지 알아야 한다.
  // 글꼴 크기·기기에 따라 달라지므로 상수로 박지 않고 잰다.
  const dockRef = useRef(null);
  const [dockH, setDockH] = useState(63);
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const measure = () => setDockH(Math.round(el.getBoundingClientRect().height) + 10);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editing, loading]);

  const refresh = useCallback(async () => {
    const today = todayKST();
    const [p, sl, fs, inv, rm] = await Promise.all([
      loadProfile(currentMember.id), todaySlots(currentMember.id),
      loadFeedState(currentMember.id, today), loadInventory(currentMember.id),
      supabase.from('pet_rooms').select('*').eq('member_id', currentMember.id).maybeSingle(),
    ]);
    setProfile(p); setSlots(sl);
    setFedToday(fs.todayIds); setDiscovered(fs.discovered);
    setInventory(inv);
    setRoom(rm?.data || null);
    setLoading(false);
  }, [currentMember.id]);

  useEffect(() => {
    refresh();
    loadFoods().then(setFoods);
    loadShopItems().then(setShopItems);
    loadManifest().then(setManifest).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (!profile || profile.species) return;
    grouped().then((g) => { setPool(g); setPickBreed(g.cat[0]?.breed || null); });
  }, [profile]);

  useEffect(() => {
    if (panel === 'feed') loadFeed().then(setFeedRows);
    if (panel === 'rank') loadRanking().then(setRank);
  }, [panel]);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 3600); return () => clearTimeout(t); }, [flash]);

  const catalog = useMemo(() => {
    if (!manifest) return null;
    const c = {}; manifest.assets.forEach((a) => { c[a.id] = a; }); return c;
  }, [manifest]);

  const affection = profile?.affection || 0;
  const prog = stageProgress(affection);
  const si = prog.stage;
  const adopted = !!profile?.species;
  const balance = profile?.balance || 0;

  async function doAdopt() {
    if (!pickName.trim() || !pickBreed) return;
    setSaving(true);
    const r = await adopt(currentMember.id, pickSpecies, pickBreed, pickName.trim());
    setSaving(false);
    if (!r?.ok) { setFlash({ bad: true, text: r?.reason || '실패했습니다' }); return; }
    setPickName('');
    refresh();
  }

  /** 가방에서 먹였다 — 방에 있는 친구가 실제로 먹는 모습을 보여준다 */
  function onFed(r) {
    setGuest({ id: Date.now(), action: 'eat', hold: 2800 });
    if (r?.grew) {
      setTimeout(() => setGuest({ id: Date.now() + 1, action: 'celebrate', hold: 3000 }), 2600);
      const label = STAGE_LABELS[r.stage];
      setFlash({ good: true, text: `${label}${josa(label, '이', '가')} 됐어요!` });
    } else {
      setTimeout(() => setGuest({ id: Date.now() + 1, action: 'play', hold: 2400 }), 2600);
    }
    refresh();
  }

  function onReleased(r) {
    setPanel(null);
    setFlash({ text: `${r.name}${josa(r.name, '은', '는')} 잘 지낼 거예요. 함께한 기록은 남아 있습니다.` });
    refresh();
  }

  async function doReport(row) {
    const reason = prompt(`"${row.member_name}" 의 이 기록을 신고합니다.\n사유 (선택)`);
    if (reason === null) return;
    const r = await report(row.id, currentMember.id, currentMember.name, reason);
    if (!r.ok) { setFlash({ bad: true, text: r.reason }); return; }
    setFlash({ text: '신고했습니다. 확인 후 처리됩니다.' });
    loadFeed().then(setFeedRows);
  }

  async function doVoid(row) {
    if (!confirm(`${row.member_name} 의 ${row.points}점을 무효 처리할까요?`)) return;
    const r = await voidEntry(row.id, currentMember.name);
    if (!r?.ok) { setFlash({ bad: true, text: r?.reason || '실패' }); return; }
    loadFeed().then(setFeedRows); refresh();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}
           style={{ maxHeight: '94vh', position: 'relative', overflow: 'hidden' }}>

        {/* ── 미니홈피 머리 ── */}
        <div style={s.head}>
          <h2 style={s.title}>
            {currentMember.name}의 미니룸
          </h2>
          <button onClick={onClose} style={s.close}>×</button>
        </div>

        {loading ? <div style={s.empty}>불러오는 중…</div>
         : !adopted ? (
          /* ───────── 입양 ───────── */
          <div style={s.scroll}>
            <p style={s.adoptLead}>함께 지낼 친구를 고르세요.<br />
              <span style={s.adoptSub}>한 번 고르면 종류와 품종은 바꿀 수 없습니다 (이름은 언제든지)</span></p>

            {flash && <div style={{ ...s.flash, ...(flash.bad ? s.flashBad : {}) }}>{flash.text}</div>}

            {pool && <>
              <div style={s.speciesRow}>
                {['cat', 'dog', 'special'].map((sp) => (
                  <button key={sp} onClick={() => { setPickSpecies(sp); setPickBreed(pool[sp][0]?.breed); }}
                    style={{ ...s.speciesBtn, ...(pickSpecies === sp ? s.speciesOn : {}) }}>
                    {SPECIES_LABEL[sp]}
                  </button>
                ))}
              </div>

              <div style={s.breedGrid}>
                {(pool[pickSpecies] || []).map((a) => (
                  <button key={a.id} onClick={() => setPickBreed(a.breed)}
                    style={{ ...s.breedCard, ...(pickBreed === a.breed ? s.breedOn : {}) }}>
                    <PetCanvas asset={a} stage={3} size={78} action="idle" />
                    <span style={s.breedName}>{a.name}</span>
                  </button>
                ))}
              </div>

              <input value={pickName} onChange={(e) => setPickName(e.target.value)}
                placeholder="이름을 지어주세요" maxLength={12} style={s.nameInput} />
              <button onClick={doAdopt} disabled={saving || !pickName.trim()} style={s.adoptBtn}>
                {saving ? '데려오는 중…' : '데려오기'}
              </button>
              <p style={s.hint}>
                새로 온 친구는 친밀도 0 에서 시작합니다. 먹이고 돌보면 아기 → 꼬마 → 청소년 → 어른 → 단짝 으로 자라요.
                점수로는 자라지 않습니다 — 점수는 간식과 가구를 사는 데 씁니다.
              </p>
            </>}
          </div>
        ) : (
          /* ───────── 방 ───────── */
          <>
            <div style={s.hud}>
              <div style={s.hudLeft}>
                <span style={s.petName}>{profile.pet_name}</span>
                <span style={s.badge}>{STAGE_LABELS[si]}</span>
                <span style={s.bondBadge}>{BOND_LABELS[si]}</span>
              </div>
              <div style={s.hudRight}>
                {/* 킷 manifest 는 ui/icon-coin.svg 를 적어 뒀지만 파일이 안 왔다 (404).
                    점수는 늘 떠 있어야 하는 것이라 아이콘을 여기서 직접 그린다 */}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={s.coin}>
                  <circle cx="8" cy="8" r="7" fill="none" stroke="var(--text-2)" strokeWidth="1.6" />
                  <circle cx="8" cy="8" r="3" fill="var(--text-2)" />
                </svg>
                <span style={s.points}>{balance.toLocaleString()}</span>
              </div>
            </div>

            <div style={s.roomBox}>
              <RoomView currentMember={currentMember} profile={profile}
                        editing={editing} setEditing={setEditing}
                        onRoomChange={roomReload} guest={guest} bond={si} />
            </div>

            {/* 친밀도 레벨 바 — 다음 성장까지 얼마 남았는지 */}
            <div style={s.levelWrap}>
              <div style={s.levelTop}>
                <span style={s.levelNow}>{STAGE_LABELS[si]}</span>
                <span style={s.levelNum}>
                  친밀도 {affection.toLocaleString()}
                  {!prog.max && ` / ${(affection + prog.left).toLocaleString()}`}
                </span>
                {!prog.max && <span style={s.levelNext}>다음 {STAGE_LABELS[si + 1]}</span>}
              </div>
              <div style={s.levelTrack}>
                <div style={{ ...s.levelFill, width: `${Math.round(prog.ratio * 100)}%` }} />
              </div>
              <div style={s.levelLeft}>
                {prog.max ? '다 자랐습니다. 오래오래 함께 지내요.'
                          : `${STAGE_LABELS[si + 1]}까지 친밀도 ${prog.left.toLocaleString()} 남았어요`}
              </div>
            </div>

            {flash && <div style={{ ...s.flash, ...(flash.bad ? s.flashBad : {}) }}>{flash.text}</div>}

            {/* 하단 바 — 편집 중에는 방이 자기 조작 막대를 쓴다 */}
            {!editing && (
              <div style={s.dock} ref={dockRef}>
                <Dock icon="🍚" label="가방"  on={panel === 'bag'}    onClick={() => setPanel(panel === 'bag' ? null : 'bag')} />
                <Dock icon="🧣" label="옷장"  on={panel === 'closet'} onClick={() => setPanel(panel === 'closet' ? null : 'closet')} />
                <Dock icon="🛒" label="상점"  onClick={() => { setPanel(null); setShopOpen(true); }} />
                <Dock icon="🪑" label="가구"  onClick={() => { setPanel(null); setEditing(true); }} />
                <Dock icon="☰"  label="더보기" on={MORE_PANELS.includes(panel)}
                      onClick={() => setPanel(MORE_PANELS.includes(panel) ? null : 'more')} />
              </div>
            )}

            {/* 서랍이 열려 있을 때 방을 누르면 닫힌다 */}
            {panel && <div style={s.scrim} onClick={() => setPanel(null)} />}

            {/* ── 서랍들 ── */}
            {panel === 'bag' && (
              <BagPanel currentMember={currentMember} inventory={inventory} foods={foods}
                fedToday={fedToday} discovered={discovered}
                onClose={() => setPanel(null)} onFed={onFed} bottom={dockH} />
            )}

            {panel === 'closet' && (
              <ClosetPanel currentMember={currentMember} inventory={inventory} catalog={catalog}
                shopItems={shopItems} equipped={profile.equipped || {}}
                wearables={manifest?.wearables || []} species={profile.species}
                onClose={() => setPanel(null)} bottom={dockH}
                onChanged={() => {
                  // 2차 킷의 'show' 는 갈아입은 걸 자랑하는 동작이다
                  setGuest({ id: Date.now(), action: 'show', hold: 4400 });
                  refresh();
                }} />
            )}

            {panel === 'family' && (
              <FamilyPanel currentMember={currentMember} profile={profile}
                onClose={() => setPanel(null)} onReleased={onReleased} bottom={dockH} />
            )}

            {panel === 'more' && (
              <Sheet title="더보기" onClose={() => setPanel(null)} bottom={dockH}>
                <MoreRow label="출석 달력" sub={`지금 ${profile.total_streak || 0}일 연속`} onClick={() => setPanel('attend')} />
                <MoreRow label="활동 기록" sub="누가 무엇으로 점수를 받았는지" onClick={() => setPanel('feed')} />
                <MoreRow label="랭킹" sub="누적 획득 점수" onClick={() => setPanel('rank')} />
                <MoreRow label="함께했던 친구들" sub="독립시키기도 여기에 있습니다" onClick={() => setPanel('family')} />
                <div style={s.miniStats}>
                  <Stat label="누적 획득" value={(profile.total_earned || 0).toLocaleString()} />
                  <Stat label="쓸 수 있는 점수" value={balance.toLocaleString()} />
                  <Stat label="친밀도" value={affection.toLocaleString()} />
                  <Stat label="최고 연속" value={`${profile.best_streak || 0}일`} />
                </div>
              </Sheet>
            )}

            {panel === 'attend' && (
              <Sheet title="출석" onClose={() => setPanel('more')} bottom={dockH}>
                <div style={s.slotRow}>
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} style={{ ...s.slot, ...(slots.includes(n) ? s.slotOn : {}) }}>
                      <span style={{ fontSize: 10 }}>{slots.includes(n) ? '●' : '○'}</span>
                      <span>{SLOT_LABELS[n]}</span>
                    </div>
                  ))}
                </div>
                <AttendCalendar memberId={currentMember.id} />
                <div style={s.streakBox}>
                  <div><div style={s.streakNum}>{profile.total_streak || 0}일</div><div style={s.streakLab}>지금 연속</div></div>
                  <div style={s.streakDiv} />
                  <div><div style={s.streakNum}>{profile.best_streak || 0}일</div><div style={s.streakLab}>최고 기록</div></div>
                  <div style={s.streakDiv} />
                  <div><div style={s.streakNum}>{profile.streak_weeks || 0}주</div><div style={s.streakLab}>연속 완주</div></div>
                </div>
                <p style={s.hint}>
                  하루에 한 번만 들러도 연속은 이어집니다. 2일차부터 보너스가 붙고,
                  7일을 채우면 사다리가 처음부터 다시 시작해요. 4주·8주·12주 연속에는 큰 보상이 있습니다.
                  16시 이후 접속은 출석으로 세지 않습니다.
                </p>
              </Sheet>
            )}

            {panel === 'feed' && (
              <Sheet title="활동 기록" onClose={() => setPanel('more')} bottom={dockH}>
                <p style={s.hint}>누가 무엇으로 점수를 받았는지 전부 남습니다. 이상하면 신고해주세요.</p>
                {feedRows.length === 0 && <div style={s.empty}>아직 기록이 없습니다</div>}
                {feedRows.map((row) => {
                  const reports = row.point_reports || [];
                  return (
                    <div key={row.id} style={{ ...s.feedRow, ...(row.voided ? s.feedVoid : {}) }}>
                      <span style={s.feedTime}>{timeLabel(row.created_at)}</span>
                      <span style={s.feedBody}>
                        <b>{row.member_name}</b> 이(가) {ACTION_VERB[row.action] || row.action}
                        {row.detail && <span style={s.feedDetail}> — {row.detail}</span>}
                      </span>
                      <span style={{ ...s.feedPts, ...(row.voided ? { textDecoration: 'line-through' } : {}) }}>+{row.points}</span>
                      {row.voided ? <span style={s.voidTag}>무효</span>
                        : reports.length > 0
                          ? <button onClick={() => doVoid(row)} style={s.flagged}
                              title={reports.map((r) => `${r.reporter}: ${r.reason || '사유 없음'}`).join('\n')}>⚠ {reports.length}</button>
                          : <button onClick={() => doReport(row)} style={s.reportBtn}>신고</button>}
                    </div>
                  );
                })}
              </Sheet>
            )}

            {panel === 'rank' && (
              <Sheet title="랭킹" onClose={() => setPanel('more')} bottom={dockH}>
                <p style={s.hint}>누적 획득 점수 기준입니다. 간식을 사도 줄어들지 않아요.</p>
                {rank.length === 0 && <div style={s.empty}>아직 아무도 시작하지 않았습니다</div>}
                {rank.map((r, i) => <RankRow key={r.member_id} row={r} no={i + 1} />)}
              </Sheet>
            )}
          </>
        )}

        {shopOpen && manifest && (
          <ShopView currentMember={currentMember} manifest={manifest}
            room={room} balance={balance}
            onDone={async () => { await refresh(); roomReload.current?.(); }}
            onClose={() => setShopOpen(false)} />
        )}
      </div>
    </div>
  );
}

function Dock({ icon, label, on, onClick }) {
  return (
    <button onClick={onClick} style={{ ...s.dockBtn, ...(on ? s.dockOn : {}) }}>
      <span style={s.dockIcon}>{icon}</span>
      <span style={s.dockLabel}>{label}</span>
    </button>
  );
}

function MoreRow({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={s.moreRow}>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={s.moreLabel}>{label}</div>
        <div style={s.moreSub}>{sub}</div>
      </div>
      <span style={s.moreArrow}>›</span>
    </button>
  );
}

function RankRow({ row, no }) {
  const [a, setA] = useState(null);
  useEffect(() => { if (row.breed) findAsset(row.species, row.breed).then(setA); }, [row.species, row.breed]);
  const m = row.members || {};
  const meta = YEAR_LEVELS[m.year_level];
  const si = stageOf(row.affection || 0);
  return (
    <div style={s.rankRow}>
      <span style={s.rankNo}>{no}</span>
      <div style={{ width: 42, flexShrink: 0 }}>
        {a && <PetCanvas asset={a} stage={si} action="idle" size={42} />}
      </div>
      <span style={s.rankName}>
        {m.name}{meta && <span style={{ fontSize: 11, color: meta.color }}> {meta.label}</span>}
      </span>
      <span style={s.rankPet}>{row.pet_name}</span>
      <span style={s.rankPts}>{(row.total_earned || 0).toLocaleString()}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
    </div>
  );
}

const s = {
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: 600 },
  close: { width: 38, height: 38, fontSize: 24, color: 'var(--text-2)', borderRadius: 8 },
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' },
  hint: { fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, margin: '10px 0' },
  scroll: { overflowY: 'auto', maxHeight: '78vh' },

  // HUD
  hud: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
         gap: 8, marginBottom: 8 },
  hudLeft: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  petName: { fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: { flexShrink: 0, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-2)' },
  bondBadge: { flexShrink: 0, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-3)', color: 'var(--text-2)' },
  hudRight: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  coin: { display: 'block', flexShrink: 0 },
  points: { fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },

  roomBox: { borderRadius: 12, overflow: 'hidden' },

  // 친밀도 레벨 바
  levelWrap: { marginTop: 10 },
  levelTop: { display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 },
  levelNow: { fontSize: 12, fontWeight: 700 },
  levelNum: { fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flex: 1 },
  levelNext: { fontSize: 11, color: 'var(--text-3)' },
  levelTrack: { height: 9, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' },
  levelFill: { height: '100%', background: 'linear-gradient(90deg, var(--text-3), var(--text))',
               borderRadius: 6, transition: 'width .5s ease' },
  levelLeft: { fontSize: 11, color: 'var(--text-3)', marginTop: 5, textAlign: 'center' },

  scrim: { position: 'absolute', inset: 0, zIndex: 15, background: 'transparent' },
  flash: { marginTop: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13 },
  flashBad: { background: 'var(--danger-bg)', color: 'var(--danger)' },

  // 하단 바
  // 서랍이 열려도 하단 바는 위에 남는다. 서랍끼리 바로 옮겨 다닐 수 있어야 한다
  dock: { display: 'flex', gap: 5, marginTop: 12, position: 'relative', zIndex: 30 },
  dockBtn: { flex: 1, padding: '8px 2px 7px', border: '1px solid var(--border)', borderRadius: 10,
             background: 'var(--surface)', display: 'flex', flexDirection: 'column',
             alignItems: 'center', gap: 2 },
  dockOn: { background: 'var(--surface-2)', borderColor: 'var(--text-3)' },
  dockIcon: { fontSize: 17, lineHeight: 1 },
  dockLabel: { fontSize: 10, color: 'var(--text-2)', fontWeight: 600 },

  moreRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%',
             padding: '12px 2px', borderBottom: '1px solid var(--border)', background: 'none' },
  moreLabel: { fontSize: 14, fontWeight: 600 },
  moreSub: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  moreArrow: { fontSize: 20, color: 'var(--text-3)', flexShrink: 0 },
  miniStats: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 14 },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 },
  statLabel: { fontSize: 11, color: 'var(--text-3)', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: 600 },

  // 입양
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

  // 출석
  slotRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 },
  slot: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12, color: 'var(--text-3)' },
  slotOn: { color: 'var(--text)', borderColor: 'var(--text-3)', background: 'var(--surface-2)' },
  streakBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8,
               padding: '14px 8px', background: 'var(--surface)', border: '1px solid var(--border)',
               borderRadius: 12, marginTop: 14, textAlign: 'center' },
  streakNum: { fontSize: 19, fontWeight: 700 },
  streakLab: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  streakDiv: { width: 1, alignSelf: 'stretch', background: 'var(--border)' },

  // 기록
  feedRow: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  feedVoid: { opacity: 0.45 },
  feedTime: { fontSize: 11, color: 'var(--text-3)', flexShrink: 0, width: 46, fontVariantNumeric: 'tabular-nums' },
  feedBody: { flex: 1, minWidth: 0, lineHeight: 1.5 },
  feedDetail: { color: 'var(--text-3)' },
  feedPts: { flexShrink: 0, fontWeight: 600, fontSize: 12, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' },
  reportBtn: { flexShrink: 0, fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer' },
  flagged: { flexShrink: 0, fontSize: 11, color: '#b4553f', background: 'none', border: 'none', padding: '0 0 0 4px', cursor: 'pointer' },
  voidTag: { flexShrink: 0, fontSize: 11, color: 'var(--text-3)' },

  // 랭킹
  rankRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  rankNo: { width: 20, textAlign: 'right', color: 'var(--text-3)', fontSize: 12, flexShrink: 0 },
  rankName: { fontWeight: 500, flexShrink: 0 },
  rankPet: { flex: 1, minWidth: 0, color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rankPts: { fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
};
