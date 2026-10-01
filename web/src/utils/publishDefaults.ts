import { extractFirstImage, stripMarkdown } from './markdown';
import { generateSlug } from './slug';

const FALLBACK_SLUG = 'post';
export const SUMMARY_PREVIEW_LENGTH = 120;

export interface PublishFields {
  slug: string;
  summary: string;
  thumbnailUrl: string;
}

export interface PublishDefaults extends PublishFields {
  /** 썸네일을 본문 첫 이미지에서 자동으로 골랐는지 (직접 입력/업로드했거나 이미지가 없으면 false). */
  thumbnailAutoDetected: boolean;
}

/**
 * 출간 설정창을 열 때 비어 있는 항목을 채운다: 슬러그는 제목에서, 요약은 본문 앞부분(마크다운 제거)에서,
 * 썸네일은 본문의 첫 이미지에서. 사용자가 이미 채운 값은 그대로 둔다.
 */
export function suggestPublishDefaults(title: string, content: string, current: PublishFields): PublishDefaults {
  const slug = current.slug || generateSlug(title) || FALLBACK_SLUG;
  const summary = current.summary || stripMarkdown(content).slice(0, SUMMARY_PREVIEW_LENGTH);

  if (current.thumbnailUrl) {
    return { slug, summary, thumbnailUrl: current.thumbnailUrl, thumbnailAutoDetected: false };
  }
  const firstImage = extractFirstImage(content);
  return { slug, summary, thumbnailUrl: firstImage ?? '', thumbnailAutoDetected: firstImage !== null };
}
