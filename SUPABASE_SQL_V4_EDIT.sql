-- ============================================
-- todos 수정 기능 추가 (2026-05-22)
-- ============================================

-- 수정 시간 기록 컬럼
ALTER TABLE todos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS updated_by TEXT;
