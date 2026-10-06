import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { CSRF_HEADER, CSRF_VALUE } from './csrf';

/** 로그인은 서버가 관리하는 세션 쿠키(HttpOnly)로 이루어진다. 같은 사이트 요청에는 브라우저가 쿠키를 알아서 붙인다. */
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    [CSRF_HEADER]: CSRF_VALUE,
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 취소(AbortController)는 오류 메시지로 바꾸지 않고 그대로 전달해 호출자가 구분할 수 있게 한다.
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // 401: 세션이 끝났다. 화면 상태를 비로그인으로 맞춘다. (갑자기 다른 화면으로 보내지 않는다 — 작성 중인 글이 있을 수 있다)
    if (error.response?.status === 401) {
      useAuthStore.getState().markSignedOut();
      return Promise.reject(new Error('로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.'));
    }

    // 표준 오류 본문(최상위 message)을 우선하고, 이전 형식(error.message)도 읽는다
    const body = error.response?.data;
    const message = body?.message || body?.error?.message || error.message || '요청 처리 중 오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  }
);
