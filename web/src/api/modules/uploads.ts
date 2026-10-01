import { apiClient } from '../client';
import type {
  ApiResponse,
  UploadResponse,
} from '../types';

/** 이미지 업로드 API. */
export const uploadsApi = {
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
};
