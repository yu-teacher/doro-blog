import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { blogApi } from './blogApi';

const ok = { data: { success: true, data: {}, timestamp: '' } };

afterEach(() => vi.restoreAllMocks());

describe('[알려진 버그] 경로에 들어가는 사용자 입력 인코딩', () => {
  it('슬러그에 / ? # 가 들어 있어도 한 경로 조각으로 보낸다', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok);

    await blogApi.getPostDetail('writer', 'a/b?c#d');

    expect(get.mock.calls[0][0]).toBe('/posts/@writer/a%2Fb%3Fc%23d');
  });

  it('슬러그의 % 도 이스케이프해 잘못된 퍼센트 인코딩이 되지 않게 한다', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok);

    await blogApi.getPostDetail('writer', '100%');

    expect(get.mock.calls[0][0]).toBe('/posts/@writer/100%25');
  });
});
