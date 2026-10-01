/** 태그 검색 화면의 주소 규칙: /tags?tag=A&tag=B 또는 /tags?tags=A,B[&sort=popular]. */

const DEFAULT_SORT = 'latest';

/** 주소에서 선택된 태그를 읽는다 (소문자, 중복 제거, 이름순). tag 와 tags 파라미터를 모두 받는다. */
export function parseSelectedTags(params: URLSearchParams): string[] {
  const raw = [...params.getAll('tag'), ...(params.get('tags')?.split(',') ?? [])];
  return Array.from(new Set(raw.map((t) => t.trim().toLowerCase()).filter(Boolean))).sort();
}

/** 선택된 태그와 정렬로 주소 파라미터를 만든다. 기본 정렬(latest)과 빈 태그 목록은 생략한다. */
export function buildTagSearchParams(tags: readonly string[], sort: string): URLSearchParams {
  const params = new URLSearchParams();
  if (tags.length > 0) params.set('tags', tags.join(','));
  if (sort !== DEFAULT_SORT) params.set('sort', sort);
  return params;
}

/** 태그를 추가한다. 이미 있으면(대소문자 무시) 그대로. */
export function addSelectedTag(tags: readonly string[], tag: string): string[] {
  const clean = tag.trim().toLowerCase();
  if (!clean || tags.includes(clean)) return [...tags];
  return [...tags, clean];
}

export function removeSelectedTag(tags: readonly string[], tag: string): string[] {
  const clean = tag.trim().toLowerCase();
  return tags.filter((t) => t !== clean);
}
