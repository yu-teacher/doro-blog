import { apiClient } from '../client';
import type {
  ApiResponse,
  Series,
  SeriesDetail,
} from '../types';

/** 시리즈 API. */
export const seriesApi = {
  async getSeriesDetail(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail> {
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/${seriesId}`, { signal });
    return res.data.data;
  },

  async getSeries(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail> {
    return seriesApi.getSeriesDetail(seriesId, signal);
  },

  async getSeriesBySlug(username: string, slug: string, signal?: AbortSignal): Promise<SeriesDetail> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<SeriesDetail>>(`/series/users/@${encodeURIComponent(cleanUsername)}/${encodeURIComponent(slug)}`, { signal });
    return res.data.data;
  },

  async getUserSeries(username: string, signal?: AbortSignal): Promise<Series[]> {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const res = await apiClient.get<ApiResponse<Series[]>>(`/series/users/@${encodeURIComponent(cleanUsername)}`, { signal });
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

  /** 시리즈에 속하지 않은 내 글을 시리즈의 마지막 회차로 추가한다. 편집자 시점의 상세를 돌려준다. */
  async addSeriesPost(seriesId: string, postId: string): Promise<SeriesDetail> {
    const res = await apiClient.post<ApiResponse<SeriesDetail>>(`/series/${seriesId}/posts`, { postId });
    return res.data.data;
  },

  /** 글을 시리즈에서 뺀다(글은 지워지지 않는다). 남은 글의 회차는 서버가 1..n 으로 다시 매긴다. */
  async removeSeriesPost(seriesId: string, postId: string): Promise<SeriesDetail> {
    const res = await apiClient.delete<ApiResponse<SeriesDetail>>(`/series/${seriesId}/posts/${postId}`);
    return res.data.data;
  },

  async reorderSeries(seriesId: string, postIds: string[]): Promise<SeriesDetail> {
    const res = await apiClient.put<ApiResponse<SeriesDetail>>(`/series/${seriesId}/sort`, { postIds });
    return res.data.data;
  },
};
