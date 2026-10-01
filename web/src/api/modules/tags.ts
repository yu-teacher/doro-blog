import { apiClient } from '../client';
import type {
  ApiResponse,
  TagItem,
} from '../types';

/** 태그 API. */
export const tagsApi = {
  async getPopularTags(signal?: AbortSignal): Promise<TagItem[]> {
    const res = await apiClient.get<ApiResponse<TagItem[]>>('/tags', { signal });
    return res.data.data;
  },
};
