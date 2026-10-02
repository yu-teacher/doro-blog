/** 설정된 공개 origin(끝 슬래시 제거). 설정되어 있지 않으면 null. */
export function getPublicOrigin(): string | null {
  const raw = import.meta.env.VITE_PUBLIC_ORIGIN?.trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

/** 공개 origin 이 설정되어 있을 때만 절대 URL 을 만든다. */
export function toAbsoluteUrl(path: string): string | null {
  const origin = getPublicOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
