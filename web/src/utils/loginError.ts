/** 로그인 콜백이 실패했을 때 서버가 /?login_error=<코드> 로 돌려보낸다. 사유를 자세히 알리지 않고 두 가지로만 구분한다. */
export const LOGIN_ERROR_PARAM = 'login_error';

const MESSAGES: Record<string, string> = {
  cancelled: '로그인이 취소되었습니다.',
  failed: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
};

/** 알 수 없는 코드는 안내를 띄우지 않는다 (임의의 문구를 주소창으로 화면에 넣을 수 없게 한다). */
export function loginErrorMessage(code: string | null): string | null {
  return code !== null && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : null;
}

/** 주소에서 login_error 를 빼낸 상대 주소. 새로고침해도 안내가 다시 뜨지 않게 주소창을 정리하는 데 쓴다. */
export function withoutLoginError(pathname: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete(LOGIN_ERROR_PARAM);
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`;
}
