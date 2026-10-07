-- Doro 계정이 영구 탈퇴하면 이 블로그가 가진 프로필 개인정보를 익명화한다. 익명화한 시각을 남긴다.
ALTER TABLE blog_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Doro 의 탈퇴 목록을 어디까지 처리했는지 기록한다. (주기 조회의 증분 기준)
CREATE TABLE IF NOT EXISTS iam_sync_state (
    name VARCHAR(50) PRIMARY KEY,
    cursor_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
