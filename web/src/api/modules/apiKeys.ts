import { apiClient } from '../client';
import type {
  ApiResponse,
  PageResponse,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyLog,
} from '../types';

/** 개인용 API 키 API. */
export const apiKeysApi = {
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
