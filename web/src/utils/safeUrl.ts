/**
 * 사용자가 입력한 외부 링크를 화면에 그리기 전에 http(s) 절대 주소만 통과시킨다.
 * (백엔드도 저장 시 검증하지만, 이미 저장된 값이나 검증을 우회한 값에 대비한 심층 방어다.)
 * 허용되지 않으면 undefined 를 돌려주므로 호출부는 링크를 렌더링하지 않으면 된다.
 */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
