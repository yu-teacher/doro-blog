import type { TagItem } from '../api/types';

export type SearchTarget = { kind: 'tag'; tag: string } | { kind: 'text'; query: string };

/** 검색창 입력을 해석한다: "#태그" 는 태그 검색, 그 밖에는 본문 검색. 빈 입력은 null. */
export function parseSearchInput(input: string): SearchTarget | null {
  const q = input.trim();
  if (!q) return null;
  if (q.startsWith('#') && q.length > 1) return { kind: 'tag', tag: q.substring(1) };
  return { kind: 'text', query: q };
}

/** 검색창 입력 경로(주소). */
export function searchPath(target: SearchTarget): string {
  return target.kind === 'tag' ? `/tags?tag=${encodeURIComponent(target.tag)}` : `/search?q=${encodeURIComponent(target.query)}`;
}

const MAX_SUGGESTIONS = 6;

/** 입력한 글자가 이름에 들어 있는 태그를 추천한다 (앞의 # 는 무시). */
export function suggestTags(tags: readonly TagItem[], input: string, limit: number = MAX_SUGGESTIONS): TagItem[] {
  const clean = input.trim().replace(/^#/, '').toLowerCase();
  if (!clean) return [];
  return tags.filter((t) => t.name.toLowerCase().includes(clean)).slice(0, limit);
}
