import axios, { isAxiosError } from 'axios';
import { decodeJwtPayload } from '../utils/jwt';

const REFRESH_URL = '/iam/api/v1/auth/token/refresh';
const REFRESH_LOCK_NAME = 'doro-token-refresh';
// 포털(IAM 통합 계정 센터)과 공유하는 계정 저장소. 두 앱이 같은 리프레시 토큰 계열을 쓰므로 항상 최신 값을 함께 유지해야 한다.
export const SHARED_ACCOUNTS_KEY = 'doro_auth_accounts';

// 서버가 리프레시 토큰 자체를 거부(만료/폐기/재사용 감지)한 것으로 보는 상태 코드
const REJECTED_STATUSES = new Set([400, 401, 403, 404]);

export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string; refreshToken: string }
  | { kind: 'rejected' }
  | { kind: 'unavailable' };

interface SharedAccount extends Record<string, unknown> {
  email?: string;
  accessToken?: string;
  refreshToken?: string;
}

const decodePayload = decodeJwtPayload;

export function emailOfToken(token: string | null): string | null {
  const email = decodePayload(token)?.email;
  return typeof email === 'string' ? email.toLowerCase() : null;
}

function issuedAtOf(token: string | null): number {
  const iat = decodePayload(token)?.iat;
  return typeof iat === 'number' ? iat : 0;
}

function isExpired(token: string | null): boolean {
  const exp = decodePayload(token)?.exp;
  return typeof exp !== 'number' || exp * 1000 <= Date.now();
}

function readSharedAccounts(): SharedAccount[] {
  try {
    const raw = localStorage.getItem(SHARED_ACCOUNTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SharedAccount[]) : [];
  } catch {
    return [];
  }
}

/**
 * 포털 등 다른 앱이 같은 계정으로 이미 더 최근에 갱신해 둔 유효한 토큰이 있으면 돌려준다.
 * (이 경우 다시 회전시키면 포털의 리프레시 토큰이 폐기되어 재사용 공격으로 오인된다.)
 */
export function findFresherSharedTokens(
  email: string | null,
  currentAccessToken: string | null,
): { accessToken: string; refreshToken: string } | null {
  if (!email) return null;
  const shared = readSharedAccounts().find((acc) => acc.email?.toLowerCase() === email);
  if (!shared?.accessToken || !shared.refreshToken) return null;
  if (isExpired(shared.accessToken)) return null;
  return issuedAtOf(shared.accessToken) > issuedAtOf(currentAccessToken)
    ? { accessToken: shared.accessToken, refreshToken: shared.refreshToken }
    : null;
}

/** 갱신 결과를 공유 계정 저장소에 반영해 포털이 폐기된 리프레시 토큰을 쓰지 않게 한다. */
export function writeBackSharedTokens(email: string | null, accessToken: string, refreshToken: string): void {
  if (!email) return;
  const accounts = readSharedAccounts();
  let changed = false;
  const updated = accounts.map((acc) => {
    if (acc.email?.toLowerCase() === email) {
      changed = true;
      return { ...acc, accessToken, refreshToken };
    }
    return acc;
  });
  if (changed) {
    localStorage.setItem(SHARED_ACCOUNTS_KEY, JSON.stringify(updated));
  }
}

/** 리프레시 토큰으로 새 토큰을 요청하고, 서버 거부와 일시적 장애를 구분해 돌려준다. */
export async function requestTokenRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await axios.post(REFRESH_URL, { refreshToken });
    const data = response.data?.data ?? response.data ?? {};
    if (typeof data.accessToken === 'string' && data.accessToken) {
      return {
        kind: 'refreshed',
        accessToken: data.accessToken,
        refreshToken: typeof data.refreshToken === 'string' && data.refreshToken ? data.refreshToken : refreshToken,
      };
    }
    return { kind: 'unavailable' };
  } catch (error) {
    if (isAxiosError(error) && error.response && REJECTED_STATUSES.has(error.response.status)) {
      return { kind: 'rejected' };
    }
    // 네트워크 오류·타임아웃·5xx 는 일시적 장애다. 로그아웃하지 않고 호출자가 나중에 다시 시도하게 한다.
    return { kind: 'unavailable' };
  }
}

/** 여러 탭(및 포털)이 동시에 토큰을 회전시키지 않도록 브라우저 전체 락을 잡는다. 미지원 환경에서는 그대로 실행한다. */
export function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request(REFRESH_LOCK_NAME, task) : task();
}
