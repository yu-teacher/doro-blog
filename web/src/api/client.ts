import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore.getState();
      if (authStore.isAuthenticated) {
        authStore.logout();
        authStore.openLoginModal();
      }
      return Promise.reject(new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.'));
    }
    const errorDetail = error.response?.data?.error;
    const message = errorDetail?.message || error.message || '요청 처리 중 오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  }
);
