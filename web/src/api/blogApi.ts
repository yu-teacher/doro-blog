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
} from './types';

export const blogApi = {
  // === Posts ===
  async getFeed(sort = 'latest', tag?: string, page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts', {
      params: { sort, tag, page, size },
    });
    return res.data.data;
  },

  async getTrendingPosts(timeframe = 'week', page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/trending', {
      params: { timeframe, page, size },
    });
    return res.data.data;
  },

  async getFollowingPosts(page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/following', {
      params: { page, size },
    });
    return res.data.data;
  },

  async getRelatedPosts(username: string, slug: string, limit = 4): Promise<PostSummary[]> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<PostSummary[]>>(`/posts/@${cleanUsername}/${slug}/related`, {
      params: { limit },
    });
    return res.data.data;
  },

  async getPostDetail(username: string, slug: string): Promise<PostDetail> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/${cleanUsername}/${slug}`);
    return res.data.data;
  },

  async getPostBySlug(username: string, slug: string): Promise<PostDetail> {
    return this.getPostDetail(username, slug);
  },

  async getPostById(postId: string): Promise<PostDetail> {
    const res = await apiClient.get<ApiResponse<PostDetail>>(`/posts/${postId}`);
    return res.data.data;
  },

  async getLatestPosts(page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    return this.getFeed('latest', undefined, page, size);
  },

  async getPostsByTag(tag: string, page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    return this.getFeed('latest', tag, page, size);
  },

  async getUserPosts(username: string, q?: string, tag?: string, page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>(`/posts/users/@${cleanUsername}`, {
      params: { q, tag, page, size },
    });
    return res.data.data;
  },

  async getMyPosts(status?: PostStatus, page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/me', {
      params: { status, page, size },
    });
    return res.data.data;
  },

  async getMyLikedPosts(page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/me/likes', {
      params: { page, size },
    });
    return res.data.data;
  },

  async searchPosts(q: string, page = 0, size = 20): Promise<PageResponse<PostSummary>> {
    const res = await apiClient.get<ApiResponse<PageResponse<PostSummary>>>('/posts/search', {
      params: { q, page, size },
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
  async getComments(postId: string): Promise<Comment[]> {
    const res = await apiClient.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`);
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
  async getSeriesDetail(seriesId: string): Promise<SeriesDetail> {
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/${seriesId}`);
    return res.data.data;
  },

  async getSeries(seriesId: string): Promise<SeriesDetail> {
    return this.getSeriesDetail(seriesId);
  },

  async getSeriesBySlug(username: string, slug: string): Promise<SeriesDetail> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/users/@${cleanUsername}/${slug}`);
    return res.data.data;
  },

  async getUserSeries(username: string): Promise<Series[]> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<Series[]>>(`/series/users/@${cleanUsername}`);
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
  async getUserProfile(username: string): Promise<UserProfile> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserProfile>>(`/users/${cleanUsername}`);
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

  async getUserTags(username: string): Promise<UserTagSummary[]> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserTagSummary[]>>(`/users/${cleanUsername}/tags`);
    return res.data.data;
  },

  async getUserActivity(username: string): Promise<UserActivity[]> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<UserActivity[]>>(`/users/${cleanUsername}/activity`);
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
};
