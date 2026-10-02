import axios from 'axios';
import { requestTokenRefresh } from './tokenRefresh';
import { isTokenExpired } from '../utils/jwt';

const LOGOUT_URL = '/iam/api/v1/auth/logout';
const LOGOUT_TIMEOUT_MS = 5_000;

/**
 * 서버에서 현재 세션을 종료해 리프레시 토큰을 폐기한다. 어디에 복사돼 있든 더는 쓸 수 없게 된다.
 * 실패해도 로컬 로그아웃은 이미 끝난 상태이므로 던지지 않고 경고만 남긴다.
 * 액세스 토큰이 만료됐으면 리프레시 토큰으로 한 번 갱신한 뒤 종료한다.
 */
export async function revokeServerSession(accessToken: string | null, refreshToken: string | null): Promise<void> {
  let token = accessToken;
  if ((!token || isTokenExpired(token)) && refreshToken) {
    const outcome = await requestTokenRefresh(refreshToken);
    token = outcome.kind === 'refreshed' ? outcome.accessToken : null;
  }
  if (!token) {
    console.warn('Server session was not revoked: no usable token');
    return;
  }
  try {
    await axios.post(LOGOUT_URL, null, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: LOGOUT_TIMEOUT_MS,
    });
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    console.warn('Server session revocation failed', { status: status ?? 'network' });
  }
}
