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
