-- ============================================
-- NS_To-Do v6: 근무표 게시판 + 미완료 이월
-- ============================================

-- 1) 근무표·일정 게시판
CREATE TABLE IF NOT EXISTS schedule_boards (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

ALTER TABLE schedule_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone read boards" ON schedule_boards;
DROP POLICY IF EXISTS "everyone insert boards" ON schedule_boards;
DROP POLICY IF EXISTS "everyone update boards" ON schedule_boards;
DROP POLICY IF EXISTS "everyone delete boards" ON schedule_boards;
CREATE POLICY "everyone read boards" ON schedule_boards FOR SELECT USING (true);
CREATE POLICY "everyone insert boards" ON schedule_boards FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone update boards" ON schedule_boards FOR UPDATE USING (true);
CREATE POLICY "everyone delete boards" ON schedule_boards FOR DELETE USING (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE schedule_boards;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 기존 당직표 사진을 그대로 이관 (교수님 / 전공의)
INSERT INTO schedule_boards (title, photo_urls, display_order, updated_by, updated_at)
SELECT '교수님 당직표',
       COALESCE((SELECT CASE WHEN photo_url IS NULL THEN '{}'::TEXT[] ELSE ARRAY[photo_url] END
                 FROM duty_schedules WHERE key = 'attending'), '{}'::TEXT[]),
       1,
       (SELECT updated_by FROM duty_schedules WHERE key = 'attending'),
       (SELECT updated_at FROM duty_schedules WHERE key = 'attending')
WHERE NOT EXISTS (SELECT 1 FROM schedule_boards WHERE title = '교수님 당직표');

INSERT INTO schedule_boards (title, photo_urls, display_order, updated_by, updated_at)
SELECT '전공의 당직표',
       COALESCE((SELECT CASE WHEN photo_url IS NULL THEN '{}'::TEXT[] ELSE ARRAY[photo_url] END
                 FROM duty_schedules WHERE key = 'resident'), '{}'::TEXT[]),
       2,
       (SELECT updated_by FROM duty_schedules WHERE key = 'resident'),
       (SELECT updated_at FROM duty_schedules WHERE key = 'resident')
WHERE NOT EXISTS (SELECT 1 FROM schedule_boards WHERE title = '전공의 당직표');

-- 2) 미완료 할일 이월
ALTER TABLE todos ADD COLUMN IF NOT EXISTS carried_from DATE;

-- 이월 함수: 오늘 이전의 미완료 할일을 오늘로 이동 (원래 날짜는 carried_from에 보존)
CREATE OR REPLACE FUNCTION carry_over_todos(p_today DATE)
RETURNS integer AS $$
DECLARE moved integer;
BEGIN
  UPDATE todos
  SET carried_from = COALESCE(carried_from, date),
      date = p_today
  WHERE date < p_today AND done = false;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
