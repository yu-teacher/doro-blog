/** JWT 페이로드를 검증 없이 읽는다. 서명 검증은 서버의 몫이고, 여기서는 만료/역할/이메일 표시용으로만 쓴다. */
export type JwtPayload = Record<string, unknown>;

function base64UrlToUtf8(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload: unknown = JSON.parse(base64UrlToUtf8(parts[1]));
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? (payload as JwtPayload) : null;
  } catch {
    return null;
  }
}

/** 만료 직전 토큰을 만료로 보는 여유 시간 (시계 오차/네트워크 지연 대비). */
const EXPIRY_SKEW_MS = 5_000;

// 토큰 만료 여부. 읽을 수 없거나 exp 가 없는 토큰은 각각 만료 / 비만료로 취급한다.
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false;
  return Date.now() >= payload.exp * 1000 - EXPIRY_SKEW_MS;
}

export function getUserRole(token: string | null): string | null {
  const role = decodeJwtPayload(token)?.role;
  return typeof role === 'string' && role ? role : null;
}

export function isUserAdmin(token: string | null): boolean {
  const role = getUserRole(token);
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
