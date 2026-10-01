import { apiClient } from '../client';
import type {
  ApiResponse,
  PageResponse,
  UserProfile,
  FollowUser,
  UserTagSummary,
  UserActivity,
  UpdateProfilePayload,
} from '../types';

/** 사용자 프로필, 팔로우, 활동 API. */
export const usersApi = {
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

  async getFollowers(username: string, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<FollowUser>> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PageResponse<FollowUser>>>(`/users/${cleanUsername}/followers`, {
      params: { page, size },
      signal,
    });
    return res.data.data;
  },

  async getFollowing(username: string, page = 0, size = 20, signal?: AbortSignal): Promise<PageResponse<FollowUser>> {
    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const res = await apiClient.get<ApiResponse<PageResponse<FollowUser>>>(`/users/${cleanUsername}/following`, {
      params: { page, size },
      signal,
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
};
