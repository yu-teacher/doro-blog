-- 검색(LOWER(col) LIKE '%키워드%')을 전체 테이블 스캔 대신 trigram GIN 인덱스로 처리한다.
-- pg_trgm 은 PostgreSQL contrib 확장이며, 마이그레이션을 실행하는 계정이 확장을 만들 수 있어야 한다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING gin (LOWER(title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_summary_trgm ON posts USING gin (LOWER(summary) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (LOWER(content) gin_trgm_ops);
