-- ============================================================
-- NS_To-Do  V8 — 먹이 · 친밀도 · 미니룸 저장
--   V7 을 먼저 실행한 뒤에 이 파일을 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 설계 원칙 (V7 과 동일)
--   1) 가격·친밀도·상한은 전부 서버 테이블에 있다. 클라이언트가 못 정한다.
--   2) 잔액 차감과 지급은 한 함수 안에서 끝낸다 (중간에 끊겨도 반쪽이 안 남는다).
--   3) 펫은 배고파지지 않는다. 허기도, 감소도 없다. 친밀도는 절대 안 내려간다.
--   4) 시각은 전부 KST.
-- ============================================================

-- ---------- 1. 먹이 규칙 ----------
CREATE TABLE IF NOT EXISTS food_items (
  food_id    TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  kind       TEXT    NOT NULL,          -- 'kibble' | 'snack' | 'special'
  price      INTEGER NOT NULL,
  affection  INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO food_items (food_id, name, kind, price, affection, sort_order) VALUES
  ('kibble',         '사료',        'kibble',   50, 10, 0),
  ('churu',          '츄르',        'snack',   150, 25, 1),
  ('milk',           '우유',        'snack',   150, 25, 2),
  ('cookie',         '쿠키',        'snack',   200, 25, 3),
  ('jerky',          '육포',        'snack',   250, 25, 4),
  ('sausage',        '소세지',      'snack',   250, 25, 5),
  ('cup-ramen',      '컵라면',      'snack',   300, 25, 6),
  ('protein-drink',  '단백질 음료',  'snack',   350, 25, 7),
  ('cup-rice',       '컵밥',        'snack',   400, 25, 8),
  ('special-cake',   '특별식',      'special',   0, 150, 9)   -- 뽑기로만 나온다
ON CONFLICT (food_id) DO UPDATE
  SET name=EXCLUDED.name, kind=EXCLUDED.kind, price=EXCLUDED.price,
      affection=EXCLUDED.affection, sort_order=EXCLUDED.sort_order;

ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read food" ON food_items;
CREATE POLICY "everyone read food" ON food_items FOR SELECT USING (true);

-- ---------- 2. 프로필 확장 ----------
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS affection   BIGINT  DEFAULT 0;
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS taste_a     TEXT;    -- 좋아하는 간식 2종
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS taste_b     TEXT;
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS breed       TEXT;    -- 품종 (korean-shorthair 등)
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS coat        TEXT;
ALTER TABLE game_profiles ADD COLUMN IF NOT EXISTS boost_date  DATE;    -- 간식 먹인 날 = 그날 상한 280

-- ---------- 3. 급식 기록 = 도감 ----------
CREATE TABLE IF NOT EXISTS feed_log (
  id         BIGSERIAL PRIMARY KEY,
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  food_id    TEXT   NOT NULL REFERENCES food_items(food_id),
  affection  INTEGER NOT NULL,
  liked      BOOLEAN DEFAULT FALSE,     -- 취향 적중
  fed_on     DATE   NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_member ON feed_log(member_id, fed_on);

ALTER TABLE feed_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read feed" ON feed_log;
CREATE POLICY "everyone read feed" ON feed_log FOR SELECT USING (true);
-- 쓰기 정책 없음. game_feed 만 쓴다

-- ---------- 4. 미니룸 저장 ----------
CREATE TABLE IF NOT EXISTS pet_rooms (
  member_id        BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  level            INTEGER DEFAULT 0,          -- 0=8x8, 1=10x10, 2=12x12
  wallpaper        TEXT    DEFAULT 'plain',
  floor            TEXT    DEFAULT 'wood',
  owned_wallpapers TEXT[]  DEFAULT ARRAY['plain'],
  items            JSONB   DEFAULT '[]'::JSONB,
  revision         INTEGER DEFAULT 0,          -- 동시 저장 충돌 감지
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pet_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read rooms" ON pet_rooms;
CREATE POLICY "everyone read rooms" ON pet_rooms FOR SELECT USING (true);
-- 쓰기 정책 없음. 함수로만 바뀐다

-- 상점 가격 (벽지·방 확장). 서버에만 둔다
CREATE TABLE IF NOT EXISTS shop_items (
  item_id TEXT PRIMARY KEY,
  kind    TEXT NOT NULL,        -- 'wallpaper' | 'room'
  price   INTEGER NOT NULL,
  name    TEXT,
  level   INTEGER               -- kind='room' 일 때 도달 레벨
);
INSERT INTO shop_items (item_id, kind, price, name, level) VALUES
  ('mori',  'wallpaper',  800, 'MORI 모리',   NULL),
  ('nuit',  'wallpaper', 1100, 'NUIT 뉘',     NULL),
  ('route', 'wallpaper', 1400, 'ROUTE 루트',  NULL),
  ('sola',  'wallpaper', 1700, 'SOLA 솔라',   NULL),
  ('room-1','room',      1600, '넓은 방',       1),
  ('room-2','room',      2800, '스튜디오',      2)
ON CONFLICT (item_id) DO UPDATE
  SET kind=EXCLUDED.kind, price=EXCLUDED.price, name=EXCLUDED.name, level=EXCLUDED.level;

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read shop" ON shop_items;
CREATE POLICY "everyone read shop" ON shop_items FOR SELECT USING (true);

-- ============================================================
-- 5. 성장 단계 — 한 곳에서만 계산한다
--    0~3 은 누적 획득 점수, 4(단짝)는 친밀도로 연다.
--    단짝은 나이가 아니라 관계다 (에셋 킷의 정의를 그대로 따른다).
-- ============================================================
CREATE OR REPLACE FUNCTION game_stage(p_total BIGINT, p_affection BIGINT)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(p_total,0) >= 20000 AND COALESCE(p_affection,0) >= 2500 THEN 4  -- 단짝
    WHEN COALESCE(p_total,0) >= 20000 THEN 3   -- 어른
    WHEN COALESCE(p_total,0) >=  8000 THEN 2   -- 청소년
    WHEN COALESCE(p_total,0) >=  2000 THEN 1   -- 꼬마
    ELSE 0                                     -- 아기
  END
$$;

CREATE OR REPLACE FUNCTION game_bond(p_affection BIGINT)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(p_affection,0) >= 2500 THEN 4   -- 가족
    WHEN COALESCE(p_affection,0) >= 1000 THEN 3   -- 단짝
    WHEN COALESCE(p_affection,0) >=  400 THEN 2   -- 친함
    WHEN COALESCE(p_affection,0) >=  100 THEN 1   -- 익숙
    ELSE 0                                        -- 서먹
  END
$$;

-- ============================================================
-- 6. 먹이 주기
--    잔액 확인 → 차감 → 친밀도 가산 → 도감 기록 을 한 번에 한다.
-- ============================================================
CREATE OR REPLACE FUNCTION game_feed(p_member BIGINT, p_food TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_food  food_items%ROWTYPE;
  v_prof  game_profiles%ROWTYPE;
  v_today DATE := kst_today();
  v_count INTEGER;
  v_cap   INTEGER;
  v_gain  INTEGER;
  v_liked BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_food FROM food_items WHERE food_id = p_food;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', '없는 먹이');
  END IF;
  IF v_food.kind = 'special' THEN
    RETURN jsonb_build_object('ok', false, 'reason', '특별식은 뽑기로만 얻습니다');
  END IF;

  PERFORM game_ensure(p_member);
  SELECT * INTO v_prof FROM game_profiles WHERE member_id = p_member FOR UPDATE;

  IF v_prof.species IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', '먼저 펫을 데려오세요');
  END IF;

  -- 종류별 하루 횟수: 사료 1회, 간식 2회
  v_cap := CASE v_food.kind WHEN 'kibble' THEN 1 ELSE 2 END;
  SELECT COUNT(*) INTO v_count FROM feed_log f
    JOIN food_items fi ON fi.food_id = f.food_id
   WHERE f.member_id = p_member AND f.fed_on = v_today AND fi.kind = v_food.kind;
  IF v_count >= v_cap THEN
    -- 조사가 이름에 따라 달라지므로 아예 붙이지 않는다 ('사료 은(는)' 같은 표기 방지)
    RETURN jsonb_build_object('ok', false,
      'reason', '하루 ' || v_cap || '번까지예요 — ' || v_food.name);
  END IF;

  IF v_prof.balance < v_food.price THEN
    RETURN jsonb_build_object('ok', false, 'reason', '점수가 모자라요',
      'need', v_food.price, 'have', v_prof.balance);
  END IF;

  -- 취향 적중이면 친밀도가 크게 오른다
  v_liked := (p_food = v_prof.taste_a OR p_food = v_prof.taste_b);
  v_gain  := CASE WHEN v_liked THEN v_food.affection * 24 / 10 ELSE v_food.affection END;

  INSERT INTO feed_log (member_id, food_id, affection, liked, fed_on)
  VALUES (p_member, p_food, v_gain, v_liked, v_today);

  UPDATE game_profiles
     SET balance    = balance - v_food.price,
         affection  = affection + v_gain,
         -- 간식을 준 날은 그날 획득 상한이 250 → 280 으로 오른다
         boost_date = CASE WHEN v_food.kind = 'snack' THEN v_today ELSE boost_date END,
         updated_at = NOW()
   WHERE member_id = p_member
  RETURNING * INTO v_prof;

  RETURN jsonb_build_object(
    'ok', true, 'food', v_food.name, 'liked', v_liked, 'gained', v_gain,
    'affection', v_prof.affection, 'bond', game_bond(v_prof.affection),
    'balance', v_prof.balance,
    'boosted', (v_food.kind = 'snack'));
END $$;

-- ============================================================
-- 7. 펫 입양 — 품종·코트·취향까지 한 번에
--    취향 2종은 입양할 때 무작위로 정해지고 다시는 안 바뀐다.
-- ============================================================
CREATE OR REPLACE FUNCTION game_adopt(
  p_member BIGINT, p_species TEXT, p_breed TEXT, p_name TEXT, p_coat TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prof game_profiles%ROWTYPE; v_t TEXT[];
BEGIN
  -- 에셋 manifest 의 species 값을 그대로 쓴다: cat / dog / special
  -- 뇌·척추는 species='special' 이고 breed 로 구분된다 (breed='brain'|'spine')
  IF p_species NOT IN ('cat','dog','special') THEN
    RETURN jsonb_build_object('ok', false, 'reason', '알 수 없는 종류');
  END IF;
  IF COALESCE(TRIM(p_breed), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', '품종을 골라주세요');
  END IF;
  IF COALESCE(TRIM(p_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이름을 지어주세요');
  END IF;

  PERFORM game_ensure(p_member);
  SELECT * INTO v_prof FROM game_profiles WHERE member_id = p_member FOR UPDATE;

  -- 이미 키우는 중이면 이름만 바꾼다. 종·품종은 못 바꾼다
  IF v_prof.species IS NOT NULL THEN
    UPDATE game_profiles SET pet_name = TRIM(p_name), updated_at = NOW()
     WHERE member_id = p_member;
    RETURN jsonb_build_object('ok', true, 'renamed_only', true,
      'reason', '이미 함께 지내는 친구가 있어 이름만 바꿨어요');
  END IF;

  -- 좋아하는 간식 2종을 무작위로 뽑는다. 먹여보기 전엔 아무도 모른다
  SELECT array_agg(food_id) INTO v_t FROM (
    SELECT food_id FROM food_items WHERE kind='snack' ORDER BY random() LIMIT 2) s;

  UPDATE game_profiles
     SET species=p_species, breed=p_breed, coat=p_coat, pet_name=TRIM(p_name),
         taste_a=v_t[1], taste_b=v_t[2],
         adopted_at=COALESCE(adopted_at, NOW()), updated_at=NOW()
   WHERE member_id = p_member;

  RETURN jsonb_build_object('ok', true);
END $$;

-- ============================================================
-- 8. 미니룸 저장 — 낙관적 동시성
--    두 기기에서 동시에 고치면 나중 것이 거절된다 (조용히 덮어쓰지 않는다).
-- ============================================================
CREATE OR REPLACE FUNCTION game_save_room(
  p_member BIGINT, p_items JSONB, p_revision INTEGER,
  p_wallpaper TEXT DEFAULT NULL, p_floor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_room pet_rooms%ROWTYPE;
BEGIN
  INSERT INTO pet_rooms (member_id) VALUES (p_member) ON CONFLICT DO NOTHING;
  SELECT * INTO v_room FROM pet_rooms WHERE member_id = p_member FOR UPDATE;

  IF p_revision IS NOT NULL AND p_revision <> v_room.revision THEN
    RETURN jsonb_build_object('ok', false, 'reason', '다른 곳에서 먼저 저장했어요',
      'server_revision', v_room.revision, 'room', to_jsonb(v_room));
  END IF;

  -- 소장하지 않은 벽지는 적용 거부
  IF p_wallpaper IS NOT NULL AND NOT (p_wallpaper = ANY (v_room.owned_wallpapers)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', '아직 소장하지 않은 벽지예요');
  END IF;

  UPDATE pet_rooms
     SET items      = COALESCE(p_items, items),
         wallpaper  = COALESCE(p_wallpaper, wallpaper),
         floor      = COALESCE(p_floor, floor),
         revision   = revision + 1,
         updated_at = NOW()
   WHERE member_id = p_member
  RETURNING * INTO v_room;

  RETURN jsonb_build_object('ok', true, 'revision', v_room.revision);
END $$;

-- ============================================================
-- 9. 상점 — 벽지 구매 / 방 확장
--    p_request 로 같은 요청이 두 번 와도 한 번만 결제된다.
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_receipts (
  request_id TEXT PRIMARY KEY,
  member_id  BIGINT NOT NULL,
  item_id    TEXT   NOT NULL,
  price      INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE shop_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read receipts" ON shop_receipts;
CREATE POLICY "everyone read receipts" ON shop_receipts FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION game_buy(p_member BIGINT, p_item TEXT, p_request TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item shop_items%ROWTYPE; v_prof game_profiles%ROWTYPE; v_room pet_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM shop_items WHERE item_id = p_item;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', '없는 상품'); END IF;

  IF EXISTS (SELECT 1 FROM shop_receipts WHERE request_id = p_request) THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이미 처리된 요청입니다', 'duplicate', true);
  END IF;

  PERFORM game_ensure(p_member);
  INSERT INTO pet_rooms (member_id) VALUES (p_member) ON CONFLICT DO NOTHING;
  SELECT * INTO v_prof FROM game_profiles WHERE member_id = p_member FOR UPDATE;
  SELECT * INTO v_room FROM pet_rooms      WHERE member_id = p_member FOR UPDATE;

  IF v_item.kind = 'wallpaper' AND p_item = ANY (v_room.owned_wallpapers) THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이미 소장한 벽지예요');
  END IF;
  IF v_item.kind = 'room' AND v_room.level >= v_item.level THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이미 넓힌 방이에요');
  END IF;
  IF v_item.kind = 'room' AND v_item.level <> v_room.level + 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', '순서대로만 넓힐 수 있어요');
  END IF;
  IF v_prof.balance < v_item.price THEN
    RETURN jsonb_build_object('ok', false, 'reason', '점수가 모자라요',
      'need', v_item.price, 'have', v_prof.balance);
  END IF;

  INSERT INTO shop_receipts (request_id, member_id, item_id, price)
  VALUES (p_request, p_member, p_item, v_item.price);

  UPDATE game_profiles SET balance = balance - v_item.price, updated_at = NOW()
   WHERE member_id = p_member RETURNING * INTO v_prof;

  IF v_item.kind = 'wallpaper' THEN
    UPDATE pet_rooms SET owned_wallpapers = owned_wallpapers || p_item,
                         wallpaper = p_item, revision = revision + 1, updated_at = NOW()
     WHERE member_id = p_member;
  ELSE
    UPDATE pet_rooms SET level = v_item.level, revision = revision + 1, updated_at = NOW()
     WHERE member_id = p_member;
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', v_item.name, 'balance', v_prof.balance);
END $$;

-- ---------- 10. 실행 권한 ----------
GRANT EXECUTE ON FUNCTION game_feed(BIGINT, TEXT)                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_adopt(BIGINT, TEXT, TEXT, TEXT, TEXT)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_save_room(BIGINT, JSONB, INTEGER, TEXT, TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_buy(BIGINT, TEXT, TEXT)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_stage(BIGINT, BIGINT)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_bond(BIGINT)                                    TO anon, authenticated;

-- ============================================================
-- 11. game_award 갱신 — 간식 먹인 날은 하루 상한이 250 → 280
--     V7 의 함수를 이 정의로 덮어씁니다. V7 을 고칠 필요는 없습니다.
--     (덤으로 조사 오류와 '자동등록' 거절 사유 문구를 바로잡았습니다)
-- ============================================================
CREATE OR REPLACE FUNCTION game_award(
  p_member BIGINT, p_action TEXT, p_ref TEXT, p_detail TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule    point_rules%ROWTYPE;
  v_name    TEXT;
  v_today   DATE := kst_today();
  v_count   INTEGER;
  v_daysum  INTEGER;
  v_id      BIGINT;
  v_cap     INTEGER;
  v_boost   DATE;
  v_todo    BIGINT;
  BASE_CAP  CONSTANT INTEGER := 250;
  SNACK_CAP CONSTANT INTEGER := 280;
BEGIN
  SELECT * INTO v_rule FROM point_rules WHERE action = p_action;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '알 수 없는 행동');
  END IF;

  SELECT name INTO v_name FROM members WHERE id = p_member;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '없는 멤버');
  END IF;

  PERFORM game_ensure(p_member);

  IF p_action IN ('todo_done','todo_done_own','todo_create','comment')
     AND p_ref !~ '^[a-z_]+:[0-9]+$' THEN
    RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '참조 키 형식 오류');
  END IF;

  -- ---- 행동별 사전 검증 ----
  IF p_action IN ('todo_done', 'todo_done_own') THEN
    IF NOT EXISTS (SELECT 1 FROM todos
       WHERE id = split_part(p_ref, ':', 2)::BIGINT AND done AND completed_by = v_name) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '완료 기록이 확인되지 않음');
    END IF;

  ELSIF p_action = 'todo_create' THEN
    v_todo := split_part(p_ref, ':', 2)::BIGINT;
    -- 자동등록은 사람이 한 일이 아니다. 사유를 구분해서 돌려준다
    IF EXISTS (SELECT 1 FROM todos WHERE id = v_todo
                AND '자동등록' = ANY (COALESCE(tags, ARRAY[]::TEXT[]))) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0,
        'reason', '자동등록 할일은 점수 대상이 아닙니다');
    END IF;
    -- 등록 점수는 '완료됐을 때' 소급 지급한다. 올렸다 지우는 farming 방지
    IF NOT EXISTS (SELECT 1 FROM todos
       WHERE id = v_todo AND created_by = v_name AND done) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0,
        'reason', '등록 점수는 완료 후 지급됩니다');
    END IF;

  ELSIF p_action = 'comment' THEN
    IF NOT EXISTS (SELECT 1 FROM comments
       WHERE id = split_part(p_ref, ':', 2)::BIGINT AND created_by = v_name) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '댓글이 확인되지 않음');
    END IF;
  END IF;

  -- ---- 행동별 하루 건수 상한 ----
  IF v_rule.daily_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM point_ledger
     WHERE member_id = p_member AND action = p_action AND voided = FALSE
       AND (created_at AT TIME ZONE 'Asia/Seoul')::DATE = v_today;
    IF v_count >= v_rule.daily_cap THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0,
        'reason', v_rule.label || ' — 하루 ' || v_rule.daily_cap || '건까지입니다');
    END IF;
  END IF;

  -- ---- 하루 총량 상한. 간식을 준 날은 280 ----
  IF v_rule.capped THEN
    SELECT boost_date INTO v_boost FROM game_profiles WHERE member_id = p_member;
    v_cap := CASE WHEN v_boost = v_today THEN SNACK_CAP ELSE BASE_CAP END;

    SELECT COALESCE(SUM(l.points), 0) INTO v_daysum
      FROM point_ledger l JOIN point_rules r ON r.action = l.action
     WHERE l.member_id = p_member AND l.voided = FALSE AND r.capped
       AND (l.created_at AT TIME ZONE 'Asia/Seoul')::DATE = v_today;

    IF v_daysum + v_rule.points > v_cap THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0, 'cap', v_cap,
        'reason', '오늘 획득 상한(' || v_cap || '점)에 도달했습니다');
    END IF;
  END IF;

  INSERT INTO point_ledger (member_id, member_name, action, points, ref_key, detail)
  VALUES (p_member, v_name, p_action, v_rule.points, p_ref, p_detail)
  ON CONFLICT (member_id, ref_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '이미 받은 점수입니다');
  END IF;

  UPDATE game_profiles
     SET total_earned = total_earned + v_rule.points,
         balance      = balance + v_rule.points,
         updated_at   = NOW()
   WHERE member_id = p_member;

  RETURN jsonb_build_object('awarded', true, 'points', v_rule.points,
                            'label', v_rule.label, 'reason', NULL);
END $$;

GRANT EXECUTE ON FUNCTION game_award(BIGINT, TEXT, TEXT, TEXT) TO anon, authenticated;
