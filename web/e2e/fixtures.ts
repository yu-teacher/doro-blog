import type { Page, Route } from '@playwright/test';

const API = '/api/v1';
const LONG = 'x'.repeat(60);
const NOW = '2026-10-01T09:00:00Z';

export const ME = {
  id: 'u-me', username: 'doro', email: 'doro@doro.test', nickname: '도로롱', blogTitle: '도로의 블로그', bio: '개발하는 사람입니다.',
  followerCount: 12, followingCount: 3, isFollowing: null, createdAt: '2026-01-01T00:00:00Z',
};
const AUTHOR = {
  id: 'u-author', username: 'longnameauthor', nickname: `닉네임이아주긴작성자${LONG}`, blogTitle: `제목이 아주 긴 블로그 ${LONG}`, bio: `소개글에도 끊을 곳 없는 긴 문자열이 들어갑니다 ${LONG}${LONG}`,
  followerCount: 1234, followingCount: 56, isFollowing: false, createdAt: '2026-01-01T00:00:00Z',
};

function post(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `p${i}`, userId: AUTHOR.id, username: AUTHOR.username, nickname: AUTHOR.nickname,
    title: i === 1 ? `끊을 곳 없는 아주 긴 제목 ${LONG}${LONG}` : `모바일에서 읽기 좋은 제목의 글 ${i}번 — 조금 길게 써서 두 줄이 되도록 합니다`,
    slug: `post-${i}`, summary: i === 1 ? `요약에도 긴 단어 ${LONG}${LONG}` : '요약문이 이어집니다. 두세 줄 정도로 보여 줍니다.',
    status: 'PUBLISHED', viewCount: 1234, likeCount: 56, commentCount: 7, publishedAt: NOW, createdAt: NOW,
    tags: i === 1 ? [LONG, 'kotlin', 'spring-boot', 'react', 'typescript', '긴태그이름입니다'] : ['kotlin', 'react'], seriesId: undefined, ...overrides,
  };
}
const posts = (n: number) => Array.from({ length: n }, (_, i) => post(i + 1));
const page = <T,>(content: T[]) => ({ content, totalElements: content.length, totalPages: 1, size: 20, number: 0, first: true, last: true, empty: content.length === 0 });

const MARKDOWN = `# 큰 제목

본문 문단입니다. 모바일에서 읽기 좋게 줄바꿈되어야 합니다. 끊을 곳 없는 긴 주소: https://example.com/${LONG}${LONG}/path

## 코드

\`\`\`typescript
const veryLongLine = "${LONG}${LONG}${LONG}"; // 코드 블록은 가로로 스크롤되어야 합니다
function sum(a: number, b: number): number { return a + b; }
\`\`\`

## 표

| 열 하나 | 열 둘 | 열 셋 | 열 넷 |
| --- | --- | --- | --- |
| ${LONG} | 값 | 값 | 값 |

> 인용문입니다.

- 목록 하나
- 목록 둘
`;

const comments = [
  { id: 'c1', postId: 'p1', userId: 'u-a', username: 'a', nickname: `댓글작성자${LONG}`, content: `댓글 내용에도 긴 단어 ${LONG}${LONG}`, isDeleted: false, createdAt: NOW, updatedAt: NOW,
    replies: [{ id: 'c2', postId: 'p1', userId: 'u-me', username: 'doro', nickname: '도로롱', content: '답글입니다', isDeleted: false, createdAt: NOW, updatedAt: NOW, replies: [] }] },
];

const series = { id: 's1', userId: AUTHOR.id, username: AUTHOR.username, title: `시리즈 제목 ${LONG}`, slug: 'series-1', description: `시리즈 설명 ${LONG}`, postCount: 3, createdAt: NOW, updatedAt: NOW };
const seriesPosts = [1, 2, 3].map((i) => ({ id: `p${i}`, seriesOrder: i, title: `시리즈의 ${i}번째 글 ${i === 1 ? LONG : ''}`, slug: `post-${i}`, summary: '요약', status: 'PUBLISHED', publishedAt: NOW }));

const notifications = Array.from({ length: 5 }, (_, i) => ({
  id: `n${i}`, type: (['COMMENT', 'REPLY', 'LIKE', 'FOLLOW'] as const)[i % 4], isRead: i % 2 === 0, createdAt: NOW,
  message: i === 1 ? LONG + LONG : '댓글을 남겼습니다', targetPostTitle: '글 제목', targetPostSlug: 'post-1', targetUsername: AUTHOR.username,
  sender: { id: 's', username: 'sender', nickname: i === 2 ? `닉네임${LONG}` : '보낸이' },
}));

const envelope = (data: unknown) => ({ success: true, data, timestamp: NOW });
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface MockOptions {
  loggedIn: boolean;
}

/** 블로그 서버(BFF 세션 포함) 응답을 가짜로 대체한다. 모르는 요청은 404 로 두어 예상치 못한 호출을 드러낸다. */
export async function mockApi(page: Page, { loggedIn }: MockOptions): Promise<void> {
  await page.route((url) => url.pathname.startsWith(API), async (route) => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.fallback();
    const path = decodeURIComponent(new URL(request.url()).pathname.slice(API.length));
    const method = request.method();

    if (path === '/bff/session') return json(route, envelope(loggedIn ? { authenticated: true, user: ME, role: 'USER' } : { authenticated: false, user: null }));
    if (path === '/users/me') return loggedIn ? json(route, envelope(ME)) : json(route, { success: false }, 401);
    if (path === '/notifications/unread-count') return json(route, envelope({ unreadCount: loggedIn ? 3 : 0 }));
    if (path === '/notifications') return json(route, envelope(page_(notifications)));
    if (path === '/tags') return json(route, envelope([{ id: 't1', name: 'kotlin', postCount: 12 }, { id: 't2', name: LONG, postCount: 3 }, { id: 't3', name: 'react', postCount: 8 }]));
    if (path === '/posts' || path === '/posts/trending' || path === '/posts/following' || path === '/posts/search') return json(route, envelope(page_(posts(8))));
    if (path === '/posts/me') return json(route, envelope(page_(posts(4).map((p, i) => ({ ...p, username: ME.username, status: i % 2 ? 'DRAFT' : 'PUBLISHED' })))));
    if (path === '/posts/me/likes') return json(route, envelope(page_(posts(3))));
    if (path.startsWith('/posts/users/@')) return json(route, envelope(page_(posts(6))));
    if (/^\/posts\/@[^/]+\/[^/]+\/related$/.test(path)) return json(route, envelope(posts(3)));
    if (/^\/posts\/@[^/]+\/[^/]+$/.test(path)) {
      return json(route, envelope({ post: post(1, { seriesId: 's1', seriesTitle: series.title, seriesOrder: 1 }), content: MARKDOWN, likedByMe: false,
        author: { id: AUTHOR.id, username: AUTHOR.username, nickname: AUTHOR.nickname, bio: AUTHOR.bio, blogTitle: AUTHOR.blogTitle, followerCount: AUTHOR.followerCount, isFollowing: false } }));
    }
    if (/^\/posts\/[^/]+\/comments$/.test(path) && method === 'GET') return json(route, envelope(comments));
    if (path === `/users/${AUTHOR.username}` || path === `/users/@${AUTHOR.username}`) return json(route, envelope(AUTHOR));
    if (path === `/users/${ME.username}` || path === `/users/@${ME.username}`) return json(route, envelope(ME));
    if (/^\/users\/@?[^/]+\/(tags|activity)$/.test(path)) return json(route, envelope([]));
    if (/^\/series\/users\/@[^/]+$/.test(path)) return json(route, envelope([series]));
    if (/^\/series\/users\/@[^/]+\/[^/]+$/.test(path) || path === '/series/s1') return json(route, envelope({ series, posts: seriesPosts }));
    if (path === '/api-keys' || path === '/api-keys/logs') return json(route, envelope(path === '/api-keys' ? [] : page_([])));
    return json(route, { success: false, error: { code: 'NOT_MOCKED', message: `${method} ${path}` }, timestamp: NOW }, 404);
  });
}

function page_<T>(content: T[]) {
  return page(content);
}

export { AUTHOR };
