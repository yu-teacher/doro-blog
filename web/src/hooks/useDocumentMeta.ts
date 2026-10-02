import { useEffect } from 'react';
import { toAbsoluteUrl } from '../utils/publicOrigin';

/** meta description 의 권장 길이(검색 결과 스니펫에서 잘리지 않는 정도). */
export const META_DESCRIPTION_MAX_LENGTH = 160;

interface DocumentMeta {
  /** 문서 제목. 비어 있으면 제목은 건드리지 않는다. */
  title?: string | null;
  /** 요약문. 비어 있으면 description 은 건드리지 않는다. */
  description?: string | null;
  /** canonical 로 알릴 경로(예: location.pathname). 공개 origin 이 설정된 경우에만 적용된다. */
  canonicalPath?: string | null;
}

/** 공백을 정리하고 meta description 길이에 맞게 줄인다. */
export function toMetaDescription(text: string | null | undefined, max = META_DESCRIPTION_MAX_LENGTH): string {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

type MetaKey = { attr: 'name' | 'property'; key: string };

const DESCRIPTION_TAGS: MetaKey[] = [
  { attr: 'name', key: 'description' },
  { attr: 'property', key: 'og:description' },
  { attr: 'name', key: 'twitter:description' },
];
const TITLE_TAGS: MetaKey[] = [
  { attr: 'property', key: 'og:title' },
  { attr: 'name', key: 'twitter:title' },
];

/** 태그가 있을 때만 content 를 바꾸고, 되돌릴 함수를 돌려준다 (없는 태그를 새로 만들지 않는다). */
function setMetaContent({ attr, key }: MetaKey, value: string): (() => void) | null {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) return null;
  const previous = el.content;
  el.content = value;
  return () => {
    el.content = previous;
  };
}

/** 페이지 진입 시 문서 제목과 meta 설명을 갱신하고, 떠날 때 이전 값으로 되돌린다. */
function setCanonical(href: string): () => void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (existing) {
    const previous = existing.href;
    existing.href = href;
    return () => {
      existing.href = previous;
    };
  }
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = href;
  document.head.appendChild(link);
  return () => link.remove();
}

export function useDocumentMeta({ title, description, canonicalPath }: DocumentMeta): void {
  useEffect(() => {
    const restores: Array<() => void> = [];
    if (title) {
      const previousTitle = document.title;
      document.title = title;
      restores.push(() => {
        document.title = previousTitle;
      });
      for (const tag of TITLE_TAGS) {
        const restore = setMetaContent(tag, title);
        if (restore) restores.push(restore);
      }
    }
    const desc = toMetaDescription(description);
    if (desc) {
      for (const tag of DESCRIPTION_TAGS) {
        const restore = setMetaContent(tag, desc);
        if (restore) restores.push(restore);
      }
    }
    const canonical = canonicalPath ? toAbsoluteUrl(canonicalPath) : null;
    if (canonical) restores.push(setCanonical(canonical));
    return () => restores.forEach((restore) => restore());
  }, [title, description, canonicalPath]);
}
