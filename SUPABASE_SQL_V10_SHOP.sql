-- ============================================================
-- NS_To-Do  V10 — 가구 상점과 보관함
--   V7 · V8 · V9 를 먼저 실행한 뒤에 돌려주세요.
--
-- 왜 보관함이 필요한가
--   지금까지는 pet_rooms.items 에 '놓여 있는 가구'만 있었다.
--   산 가구를 잠시 치워두면 사라지는 셈이라, 소유와 배치를 분리한다.
--   그래야 '몇 개 샀는지'를 서버가 알고, 안 산 가구를 놓는 것도 막을 수 있다.
-- ============================================================

-- ---------- 1. 보관함 ----------
CREATE TABLE IF NOT EXISTS pet_inventory (
  member_id  BIGINT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  asset_id   TEXT    NOT NULL,
  qty        INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, asset_id)
);
ALTER TABLE pet_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read inventory" ON pet_inventory;
CREATE POLICY "everyone read inventory" ON pet_inventory FOR SELECT USING (true);
-- 쓰기 정책 없음. game_buy 만 늘린다

-- ---------- 2. 가구를 상점에 올린다 (가격은 manifest 값 그대로) ----------
INSERT INTO shop_items (item_id, kind, price, name, level) VALUES
  ('fn-sofa', 'furniture', 900, '민트 소파', NULL),
  ('fn-beanbag', 'furniture', 350, '피치 빈백', NULL),
  ('fn-chair', 'furniture', 350, '작업 의자', NULL),
  ('fn-cushion', 'furniture', 350, '라일락 방석', NULL),
  ('fn-desk', 'furniture', 900, '오크 책상', NULL),
  ('fn-table', 'furniture', 350, '작은 테이블', NULL),
  ('fn-shelf', 'furniture', 1800, '색색 책장', NULL),
  ('fn-nightstand', 'furniture', 350, '침대 옆 협탁', NULL),
  ('fn-cat-tree', 'furniture', 1800, '구름 캣타워', NULL),
  ('fn-pet-bed', 'furniture', 900, '포근한 펫 침대', NULL),
  ('fn-bowl', 'furniture', 350, '두 그릇 세트', NULL),
  ('fn-scratcher', 'furniture', 350, '오크 스크래처', NULL),
  ('fn-dog-house', 'furniture', 1800, '작은 강아지집', NULL),
  ('fn-plant-large', 'furniture', 900, '큰 몬스테라', NULL),
  ('fn-plant-small', 'furniture', 350, '작은 새싹', NULL),
  ('fn-plant-hanging', 'furniture', 900, '행잉 플랜트', NULL),
  ('fn-floor-lamp', 'furniture', 900, '머시룸 플로어램프', NULL),
  ('fn-table-lamp', 'furniture', 350, '작은 테이블램프', NULL),
  ('fn-mood-lamp', 'furniture', 2600, '뇌 무드등', NULL),
  ('fn-frame', 'furniture', 900, '뇌 그림 액자 스탠드', NULL),
  ('fn-clock', 'furniture', 350, '데이지 시계 스탠드', NULL),
  ('fn-board', 'furniture', 900, '작은 할일 보드 스탠드', NULL),
  ('fn-rug', 'furniture', 350, '선셋 러그', NULL),
  ('fn-cushion-pile', 'furniture', 900, '쿠션 더미', NULL)
ON CONFLICT (item_id) DO UPDATE
  SET kind=EXCLUDED.kind, price=EXCLUDED.price, name=EXCLUDED.name;

-- ---------- 3. game_buy 확장 — 가구를 사면 보관함에 쌓인다 ----------
CREATE OR REPLACE FUNCTION game_buy(p_member BIGINT, p_item TEXT, p_request TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item shop_items%ROWTYPE; v_prof game_profiles%ROWTYPE; v_room pet_rooms%ROWTYPE;
  v_qty INTEGER;
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
  -- 같은 가구를 무한정 쌓지는 못하게 한다 (방보다 많아질 이유가 없다)
  IF v_item.kind = 'furniture' THEN
    SELECT COALESCE(qty,0) INTO v_qty FROM pet_inventory
     WHERE member_id = p_member AND asset_id = p_item;
    IF COALESCE(v_qty,0) >= 4 THEN
      RETURN jsonb_build_object('ok', false, 'reason', '같은 가구는 4개까지예요');
    END IF;
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
  ELSIF v_item.kind = 'room' THEN
    UPDATE pet_rooms SET level = v_item.level, revision = revision + 1, updated_at = NOW()
     WHERE member_id = p_member;
  ELSE
    INSERT INTO pet_inventory (member_id, asset_id, qty) VALUES (p_member, p_item, 1)
    ON CONFLICT (member_id, asset_id) DO UPDATE
      SET qty = pet_inventory.qty + 1, updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', v_item.name, 'kind', v_item.kind,
                            'balance', v_prof.balance);
END $$;

-- ---------- 4. 저장할 때 '가진 만큼만' 놓을 수 있게 ----------
CREATE OR REPLACE FUNCTION game_save_room(
  p_member BIGINT, p_items JSONB, p_revision INTEGER,
  p_wallpaper TEXT DEFAULT NULL, p_floor TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_room pet_rooms%ROWTYPE; v_bad TEXT;
BEGIN
  INSERT INTO pet_rooms (member_id) VALUES (p_member) ON CONFLICT DO NOTHING;
  SELECT * INTO v_room FROM pet_rooms WHERE member_id = p_member FOR UPDATE;

  IF p_revision IS NOT NULL AND p_revision <> v_room.revision THEN
    RETURN jsonb_build_object('ok', false, 'reason', '다른 곳에서 먼저 저장했어요',
      'server_revision', v_room.revision, 'room', to_jsonb(v_room));
  END IF;

  IF p_wallpaper IS NOT NULL AND NOT (p_wallpaper = ANY (v_room.owned_wallpapers)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', '아직 소장하지 않은 벽지예요');
  END IF;

  -- 보관함에 있는 수량보다 많이 놓을 수 없다.
  -- 클라이언트가 아무 assetId 나 끼워 넣어도 여기서 걸린다.
  IF p_items IS NOT NULL THEN
    SELECT string_agg(DISTINCT t.asset_id, ', ') INTO v_bad
      FROM (SELECT elem->>'assetId' AS asset_id, COUNT(*) AS n
              FROM jsonb_array_elements(p_items) elem
             GROUP BY 1) t
      LEFT JOIN pet_inventory inv
        ON inv.member_id = p_member AND inv.asset_id = t.asset_id
     WHERE COALESCE(inv.qty, 0) < t.n;
    IF v_bad IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', '가지고 있지 않은 가구예요: ' || v_bad);
    END IF;
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

GRANT EXECUTE ON FUNCTION game_buy(BIGINT, TEXT, TEXT)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_save_room(BIGINT, JSONB, INTEGER, TEXT, TEXT) TO anon, authenticated;

-- ---------- 5. 기본 가구를 한 세트 지급 ----------
-- 처음 방에 들어갔을 때 텅 비어 있으면 허전하므로, 모두에게 기본 가구를 준다.
-- 이미 가진 사람에게는 더 주지 않는다.
INSERT INTO pet_inventory (member_id, asset_id, qty)
SELECT m.id, s.asset_id, 1
  FROM members m
  CROSS JOIN (VALUES ('fn-rug'), ('fn-pet-bed'), ('fn-bowl'), ('fn-cushion')) AS s(asset_id)
ON CONFLICT (member_id, asset_id) DO NOTHING;

-- ============================================================
-- 6. 테스트용 포인트 지급 (선택)
--
-- ⚠ 이건 스키마가 아니라 운영 작업입니다. 필요할 때만 돌리세요.
--
-- 앱에서는 점수를 만들어낼 수 없게 막아뒀습니다 (그게 이 시스템의 핵심입니다).
-- 익명 키로는 game_profiles 를 못 고치고, 점수를 꽂는 내부 함수도 잠겨 있습니다.
-- 그래서 테스트 포인트는 여기 SQL 에디터에서만 넣을 수 있습니다.
--
-- 조용히 잔액만 올리지 않고 원장에도 한 줄 남깁니다.
-- 활동 피드가 거짓말을 하면 신고 기능이 의미가 없어지기 때문입니다.
-- ============================================================
INSERT INTO point_rules (action, points, daily_cap, capped, label)
VALUES ('admin_grant', 0, NULL, FALSE, '운영 지급')
ON CONFLICT (action) DO UPDATE SET label = EXCLUDED.label, capped = FALSE;

DO $$
DECLARE
  TARGET  CONSTANT TEXT    := '김우슬';   -- 받을 사람
  AMOUNT  CONSTANT INTEGER := 20000;      -- 줄 점수
  v_id BIGINT; v_name TEXT;
BEGIN
  SELECT id, name INTO v_id, v_name FROM members WHERE name = TARGET;
  IF v_id IS NULL THEN RAISE NOTICE '그런 멤버가 없습니다: %', TARGET; RETURN; END IF;

  PERFORM game_ensure(v_id);
  INSERT INTO point_ledger (member_id, member_name, action, points, ref_key, detail)
  VALUES (v_id, v_name, 'admin_grant', AMOUNT,
          'admin:' || to_char(NOW(), 'YYYYMMDDHH24MISS'), '테스트용 지급');
  UPDATE game_profiles
     SET total_earned = total_earned + AMOUNT,
         balance      = balance + AMOUNT,
         updated_at   = NOW()
   WHERE member_id = v_id;

  RAISE NOTICE '% 에게 %점 지급했습니다', v_name, AMOUNT;
END $$;

SELECT m.name AS 이름, g.total_earned AS 누적, g.balance AS 잔액,
       game_stage(g.total_earned, g.affection) AS 성장단계
  FROM game_profiles g JOIN members m ON m.id = g.member_id
 ORDER BY g.total_earned DESC;
