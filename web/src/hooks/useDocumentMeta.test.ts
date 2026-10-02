import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toMetaDescription, useDocumentMeta, META_DESCRIPTION_MAX_LENGTH } from './useDocumentMeta';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const metaContent = (selector: string) => document.head.querySelector<HTMLMetaElement>(selector)?.content;

describe('toMetaDescription', () => {
  it('공백을 정리한다', () => {
    expect(toMetaDescription('  a \n\n b\t c  ')).toBe('a b c');
  });

  it('최대 길이를 넘으면 말줄임표로 끝나며 길이를 지킨다', () => {
    const out = toMetaDescription('가'.repeat(500));
    expect(out.length).toBe(META_DESCRIPTION_MAX_LENGTH);
    expect(out.endsWith('…')).toBe(true);
  });

  it('비어 있으면 빈 문자열', () => {
    expect(toMetaDescription(undefined)).toBe('');
  });
});

describe('useDocumentMeta', () => {
  let root: Root;

  const mount = (props: { title?: string | null; description?: string | null; canonicalPath?: string | null }) => {
    root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(function Probe() {
      useDocumentMeta(props);
      return null;
    })));
  };

  beforeEach(() => {
    document.head.innerHTML = `
      <title>기본 제목</title>
      <meta name="description" content="기본 설명" />
      <meta property="og:title" content="기본 OG 제목" />
      <meta property="og:description" content="기본 OG 설명" />`;
  });

  afterEach(() => {
    act(() => root?.unmount());
    vi.unstubAllEnvs();
  });

  it('제목과 description/og 태그를 갱신하고 언마운트하면 되돌린다', () => {
    mount({ title: '글 제목 - DORO.log', description: '글 요약입니다' });
    expect(document.title).toBe('글 제목 - DORO.log');
    expect(metaContent('meta[name="description"]')).toBe('글 요약입니다');
    expect(metaContent('meta[property="og:title"]')).toBe('글 제목 - DORO.log');
    expect(metaContent('meta[property="og:description"]')).toBe('글 요약입니다');

    act(() => root.unmount());
    expect(document.title).toBe('기본 제목');
    expect(metaContent('meta[name="description"]')).toBe('기본 설명');
    expect(metaContent('meta[property="og:title"]')).toBe('기본 OG 제목');
  });

  it('값이 비어 있으면 기존 제목과 설명을 건드리지 않는다', () => {
    mount({ title: null, description: '' });
    expect(document.title).toBe('기본 제목');
    expect(metaContent('meta[name="description"]')).toBe('기본 설명');
  });

  it('문서에 없는 meta 태그는 새로 만들지 않는다', () => {
    mount({ title: 'T', description: 'D' });
    expect(document.head.querySelector('meta[name="twitter:description"]')).toBeNull();
  });

  it('공개 origin 이 설정되면 canonical 링크를 만들고 언마운트하면 제거한다', () => {
    vi.stubEnv('VITE_PUBLIC_ORIGIN', 'https://blog.example.test/');
    mount({ title: 'T', canonicalPath: '/@alice/hello' });
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://blog.example.test/@alice/hello');
    act(() => root.unmount());
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('공개 origin 이 없으면 canonical 을 만들지 않는다', () => {
    vi.stubEnv('VITE_PUBLIC_ORIGIN', '');
    mount({ title: 'T', canonicalPath: '/@alice/hello' });
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
