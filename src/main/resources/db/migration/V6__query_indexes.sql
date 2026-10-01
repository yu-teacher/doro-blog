-- 목록/조회 쿼리를 받쳐 주는 인덱스. 모두 IF NOT EXISTS 이며 데이터는 바꾸지 않는다.

-- 인기순 목록: WHERE status = 'PUBLISHED' ORDER BY like_count DESC
CREATE INDEX IF NOT EXISTS idx_posts_status_like_count ON posts (status, like_count DESC);

-- 사용자별 글 목록: WHERE user_id = ? AND status = ? ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_user_status_published ON posts (user_id, status, published_at DESC);

-- 태그 이름 조회: LOWER(tags.name) = LOWER(?) 가 기존 unique(name) 인덱스를 쓰지 못하던 문제
CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON tags (LOWER(name));
