/**
 * 웹이 마운트된 공개 하위 경로(Vite `base`)를 다루는 순수 함수. 설정(vite.config.ts)과 앱(config.ts)이 같은 규칙을 쓰도록 한곳에 둔다.
 * 루트에 마운트하면 '/', 하위 경로면 '/blog/' 처럼 앞뒤에 슬래시가 하나씩 붙은 값이다.
 */

/** 입력(예: 'blog', '/blog', '/blog/', '', undefined)을 앞뒤 슬래시가 하나씩 있는 base 로 맞춘다. 비어 있으면 '/'. */
export function normalizeBasePath(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '/' : `/${trimmed}/`;
}

/** 라우터 basename: base 끝의 슬래시를 뗀 값('/blog/' -> '/blog', '/' -> ''). */
export function routerBasename(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/** 백엔드 API 기준 경로: '/api/v1' 또는 '/blog/api/v1'. 게이트웨이가 하위 경로를 떼고 백엔드로 전달한다. */
export function apiBase(baseUrl: string): string {
  return `${baseUrl}api/v1`;
}

/** 앱 경로('/@alice/post')를 공개 경로('/blog/@alice/post')로 바꾼다. 이미 base 가 붙어 있어도 한 번만 붙인다. */
export function withBasename(basename: string, appPath: string): string {
  const path = appPath.startsWith('/') ? appPath : `/${appPath}`;
  if (basename === '' || path === basename || path.startsWith(`${basename}/`)) {
    return path;
  }
  return `${basename}${path}`;
}
