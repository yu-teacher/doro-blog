import { apiClient } from './client';
import {
  ApiResponse,
  PageResponse,
  PostSummary,
  PostDetail,
  Series,
  SeriesDetail,
  Comment,
  TagItem,
  UserProfile,
  PostStatus,
  FollowUser,
  UserTagSummary,
  UserActivity,
  UpdateProfilePayload,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyLog,
  UploadResponse,
  NotificationItem,
  UnreadCountResponse,
} from './types';

export const blogApi = {
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
    const res = await apiClient.get<ApiResponse<PostSummary[]>>(`/posts/@${cleanUsername}/${slug}/related`, {
      params: { limit },
      signal,
    });
    return res.data.data;
  },

  async getPostDetail(username: string, slug: string, signal?: AbortSignal): Promise<PostDetail> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/${cleanUsername}/${slug}`, { signal });
    return res.data.data;
  },

  async getPostBySlug(username: string, slug: string, signal?: AbortSignal): Promise<PostDetail> {
    return this.getPostDetail(username, slug, signal);
  },

  async getPostById(postId: string): Promise<PostDetail> {
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/${postId}`);
    return res.data.data;
  },

  async getLatestPosts(page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    return this.getFeed('latest', undefined, page, size, signal);
  },

  async getPostsByTag(tag: string | string[], page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    return this.getFeed('latest', tag, page, size, signal);
  },

  async getUserPosts(username: string, q?: string, tag?: string, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<PostSummary>> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>(`/posts/users/@${cleanUsername}`, {
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
    return this.toggleLike(postId);
  },

  async unlikePost(postId: string): Promise<boolean> {
    return this.toggleLike(postId);
  },

  // === Comments ===
  async getComments(postId: string, signal?: AbortSignal): Promise<Comment[]> {
    const res = await apiClient.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`, { signal });
    return res.data.data;
  },

  async createComment(postId: string, content: string, parentCommentId?: string): Promise<Comment> {
    if (parentCommentId) {
      return this.createReply(postId, parentCommentId, content);
    }
    return this.createRootComment(postId, content);
  },

  async createRootComment(postId: string, content: string): Promise<Comment> {
    const res = await apiClient.post<ApiResponse<Comment>>(`/posts/${postId}/comments`, { content });
    return res.data.data;
  },

  async createReply(postId: string, parentCommentId: string, content: string): Promise<Comment> {
    const res = await apiClient.post<ApiResponse<Comment>>(`/posts/${postId}/comments/${parentCommentId}/replies`, {
      content,
    });
    return res.data.data;
  },

  async updateComment(commentId: string, content: string): Promise<Comment> {
    const res = await apiClient.put<ApiResponse<Comment>>(`/comments/${commentId}`, { content });
    return res.data.data;
  },

  async deleteComment(commentId: string): Promise<void> {
    await apiClient.delete(`/comments/${commentId}`);
  },

  // === Series ===
  async getSeriesDetail(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail> {
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/${seriesId}`, { signal });
    return res.data.data;
  },

  async getSeries(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail> {
    return this.getSeriesDetail(seriesId, signal);
  },

  async getSeriesBySlug(username: string, slug: string, signal?: AbortSignal): Promise<SeriesDetail> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/users/@${cleanUsername}/${slug}`, { signal });
    return res.data.data;
  },

  async getUserSeries(username: string, signal?: AbortSignal): Promise<Series[]> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<Series[]>>(`/series/users/@${cleanUsername}`, { signal });
    return res.data.data;
  },


  async createSeries(data: {
    title: string;
    slug?: string;
    description?: string;
    thumbnailUrl?: string;
  }): Promise<Series> {
    const res = await apiClient.post<ApiResponse<Series>>('/series', data);
    return res.data.data;
  },

  async updateSeries(
    seriesId: string,
    data: {
      title: string;
      slug?: string;
      description?: string;
      thumbnailUrl?: string;
    }
  ): Promise<Series> {
    const res = await apiClient.put<ApiResponse<Series>>(`/series/${seriesId}`, data);
    return res.data.data;
  },

  async deleteSeries(seriesId: string): Promise<void> {
    await apiClient.delete(`/series/${seriesId}`);
  },

  async reorderSeries(seriesId: string, postIds: string[]): Promise<SeriesDetail> {
    const res = await apiClient.put<ApiResponse<SeriesDetail>>(`/series/${seriesId}/sort`, { postIds });
    return res.data.data;
  },

  // === Tags ===
  async getPopularTags(): Promise<TagItem[]> {
    const res = await apiClient.get<ApiResponse<TagItem[]>>('/tags');
    return res.data.data;
  },

  // === Users ===
  async getUserProfile(username: string, signal?: AbortSignal): Promise<UserProfile> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserProfile>>(`/users/${cleanUsername}`, { signal });
    return res.data.data;
  },

  async getMyProfile(): Promise<UserProfile> {
    const res = await apiClient.get<ApiResponse<UserProfile>>('/users/me');
    return res.data.data;
  },

  async updateMyProfile(data: UpdateProfilePayload): Promise<UserProfile> {
    const res = await apiClient.put<ApiResponse<UserProfile>>('/users/me', data);
    return res.data.data;
  },

  async followUser(username: string): Promise<UserProfile> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.post<ApiResponse<UserProfile>>(`/users/${cleanUsername}/follow`);
    return res.data.data;
  },

  async unfollowUser(username: string): Promise<UserProfile> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.delete<ApiResponse<UserProfile>>(`/users/${cleanUsername}/follow`);
    return res.data.data;
  },

  async getFollowers(username: string, page = 0, size = 20): Promise<PageResponse<FollowUser>> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PageResponse<FollowUser>>>(`/users/${cleanUsername}/followers`, {
      params: { page, size },
    });
    return res.data.data;
  },

  async getFollowing(username: string, page = 0, size = 20): Promise<PageResponse<FollowUser>> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PageResponse<FollowUser>>>(`/users/${cleanUsername}/following`, {
      params: { page, size },
    });
    return res.data.data;
  },

  async getUserTags(username: string, signal?: AbortSignal): Promise<UserTagSummary[]> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserTagSummary[]>>(`/users/${cleanUsername}/tags`, { signal });
    return res.data.data;
  },

  async getUserActivity(username: string, signal?: AbortSignal): Promise<UserActivity[]> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserActivity[]>>(`/users/${cleanUsername}/activity`, { signal });
    return res.data.data;
  },

  // === API Keys ===
  async createApiKey(payload: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const res = await apiClient.post<ApiResponse<CreateApiKeyResponse>>('/api-keys', payload);
    return res.data.data;
  },

  async getMyApiKeys(): Promise<ApiKey[]> {
    const res = await apiClient.get<ApiResponse<ApiKey[]>>('/api-keys');
    return res.data.data;
  },

  async revokeApiKey(id: string): Promise<void> {
    await apiClient.delete(`/api-keys/${id}`);
  },

  async getApiKeyLogs(apiKeyId?: string, page = 0, size = 20): Promise<PageResponse<ApiKeyLog>> {
    const res = await apiClient.get<ApiResponse<PageResponse<ApiKeyLog>>>('/api-keys/logs', {
      params: { apiKeyId, page, size },
    });
    return res.data.data;
  },

  // === Uploads ===
  async uploadImage(file: File, subDirectory = 'posts'): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subDirectory', subDirectory);
    const res = await apiClient.post<ApiResponse<UploadResponse>>('/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  // === Notifications ===
  async getNotifications(page = 0, size = 20): Promise<PageResponse<NotificationItem>> {
    const res = await apiClient.get<ApiResponse<PageResponse<NotificationItem>>>('/notifications', {
      params: { page, size },
    });
    return res.data.data;
  },

  async getUnreadNotificationCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<UnreadCountResponse>>('/notifications/unread-count');
    return res.data.data.unreadCount;
  },

  async markNotificationAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsAsRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  },

  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
