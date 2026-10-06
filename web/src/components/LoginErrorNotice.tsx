import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { LOGIN_ERROR_PARAM, loginErrorMessage, withoutLoginError } from '../utils/loginError';

/** 로그인에 실패하거나 취소하고 돌아왔을 때 한 번만 보여 주는 안내. 주소창의 login_error 는 읽은 뒤 바로 지운다. */
export const LoginErrorNotice: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const found = loginErrorMessage(new URLSearchParams(window.location.search).get(LOGIN_ERROR_PARAM));
    if (found === null) return;
    setMessage(found);
    window.history.replaceState(null, '', withoutLoginError(window.location.pathname, window.location.search, window.location.hash));
  }, []);

  if (message === null) return null;
  return (
    <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-700 shadow-lg dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
      <span>{message}</span>
      <button type="button" aria-label="안내 닫기" onClick={() => setMessage(null)} className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900">
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};
