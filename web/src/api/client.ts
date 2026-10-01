import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, isTokenExpired } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = useAuthStore.getState().token;
  const refreshToken = useAuthStore.getState().refreshToken;

  // If token is missing/expired but refresh token exists, refresh seamlessly
  if ((!token || isTokenExpired(token)) && refreshToken) {
    token = await useAuthStore.getState().refreshAuthToken();
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 취소(AbortController)는 오류 메시지로 바꾸지 않고 그대로 전달해 호출자가 구분할 수 있게 한다.
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Handle 401 Unauthorized with token refresh and retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken, refreshSession, logout, openLoginModal } = useAuthStore.getState();
      const sessionExpired = new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');

      if (!refreshToken) {
        logout();
        openLoginModal();
        return Promise.reject(sessionExpired);
      }

      const outcome = await refreshSession();
      if (outcome.kind === 'refreshed') {
        originalRequest.headers.Authorization = `Bearer ${outcome.accessToken}`;
        return apiClient(originalRequest);
      }
      if (outcome.kind === 'rejected') {
        // 서버가 리프레시 토큰을 거부한 경우에만 로그아웃한다.
        logout();
        openLoginModal();
        return Promise.reject(sessionExpired);
      }
      // unavailable(네트워크/5xx): 로그인 상태를 유지하고 원래 오류를 전달한다.
    }

    // 표준 오류 본문(최상위 message)을 우선하고, 이전 형식(error.message)도 읽는다
    const body = error.response?.data;
    const message = body?.message || body?.error?.message || error.message || '요청 처리 중 오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  }
);

