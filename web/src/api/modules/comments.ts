import { apiClient } from '../client';
import type {
  ApiResponse,
  Comment,
} from '../types';

/** 댓글과 답글 API. */
export const commentsApi = {
  async getComments(postId: string, signal?: AbortSignal): Promise<Comment[]> {
    const res = await apiClient.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`, { signal });
    return res.data.data;
  },

  async createComment(postId: string, content: string, parentCommentId?: string): Promise<Comment> {
    if (parentCommentId) {
      return commentsApi.createReply(postId, parentCommentId, content);
    }
    return commentsApi.createRootComment(postId, content);
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
};
