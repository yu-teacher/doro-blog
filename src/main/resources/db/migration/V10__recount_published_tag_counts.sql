-- 태그별 글 수는 공개된(PUBLISHED) 글만 센다. 이전에는 임시저장·비공개 글도 세어서
-- 공개 태그 목록으로 비공개 글의 태그와 개수가 드러났으므로, 기존 값을 한 번 다시 계산한다. (여러 번 실행해도 결과가 같다)
UPDATE tags t
SET post_count = COALESCE((
    SELECT COUNT(*)
    FROM post_tags pt
    JOIN posts p ON p.id = pt.post_id
    WHERE pt.tag_id = t.id AND p.status = 'PUBLISHED'
), 0);
