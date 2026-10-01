import type { TagItem } from '../api/types';

export interface TagCount {
  name: string;
  count: number;
}

interface CountOptions {
  /** 대소문자를 구분하지 않고 센다 (이름은 소문자로 돌려준다). */
  lowercase?: boolean;
  /** 결과에서 뺄 태그 이름. */
  exclude?: readonly string[];
  limit?: number;
}

/** 글 목록에서 태그가 쓰인 횟수를 세어 많은 순(같으면 이름 순)으로 돌려준다. */
export function countTags(posts: ReadonlyArray<{ tags?: string[] | null }>, { lowercase = false, exclude = [], limit }: CountOptions = {}): TagCount[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const raw of post.tags ?? []) {
      const trimmed = raw?.trim();
      if (!trimmed) continue;
      const name = lowercase ? trimmed.toLowerCase() : trimmed;
      if (exclude.includes(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export interface FeedTag {
  id: string;
  name: string;
  postCount: number;
}

/**
 * 피드 화면의 태그 줄. 현재 보이는 글에 쓰인 태그를 많은 순으로 보여주고,
 * 글이 없을 때는 전체 인기 태그로 대신한다. 구독/좋아요 탭은 개인 목록이므로 글이 없으면 비운다.
 */
export function deriveFeedTags(posts: ReadonlyArray<{ tags?: string[] | null }>, globalTags: readonly TagItem[], tab: string): FeedTag[] {
  const personalTab = tab === 'feed' || tab === 'likes';
  const fallback = personalTab ? [] : globalTags.map((t) => ({ id: t.id, name: t.name, postCount: t.postCount }));
  if (posts.length === 0) return fallback;

  const counted = countTags(posts);
  if (counted.length === 0) return fallback;
  return counted.map(({ name, count }) => ({ id: name, name, postCount: count }));
}
