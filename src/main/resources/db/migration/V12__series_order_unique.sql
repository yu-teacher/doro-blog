-- 한 시리즈 안에서 회차 번호(series_order)는 겹치지 않아야 한다. 지금까지는 시리즈 행 잠금 아래에서 코드가 지켰을 뿐
-- DB 가 막지 않아, 잠금을 거치지 않는 경로가 생기면 같은 회차가 둘이 될 수 있었다.
-- 정렬(reorder)은 한 트랜잭션 안에서 번호를 맞바꾸므로 검사를 커밋 시점으로 미룬다(DEFERRABLE INITIALLY DEFERRED).
-- series_order 가 NULL(시리즈에 속하지 않은 글)인 행은 서로 다른 값으로 취급되어 제약에 걸리지 않는다.
-- 적용 전 운영 데이터에 같은 (series_id, series_order) 쌍이 없음을 확인했다(2026-10-09, 시리즈 글 83건).
ALTER TABLE posts
    ADD CONSTRAINT uq_posts_series_order UNIQUE (series_id, series_order) DEFERRABLE INITIALLY DEFERRED;
