import { apiClient } from '../client';
import type {
  ApiResponse,
  PageResponse,
  PostSummary,
  PostDetail,
  PostStatus,
} from '../types';

/** 글 목록/상세/작성/수정/삭제/좋아요 API. */
export const postsApi = {
  async getFeed(sort = 'latest', tag?: string | string[], page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const params: Record<string, string | number> = { sort, page, size };
    if (tag) {
      if (Array.isArray(tag)) {
        params.tags = tag.join(',');
      } else {
        params.tag = tag;
      }
    }
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts', { params, signal });
    return res.data.data;
  },

  async getTrendingPosts(timeframe = 'week', page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/trending', {
      params: { timeframe, page, size },
      signal,
    });
    return res.data.data;
  },

  async getFollowingPosts(page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/following', {
      params: { page, size },
      signal,
    });
    return res.data.data;
  },

  async getRelatedPosts(username: string, slug: string, limit = 4, signal?: AbortSignal): Promise<PostSummary[]> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<PostSummary[]>>(`/posts/@${encodeURIComponent(cleanUsername)}/${encodeURIComponent(slug)}/related`, {
      params: { limit },
      signal,
    });
    return res.data.data;
  },

  async getPostDetail(username: string, slug: string, signal?: AbortSignal): Promise<PostDetail> {
    // 슬러그·사용자명은 경로의 한 조각이다. / ? # % 가 들어 있어도 다른 경로나 쿼리로 해석되지 않게 인코딩한다
    const handle = encodeURIComponent(username.startsWith('@') ? username.substring(1) : username);
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/@${handle}/${encodeURIComponent(slug)}`, { signal });
    return res.data.data;
  },

  async getPostBySlug(username: string, slug: string, signal?: AbortSignal): Promise<PostDetail> {
    return postsApi.getPostDetail(username, slug, signal);
  },

  async getPostById(postId: string): Promise<PostDetail> {
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/${encodeURIComponent(postId)}`);
    return res.data.data;
  },

  async getLatestPosts(page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    return postsApi.getFeed('latest', undefined, page, size, signal);
  },

  async getPostsByTag(tag: string | string[], page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    return postsApi.getFeed('latest', tag, page, size, signal);
  },

  async getUserPosts(username: string, q?: string, tag?: string, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>(`/posts/users/@${encodeURIComponent(cleanUsername)}`, {
      params: { q, tag, page, size },
      signal,
    });
    return res.data.data;
  },

  async getMyPosts(status?: PostStatus, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/me', {
      params: { status, page, size },
      signal,
    });
    return res.data.data;
  },

  async getMyLikedPosts(page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/me/likes', {
      params: { page, size },
      signal,
    });
    return res.data.data;
  },

  async searchPosts(q: string, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/search', {
      params: { q, page, size },
      signal,
    });
    return res.data.data;
  },

  async createPost(data: {
    title: string;
    slug?: string;
    summary?: string;
    content: string;
    thumbnailUrl?: string;
    status: PostStatus;
    seriesId?: string;
    tags?: string[];
  }): Promise<PostSummary> {
    const res = await apiClient.post<ApiResponse<PostSummary>>('/posts', data);
    return res.data.data;
  },

  async updatePost(
    postId: string,
    data: {
      title: string;
      slug?: string;
      summary?: string;
      content: string;
      thumbnailUrl?: string;
      status: PostStatus;
      seriesId?: string;
      /** true 면 글을 시리즈에서 뺀다. seriesId 를 생략한 것만으로는 시리즈가 바뀌지 않는다. */
      removeFromSeries?: boolean;
      tags?: string[];
    }
  ): Promise<PostSummary> {
    const res = await apiClient.put<ApiResponse<PostSummary>>(`/posts/${postId}`, data);
    return res.data.data;
  },

  async deletePost(postId: string): Promise<void> {
    await apiClient.delete(`/posts/${postId}`);
  },

  async toggleLike(postId: string): Promise<boolean> {
    const res = await apiClient.post<ApiResponse<{ liked: boolean }>>(`/posts/${postId}/likes`);
    return res.data.data.liked;
  },

  async likePost(postId: string): Promise<boolean> {
    return postsApi.toggleLike(postId);
  },

  async unlikePost(postId: string): Promise<boolean> {
    return postsApi.toggleLike(postId);
  },
};
