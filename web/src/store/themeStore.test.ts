import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('[알려진 버그] 저장소 접근이 막힌 환경', () => {
  it('localStorage 접근이 예외를 던져도 테마 저장소를 불러올 수 있다 (앱이 아예 뜨지 않으면 안 된다)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.resetModules();

    await expect(import('./themeStore')).resolves.toBeDefined();
  });
});
