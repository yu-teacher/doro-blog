import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { blogApi } from './blogApi';
import { apiKeysApi } from './modules/apiKeys';
import { commentsApi } from './modules/comments';
import { notificationsApi } from './modules/notifications';
import { postsApi } from './modules/posts';
import { seriesApi } from './modules/series';
import { tagsApi } from './modules/tags';
import { uploadsApi } from './modules/uploads';
import { usersApi } from './modules/users';

const wrap = <T>(data: T) => ({ data: { success: true, data, timestamp: '' } });

afterEach(() => vi.restoreAllMocks());

describe('blogApi 구성', () => {
  it('모듈 사이에 메서드 이름이 겹치지 않는다 (겹치면 합칠 때 하나가 조용히 덮어쓴다)', () => {
    const modules = [postsApi, commentsApi, seriesApi, tagsApi, usersApi, apiKeysApi, uploadsApi, notificationsApi];
    const all = modules.flatMap((m) => Object.keys(m));
    expect(new Set(all).size).toBe(all.length);
    expect(Object.keys(blogApi).sort()).toEqual([...all].sort());
  });
});

describe('요청 형식', () => {
  it('getFeed: 단일 태그는 tag, 여러 태그는 쉼표로 이은 tags 로 보내고 취소 신호를 전달한다', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(wrap({ content: [] }));
    const controller = new AbortController();

    await blogApi.getFeed('popular', 'spring', 2, 15, controller.signal);
    expect(get).toHaveBeenLastCalledWith('/posts', { params: { sort: 'popular', page: 2, size: 15, tag: 'spring' }, signal: controller.signal });

    await blogApi.getFeed('latest', ['a', 'b']);
    expect(get).toHaveBeenLastCalledWith('/posts', { params: { sort: 'latest', page: 0, size: 20, tags: 'a,b' }, signal: undefined });
  });

  it('getPostDetail/getUserProfile: 사용자명 앞에 @ 를 붙여 경로를 만든다', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(wrap({}));
    await blogApi.getPostDetail('writer', 'my-slug');
    expect(get).toHaveBeenLastCalledWith('/posts/@writer/my-slug', { signal: undefined });
    await blogApi.getPostDetail('@writer', 'my-slug');
    expect(get).toHaveBeenLastCalledWith('/posts/@writer/my-slug', { signal: undefined });
    await blogApi.getUserProfile('writer');
    expect(get).toHaveBeenLastCalledWith('/users/@writer', { signal: undefined });
  });

  it('getLatestPosts/getPostsByTag 는 getFeed 와 같은 요청을 만든다', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(wrap({ content: [] }));
    await blogApi.getLatestPosts(1, 10);
    expect(get).toHaveBeenLastCalledWith('/posts', { params: { sort: 'latest', page: 1, size: 10 }, signal: undefined });
    await blogApi.getPostsByTag('docker', 0, 5);
    expect(get).toHaveBeenLastCalledWith('/posts', { params: { sort: 'latest', page: 0, size: 5, tag: 'docker' }, signal: undefined });
  });

  it('uploadImage: multipart 폼에 file 과 subDirectory 를 담는다', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(wrap({ url: '/media/x.png' }));
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    await blogApi.uploadImage(file, 'thumbnails');

    const [url, form, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/uploads');
    expect(form.get('subDirectory')).toBe('thumbnails');
    expect(form.get('file')).toBeInstanceOf(File);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('알림: 읽음은 PATCH, 모두 읽음은 POST, 삭제는 DELETE', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({});
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({});
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({});
    await blogApi.markNotificationAsRead('n1');
    await blogApi.markAllNotificationsAsRead();
    await blogApi.deleteNotification('n2');
    expect(patch).toHaveBeenCalledWith('/notifications/n1/read');
    expect(post).toHaveBeenCalledWith('/notifications/read-all');
    expect(del).toHaveBeenCalledWith('/notifications/n2');
  });

  it('getUnreadNotificationCount 는 응답에서 숫자만 꺼낸다', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(wrap({ unreadCount: 7 }));
    expect(await blogApi.getUnreadNotificationCount()).toBe(7);
  });
});
