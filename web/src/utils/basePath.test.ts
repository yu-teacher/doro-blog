import { describe, expect, it } from 'vitest';
import { apiBase, navigateDenylist, normalizeBasePath, routerBasename, withBasename } from './basePath';

describe('normalizeBasePath', () => {
  it.each([
    [undefined, '/'],
    [null, '/'],
    ['', '/'],
    ['   ', '/'],
    ['/', '/'],
    ['blog', '/blog/'],
    ['/blog', '/blog/'],
    ['/blog/', '/blog/'],
    ['//blog//', '/blog/'],
    ['/a/b', '/a/b/'],
  ])('%j -> %s', (input, expected) => {
    expect(normalizeBasePath(input as string | undefined | null)).toBe(expected);
  });
});

describe('routerBasename / apiBase', () => {
  it('루트 마운트는 기존과 같다', () => {
    expect(routerBasename('/')).toBe('');
    expect(apiBase('/')).toBe('/api/v1');
  });

  it('하위 경로 마운트는 그 경로를 따른다', () => {
    expect(routerBasename('/blog/')).toBe('/blog');
    expect(apiBase('/blog/')).toBe('/blog/api/v1');
  });
});

describe('withBasename', () => {
  it('basename 이 없으면 경로를 그대로 둔다', () => {
    expect(withBasename('', '/@alice/post')).toBe('/@alice/post');
    expect(withBasename('', 'search')).toBe('/search');
  });

  it('basename 이 있으면 앞에 붙인다', () => {
    expect(withBasename('/blog', '/@alice/post')).toBe('/blog/@alice/post');
    expect(withBasename('/blog', '/')).toBe('/blog/');
  });

  it('이미 붙어 있으면 한 번만 붙인다', () => {
    expect(withBasename('/blog', '/blog/@alice')).toBe('/blog/@alice');
    expect(withBasename('/blog', '/blog')).toBe('/blog');
  });

  it('이름이 비슷한 다른 경로에는 붙인다(/blogger 는 /blog 의 하위가 아니다)', () => {
    expect(withBasename('/blog', '/blogger')).toBe('/blog/blogger');
  });
});

describe('navigateDenylist (서비스 워커가 앱 셸로 바꾸면 안 되는 이동)', () => {
  const denied = (base: string, url: string): boolean => navigateDenylist(base).some((re) => re.test(url));

  it('/blog/ 아래에서는 /blog/api/ 이동(로그인 시작·콜백 포함)을 거른다', () => {
    expect(denied('/blog/', '/blog/api/v1/bff/login')).toBe(true);
    expect(denied('/blog/', '/blog/api/v1/bff/callback?code=x')).toBe(true);
    expect(denied('/blog/', '/blog/@doro/my-post')).toBe(false);
    expect(denied('/blog/', '/blog/')).toBe(false);
    expect(denied('/blog/', '/blog/apix')).toBe(false);
  });

  it('루트 기준이면 /api/ 이동을 거른다', () => {
    expect(denied('/', '/api/v1/bff/login')).toBe(true);
    expect(denied('/', '/@doro')).toBe(false);
  });
});
