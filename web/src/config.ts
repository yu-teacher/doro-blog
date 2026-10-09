import { apiBase, routerBasename } from './utils/basePath';

/** Vite `base`. 루트면 '/', 게이트웨이 하위 경로 마운트면 '/blog/'. 빌드 때 VITE_BASE_PATH 로 정한다(vite.config.ts). */
export const BASE_URL = import.meta.env.BASE_URL;

/** 라우터 basename: base 끝의 슬래시를 뗀 값. */
export const ROUTER_BASENAME = routerBasename(BASE_URL);

/** 백엔드 API 기준 경로. 게이트웨이가 하위 경로를 떼고 백엔드의 /api/v1 로 전달한다. */
export const API_BASE = apiBase(BASE_URL);

/** 로그인(BFF) 엔드포인트의 공개 경로. 브라우저가 이동하거나 호출하므로 하위 경로를 포함한다. */
export const BFF_BASE = `${API_BASE}/bff`;

/** public 폴더의 정적 파일 주소(예: 로고). base 를 따라간다. */
export function assetUrl(file: string): string {
  return `${BASE_URL}${file.replace(/^\/+/, '')}`;
}
