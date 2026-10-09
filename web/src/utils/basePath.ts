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

/**
 * 서비스 워커가 앱 셸(index.html)로 대신 응답하면 안 되는 이동 주소: 백엔드 API(`${base}api/`).
 * 로그인 시작·콜백(`/blog/api/v1/bff/login`, `.../callback`)은 브라우저 "이동"이지만 서버가 리다이렉트로 응답해야 하므로 반드시 네트워크로 가야 한다.
 */
export function navigateDenylist(baseUrl: string): RegExp[] {
  const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [new RegExp(`^${escaped}api/`)];
}
