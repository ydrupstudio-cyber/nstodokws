-- ============================================================
-- NS_To-Do  V7 — 펫 키우기 / 점수 시스템
--   Supabase SQL Editor 에 통째로 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.
--
-- 설계 원칙
--   1) 점수는 클라이언트가 직접 못 쓴다. RLS 로 INSERT/UPDATE 를 막고
--      SECURITY DEFINER 함수(game_award, game_attend)로만 들어온다.
--   2) 중복 수령은 (member_id, ref_key) UNIQUE 로 막는다. 재시도해도 두 번 안 준다.
--   3) 모든 지급은 point_ledger 에 한 줄씩 남는다 = 활동 피드 = 신고 대상.
--   4) 시각은 전부 KST 로 계산한다. Supabase 는 UTC 로 도니까 반드시 변환해야 한다.
-- ============================================================

-- ---------- 1. 점수 규칙 (서버에만 있다. 클라이언트는 값을 못 정한다) ----------
CREATE TABLE IF NOT EXISTS point_rules (
  action      TEXT PRIMARY KEY,
  points      INTEGER NOT NULL,
  daily_cap   INTEGER,          -- 하루 몇 건까지 인정하나. NULL = 무제한
  capped      BOOLEAN DEFAULT TRUE,  -- 하루 총량(250) 상한에 포함되나
  label       TEXT NOT NULL
);

INSERT INTO point_rules (action, points, daily_cap, capped, label) VALUES
  ('attend',        10, 4,    TRUE,  '출석'),
  ('attend_full',   10, 1,    TRUE,  '하루 4구간 완주'),
  ('streak',         0, NULL, FALSE, '연속 출석'),      -- 점수는 함수가 사다리에서 계산
  ('milestone',      0, NULL, FALSE, '장기 연속 보상'),
  ('todo_done',     12, 5,    TRUE,  '액팅 완료'),
  ('todo_done_own',  4, 5,    TRUE,  '내가 올린 액팅 완료'),
  ('todo_create',   12, 5,    TRUE,  '액팅 등록'),
  ('comment',        8, 4,    TRUE,  '댓글'),
  ('memo_fill',     12, 2,    TRUE,  '메모 채우기'),
  ('photo',         10, 2,    TRUE,  '사진 첨부'),
  ('wiki_new',     150, 1,    TRUE,  '의국 노트 작성'),
  ('wiki_edit',     40, 2,    TRUE,  '의국 노트 보강'),
  ('template',      40, 2,    TRUE,  '템플릿 등록'),
  ('board',         40, 1,    TRUE,  '근무표·일정 갱신'),
  ('praise_send',    5, 1,    TRUE,  '칭찬 보내기'),
  ('praise_recv',   15, NULL, FALSE, '칭찬 받기'),
  ('visit',          3, 3,    TRUE,  '친구 방 구경'),
  ('team_goal',     50, 1,    FALSE, '의국 전체 목표 달성')
ON CONFLICT (action) DO UPDATE
  SET points = EXCLUDED.points, daily_cap = EXCLUDED.daily_cap,
      capped = EXCLUDED.capped, label = EXCLUDED.label;

ALTER TABLE point_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read rules" ON point_rules;
CREATE POLICY "everyone read rules" ON point_rules FOR SELECT USING (true);
-- 쓰기 정책 없음 = 아무도 못 고친다 (대시보드에서만)

-- ---------- 2. 계정별 지갑 · 펫 · 연속출석 ----------
CREATE TABLE IF NOT EXISTS game_profiles (
  member_id         BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  species           TEXT,            -- 'cat' | 'dog'  (NULL = 아직 입양 전)
  pet_name          TEXT,
  adopted_at        TIMESTAMPTZ,
  total_earned      BIGINT  DEFAULT 0,   -- 누적 획득. 성장 기준. 절대 안 줄어든다
  balance           BIGINT  DEFAULT 0,   -- 쓸 수 있는 잔액
  streak_days       INTEGER DEFAULT 0,   -- 주간 사다리 위치 1~7
  streak_weeks      INTEGER DEFAULT 0,   -- 연속 완주 주 수
  total_streak      INTEGER DEFAULT 0,   -- 전체 연속 일수 (표시용)
  best_streak       INTEGER DEFAULT 0,
  last_attend_date  DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE game_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read profiles" ON game_profiles;
CREATE POLICY "everyone read profiles" ON game_profiles FOR SELECT USING (true);
-- INSERT/UPDATE 정책 없음 = 함수로만 바뀐다

-- ---------- 3. 점수 원장 = 활동 피드 ----------
CREATE TABLE IF NOT EXISTS point_ledger (
  id          BIGSERIAL PRIMARY KEY,
  member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name TEXT,                  -- 피드에 바로 뿌리려고 박아둔다
  action      TEXT NOT NULL,
  points      INTEGER NOT NULL,
  ref_key     TEXT NOT NULL,         -- 중복 수령 차단 키. 예: 'done:1745'
  detail      TEXT,                  -- "박종길 CSF lab 시행"
  voided      BOOLEAN DEFAULT FALSE, -- 신고 확인 후 무효 처리
  voided_by   TEXT,
  voided_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, ref_key)
);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON point_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_member  ON point_ledger(member_id, created_at DESC);

ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read ledger" ON point_ledger;
CREATE POLICY "everyone read ledger" ON point_ledger FOR SELECT USING (true);
-- 쓰기 정책 없음. game_award 만 쓴다

-- ---------- 4. 신고 ----------
CREATE TABLE IF NOT EXISTS point_reports (
  id          BIGSERIAL PRIMARY KEY,
  ledger_id   BIGINT NOT NULL REFERENCES point_ledger(id) ON DELETE CASCADE,
  reporter_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  reporter    TEXT,
  reason      TEXT,
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ledger_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_ledger ON point_reports(ledger_id);

ALTER TABLE point_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read reports"   ON point_reports;
DROP POLICY IF EXISTS "everyone insert reports" ON point_reports;
DROP POLICY IF EXISTS "everyone update reports" ON point_reports;
CREATE POLICY "everyone read reports"   ON point_reports FOR SELECT USING (true);
CREATE POLICY "everyone insert reports" ON point_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone update reports" ON point_reports FOR UPDATE USING (true);

-- ---------- 5. 공통 헬퍼 ----------
CREATE OR REPLACE FUNCTION kst_now() RETURNS TIMESTAMP
  LANGUAGE SQL STABLE AS $$ SELECT (NOW() AT TIME ZONE 'Asia/Seoul') $$;

CREATE OR REPLACE FUNCTION kst_today() RETURNS DATE
  LANGUAGE SQL STABLE AS $$ SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE $$;

-- 프로필이 없으면 만들어준다
CREATE OR REPLACE FUNCTION game_ensure(p_member BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO game_profiles (member_id) VALUES (p_member)
  ON CONFLICT (member_id) DO NOTHING;
END $$;

-- ============================================================
-- 6. 핵심 — 점수 지급
--    반환: {awarded: bool, points: int, reason: text}
-- ============================================================
CREATE OR REPLACE FUNCTION game_award(
  p_member BIGINT,
  p_action TEXT,
  p_ref    TEXT,
  p_detail TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule    point_rules%ROWTYPE;
  v_name    TEXT;
  v_today   DATE := kst_today();
  v_count   INTEGER;
  v_daysum  INTEGER;
  v_id      BIGINT;
  DAILY_TOTAL_CAP CONSTANT INTEGER := 250;
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

  -- ---- 행동별 사전 검증. 위조하기 쉬운 것들만 서버가 실제 데이터를 확인한다 ----
  IF p_action IN ('todo_done', 'todo_done_own', 'todo_create', 'comment')
     AND p_ref !~ '^[a-z_]+:[0-9]+$' THEN
    RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '참조 키 형식 오류');
  END IF;

  IF p_action IN ('todo_done', 'todo_done_own') THEN
    IF NOT EXISTS (
      SELECT 1 FROM todos
       WHERE id = split_part(p_ref, ':', 2)::BIGINT
         AND done = TRUE AND completed_by = v_name
    ) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '완료 기록이 확인되지 않음');
    END IF;

  ELSIF p_action = 'todo_create' THEN
    -- 등록 점수는 '그 할일이 실제로 완료됐을 때' 소급 지급한다.
    -- 올렸다 지우는 farming 을 막는 유일한 방법이다.
    -- 자동등록(파이프라인이 올린 것)은 사람이 한 일이 아니므로 제외한다.
    IF NOT EXISTS (
      SELECT 1 FROM todos
       WHERE id = split_part(p_ref, ':', 2)::BIGINT
         AND created_by = v_name
         AND done = TRUE
         AND NOT ('자동등록' = ANY (COALESCE(tags, ARRAY[]::TEXT[])))
    ) THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0, 'reason', '등록 점수는 완료 후 지급됩니다');
    END IF;

  ELSIF p_action = 'comment' THEN
    IF NOT EXISTS (
      SELECT 1 FROM comments
       WHERE id = split_part(p_ref, ':', 2)::BIGINT AND created_by = v_name
    ) THEN
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
        'reason', v_rule.label || ' 은 하루 ' || v_rule.daily_cap || '건까지입니다');
    END IF;
  END IF;

  -- ---- 하루 총량 상한 (연속출석·마일스톤·칭찬받기는 제외) ----
  IF v_rule.capped THEN
    SELECT COALESCE(SUM(l.points), 0) INTO v_daysum
      FROM point_ledger l JOIN point_rules r ON r.action = l.action
     WHERE l.member_id = p_member AND l.voided = FALSE AND r.capped
       AND (l.created_at AT TIME ZONE 'Asia/Seoul')::DATE = v_today;
    IF v_daysum + v_rule.points > DAILY_TOTAL_CAP THEN
      RETURN jsonb_build_object('awarded', false, 'points', 0,
        'reason', '오늘 획득 상한(' || DAILY_TOTAL_CAP || '점)에 도달했습니다');
    END IF;
  END IF;

  -- ---- 지급 ----
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

-- 규칙표에 없는 점수를 직접 꽂는 내부용 (연속출석 사다리 · 마일스톤 전용)
CREATE OR REPLACE FUNCTION game_grant(
  p_member BIGINT, p_action TEXT, p_points INTEGER, p_ref TEXT, p_detail TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id BIGINT; v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM members WHERE id = p_member;
  INSERT INTO point_ledger (member_id, member_name, action, points, ref_key, detail)
  VALUES (p_member, v_name, p_action, p_points, p_ref, p_detail)
  ON CONFLICT (member_id, ref_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE game_profiles
     SET total_earned = total_earned + p_points, balance = balance + p_points, updated_at = NOW()
   WHERE member_id = p_member;
  RETURN TRUE;
END $$;

-- ============================================================
-- 7. 출석 — 하루 4구간 + 연속 사다리 + 장기 마일스톤
-- ============================================================
CREATE OR REPLACE FUNCTION game_attend(p_member BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now    TIMESTAMP := kst_now();
  v_today  DATE      := v_now::DATE;
  v_hour   INTEGER   := EXTRACT(HOUR FROM v_now);
  v_slot   INTEGER;
  v_label  TEXT;
  v_prof   game_profiles%ROWTYPE;
  v_got    JSONB;
  v_gained INTEGER := 0;
  v_events TEXT[] := ARRAY[]::TEXT[];
  v_slots  INTEGER;
  v_ladder INTEGER;
  v_ms     INTEGER;
BEGIN
  PERFORM game_ensure(p_member);

  -- 구간 판정 (KST)
  IF    v_hour >=  6 AND v_hour <  9 THEN v_slot := 1; v_label := '아침';
  ELSIF v_hour >=  9 AND v_hour < 12 THEN v_slot := 2; v_label := '오전';
  ELSIF v_hour >= 12 AND v_hour < 14 THEN v_slot := 3; v_label := '점심';
  ELSIF v_hour >= 14 AND v_hour < 16 THEN v_slot := 4; v_label := '오후';
  ELSE  v_slot := 0;
  END IF;

  IF v_slot = 0 THEN
    RETURN jsonb_build_object('gained', 0, 'events', ARRAY[]::TEXT[], 'slot', 0);
  END IF;

  -- 구간 출석
  v_got := game_award(p_member, 'attend',
                      'attend:' || v_today || ':' || v_slot, v_label || ' 출석');
  IF (v_got->>'awarded')::BOOLEAN THEN
    v_gained := v_gained + (v_got->>'points')::INTEGER;
    v_events := v_events || (v_label || ' 출석 +' || (v_got->>'points'));
  END IF;

  -- 연속 사다리는 그날 첫 출석에서만 굴린다
  SELECT * INTO v_prof FROM game_profiles WHERE member_id = p_member;

  IF v_prof.last_attend_date IS DISTINCT FROM v_today THEN
    IF v_prof.last_attend_date = v_today - 1 THEN
      v_prof.streak_days  := v_prof.streak_days + 1;
      v_prof.total_streak := v_prof.total_streak + 1;
    ELSE
      v_prof.streak_days  := 1;
      v_prof.total_streak := 1;
      v_prof.streak_weeks := 0;
    END IF;

    IF v_prof.streak_days > 7 THEN v_prof.streak_days := 1; END IF;

    -- 사다리: 2일 +10 / 3일 +15 / 4일 +20 / 5일 +25 / 6일 +30 / 7일 +50
    v_ladder := CASE v_prof.streak_days
                  WHEN 2 THEN 10 WHEN 3 THEN 15 WHEN 4 THEN 20
                  WHEN 5 THEN 25 WHEN 6 THEN 30 WHEN 7 THEN 50 ELSE 0 END;

    IF v_ladder > 0 AND game_grant(p_member, 'streak', v_ladder,
         'streak:' || v_today, '연속 출석 ' || v_prof.total_streak || '일') THEN
      v_gained := v_gained + v_ladder;
      v_events := v_events || ('연속 ' || v_prof.total_streak || '일 +' || v_ladder);
    END IF;

    -- 한 주 완주
    IF v_prof.streak_days = 7 THEN
      v_prof.streak_weeks := v_prof.streak_weeks + 1;
      -- 4주(1달) 400 / 8주(2달) 900 / 12주(3달) 2000, 그 뒤로는 4주마다 2000
      v_ms := CASE
                WHEN v_prof.streak_weeks = 4 THEN 400
                WHEN v_prof.streak_weeks = 8 THEN 900
                WHEN v_prof.streak_weeks % 4 = 0 THEN 2000
                ELSE 0 END;
      IF v_ms > 0 AND game_grant(p_member, 'milestone', v_ms,
           'milestone:' || v_prof.streak_weeks,
           v_prof.streak_weeks || '주 연속 달성') THEN
        v_gained := v_gained + v_ms;
        v_events := v_events || (v_prof.streak_weeks || '주 연속! +' || v_ms);
      END IF;
    END IF;

    UPDATE game_profiles
       SET streak_days = v_prof.streak_days, streak_weeks = v_prof.streak_weeks,
           total_streak = v_prof.total_streak,
           best_streak = GREATEST(best_streak, v_prof.total_streak),
           last_attend_date = v_today, updated_at = NOW()
     WHERE member_id = p_member;
  END IF;

  -- 4구간 완주 보너스
  SELECT COUNT(*) INTO v_slots FROM point_ledger
   WHERE member_id = p_member AND action = 'attend' AND voided = FALSE
     AND (created_at AT TIME ZONE 'Asia/Seoul')::DATE = v_today;

  IF v_slots >= 4 THEN
    v_got := game_award(p_member, 'attend_full', 'attendfull:' || v_today, '하루 4구간 완주');
    IF (v_got->>'awarded')::BOOLEAN THEN
      v_gained := v_gained + (v_got->>'points')::INTEGER;
      v_events := v_events || ('4구간 완주 +' || (v_got->>'points'));
    END IF;
  END IF;

  RETURN jsonb_build_object('gained', v_gained, 'events', v_events,
                            'slot', v_slot, 'slots_today', v_slots);
END $$;

-- ============================================================
-- 8. 펫 입양 / 이름 변경
-- ============================================================
CREATE OR REPLACE FUNCTION game_set_pet(p_member BIGINT, p_species TEXT, p_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_prof game_profiles%ROWTYPE;
BEGIN
  IF p_species NOT IN ('cat', 'dog') THEN
    RETURN jsonb_build_object('ok', false, 'reason', '고양이 또는 강아지만 됩니다');
  END IF;
  IF COALESCE(TRIM(p_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이름을 지어주세요');
  END IF;

  PERFORM game_ensure(p_member);
  SELECT * INTO v_prof FROM game_profiles WHERE member_id = p_member;

  -- 종은 한 번 정하면 못 바꾼다 (이름은 언제든 바꿀 수 있다)
  IF v_prof.species IS NOT NULL AND v_prof.species <> p_species THEN
    UPDATE game_profiles SET pet_name = TRIM(p_name), updated_at = NOW() WHERE member_id = p_member;
    RETURN jsonb_build_object('ok', true, 'species_changed', false,
                              'reason', '종은 바꿀 수 없어 이름만 바꿨습니다');
  END IF;

  UPDATE game_profiles
     SET species = p_species, pet_name = TRIM(p_name),
         adopted_at = COALESCE(adopted_at, NOW()), updated_at = NOW()
   WHERE member_id = p_member;

  RETURN jsonb_build_object('ok', true);
END $$;

-- ============================================================
-- 9. 신고 접수 / 무효 처리
-- ============================================================
CREATE OR REPLACE FUNCTION game_void(p_ledger BIGINT, p_by TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row point_ledger%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM point_ledger WHERE id = p_ledger;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', '없는 기록'); END IF;
  IF v_row.voided     THEN RETURN jsonb_build_object('ok', false, 'reason', '이미 무효'); END IF;

  UPDATE point_ledger SET voided = TRUE, voided_by = p_by, voided_at = NOW() WHERE id = p_ledger;
  UPDATE game_profiles
     SET total_earned = GREATEST(0, total_earned - v_row.points),
         balance      = GREATEST(0, balance - v_row.points),
         updated_at   = NOW()
   WHERE member_id = v_row.member_id;
  UPDATE point_reports SET resolved = TRUE WHERE ledger_id = p_ledger;

  RETURN jsonb_build_object('ok', true, 'points', v_row.points);
END $$;

-- ---------- 10. 실행 권한 ----------
GRANT EXECUTE ON FUNCTION game_award(BIGINT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_attend(BIGINT)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_set_pet(BIGINT, TEXT, TEXT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_void(BIGINT, TEXT)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION game_ensure(BIGINT)                  TO anon, authenticated;
-- game_grant 는 일부러 안 준다. 내부 전용이다.
REVOKE EXECUTE ON FUNCTION game_grant(BIGINT, TEXT, INTEGER, TEXT, TEXT) FROM anon, authenticated;

-- ---------- 11. 실시간 구독용 ----------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE point_ledger;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
