-- ============================================
-- NS_To-Do v4 스키마 업데이트
-- ============================================
-- 이전 백업이 완료된 상태에서 실행하세요.
-- ============================================

-- 1) todos 테이블에 새 컬럼 추가
ALTER TABLE todos ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS professor TEXT;

-- 2) 댓글 테이블
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  todo_id BIGINT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_todo_id ON comments(todo_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone can read comments" ON comments;
DROP POLICY IF EXISTS "everyone can insert comments" ON comments;
DROP POLICY IF EXISTS "everyone can update comments" ON comments;
DROP POLICY IF EXISTS "everyone can delete comments" ON comments;
CREATE POLICY "everyone can read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "everyone can insert comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone can update comments" ON comments FOR UPDATE USING (true);
CREATE POLICY "everyone can delete comments" ON comments FOR DELETE USING (true);

-- 3) 교수님 명단
CREATE TABLE IF NOT EXISTS professors (
  id BIGSERIAL PRIMARY KEY,
  initial TEXT NOT NULL UNIQUE,
  name TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE professors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone can read profs" ON professors;
DROP POLICY IF EXISTS "everyone can insert profs" ON professors;
DROP POLICY IF EXISTS "everyone can update profs" ON professors;
DROP POLICY IF EXISTS "everyone can delete profs" ON professors;
CREATE POLICY "everyone can read profs" ON professors FOR SELECT USING (true);
CREATE POLICY "everyone can insert profs" ON professors FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone can update profs" ON professors FOR UPDATE USING (true);
CREATE POLICY "everyone can delete profs" ON professors FOR DELETE USING (true);

-- 초기 교수님 데이터 (D T S O Y R M)
INSERT INTO professors (initial, display_order) VALUES
  ('D', 1), ('T', 2), ('S', 3), ('O', 4), ('Y', 5), ('R', 6), ('M', 7)
ON CONFLICT (initial) DO NOTHING;

-- 4) 빠른 추가 템플릿 (자주 쓰는 할일)
CREATE TABLE IF NOT EXISTS task_templates (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone can read templates" ON task_templates;
DROP POLICY IF EXISTS "everyone can insert templates" ON task_templates;
DROP POLICY IF EXISTS "everyone can update templates" ON task_templates;
DROP POLICY IF EXISTS "everyone can delete templates" ON task_templates;
CREATE POLICY "everyone can read templates" ON task_templates FOR SELECT USING (true);
CREATE POLICY "everyone can insert templates" ON task_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone can update templates" ON task_templates FOR UPDATE USING (true);
CREATE POLICY "everyone can delete templates" ON task_templates FOR DELETE USING (true);

-- 5) 푸시 알림 구독
-- 의국원이 어떤 기기에서 알림을 받을지 저장
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_member_id ON push_subscriptions(member_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone can read push" ON push_subscriptions;
DROP POLICY IF EXISTS "everyone can insert push" ON push_subscriptions;
DROP POLICY IF EXISTS "everyone can update push" ON push_subscriptions;
DROP POLICY IF EXISTS "everyone can delete push" ON push_subscriptions;
CREATE POLICY "everyone can read push" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "everyone can insert push" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone can update push" ON push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "everyone can delete push" ON push_subscriptions FOR DELETE USING (true);

-- 6) 의국원 프로필별 알림 설정
ALTER TABLE members ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE;

-- 7) 시간 임박 알림 보낸 기록 (중복 방지)
CREATE TABLE IF NOT EXISTS time_notification_sent (
  todo_id BIGINT PRIMARY KEY REFERENCES todos(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_notification_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "everyone can read tns" ON time_notification_sent;
DROP POLICY IF EXISTS "everyone can insert tns" ON time_notification_sent;
DROP POLICY IF EXISTS "everyone can delete tns" ON time_notification_sent;
CREATE POLICY "everyone can read tns" ON time_notification_sent FOR SELECT USING (true);
CREATE POLICY "everyone can insert tns" ON time_notification_sent FOR INSERT WITH CHECK (true);
CREATE POLICY "everyone can delete tns" ON time_notification_sent FOR DELETE USING (true);

-- 8) 실시간 동기화
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE professors;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE task_templates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
