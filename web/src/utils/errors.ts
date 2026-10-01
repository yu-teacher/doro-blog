import axios from 'axios';

export const DEFAULT_ERROR_MESSAGE = '요청 처리 중 오류가 발생했습니다.';

interface ServerErrorShape {
  response?: { data?: { error?: { message?: unknown } } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 요청이 취소(AbortController)된 경우인지. 취소는 사용자에게 보여줄 오류가 아니다. */
export function isCancelled(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * 어떤 형태의 오류든 화면에 보여줄 메시지로 바꾼다.
 * apiClient 인터셉터는 서버 메시지를 담은 Error 로 바꿔서 던지지만, 인터셉터를 거치지 않은 axios 오류도 처리한다.
 */
export function getErrorMessage(err: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (isRecord(err)) {
    const serverMessage = (err as ServerErrorShape).response?.data?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}
