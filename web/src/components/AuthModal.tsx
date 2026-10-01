import React, { useEffect, useState } from 'react';
import { AccountChooser } from './auth/AccountChooser';
import { CredentialsForm } from './auth/CredentialsForm';
import { useAuthStore } from '../store/authStore';
import { getSavedAccounts, removeSavedAccount, type SavedAccount } from '../store/savedAccounts';

const DEFAULT_LOGIN_ERROR = '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.';

interface ServerErrorBody {
  response?: { data?: { error?: { message?: unknown }; message?: unknown } };
}

/** IAM 은 인터셉터를 거치지 않는 axios 로 호출하므로 서버가 준 오류 본문에서 메시지를 직접 꺼낸다. */
function serverMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const data = (err as ServerErrorBody).response?.data;
  const message = data?.error?.message ?? data?.message;
  return typeof message === 'string' && message ? message : null;
}

/** DORO IAM 로그인 / 회원가입 모달 (이 기기에 저장된 계정을 고르는 Google 스타일 계정 선택 지원). */
export const AuthModal: React.FC = () => {
  const { loginModalOpen, closeLoginModal, loginWithIam, loginWithSavedAccount, signupWithIam } = useAuthStore();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [authMode, setAuthMode] = useState<'saved_accounts' | 'direct_input'>('saved_accounts');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshSavedAccountsList = () => {
    const list = getSavedAccounts();
    setSavedAccounts(list);
    return list;
  };

  const resetForm = () => {
    setErrorMsg('');
    setEmail('');
    setPassword('');
    setName('');
  };

  // 모달이 열릴 때마다(스토어의 openLoginModal 을 어디서 호출했든) 폼을 비우고 저장된 계정 목록을 다시 읽는다
  useEffect(() => {
    if (!loginModalOpen) return;
    resetForm();
    setIsSignUpMode(false);
    setAuthMode(refreshSavedAccountsList().length > 0 ? 'saved_accounts' : 'direct_input');
  }, [loginModalOpen]);

  const handleClose = () => {
    closeLoginModal();
    resetForm();
  };

  const handleSelectSavedAccount = async (account: SavedAccount) => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginWithSavedAccount(account);
      closeLoginModal();
    } catch (err: unknown) {
      console.warn('Saved account login failed, redirecting to password input', err);
      setEmail(account.email);
      setPassword('');
      setAuthMode('direct_input');
      setErrorMsg('보안을 위해 계정 비밀번호를 한 번 더 확인합니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, accountEmail: string) => {
    e.stopPropagation();
    removeSavedAccount(accountEmail);
    const updated = refreshSavedAccountsList();
    if (updated.length === 0) {
      setAuthMode('direct_input');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUpMode) {
        if (!name.trim()) {
          setErrorMsg('이름을 입력해주세요.');
          setLoading(false);
          return;
        }
        await signupWithIam(email.trim(), password, name.trim());
        // Auto-login right after signup
        await loginWithIam(email.trim(), password);
      } else {
        await loginWithIam(email.trim(), password);
      }
      closeLoginModal();
    } catch (err: unknown) {
      console.error('Auth error', err);
      setErrorMsg(serverMessage(err) ?? DEFAULT_LOGIN_ERROR);
    } finally {
      setLoading(false);
    }
  };

  if (!loginModalOpen) return null;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100 cursor-default"
      >
        {authMode === 'saved_accounts' && savedAccounts.length > 0 ? (
          <AccountChooser
            savedAccounts={savedAccounts}
            errorMsg={errorMsg}
            onSelectAccount={handleSelectSavedAccount}
            onRemoveAccount={handleRemoveSavedAccount}
            onUseOtherAccount={() => {
              setAuthMode('direct_input');
              setErrorMsg('');
            }}
          />
        ) : (
          <CredentialsForm
            isSignUpMode={isSignUpMode}
            hasSavedAccounts={savedAccounts.length > 0}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            name={name}
            setName={setName}
            errorMsg={errorMsg}
            loading={loading}
            onSubmit={handleAuthSubmit}
            onBackToChooser={() => {
              setAuthMode('saved_accounts');
              setErrorMsg('');
            }}
            onToggleSignUp={() => {
              setIsSignUpMode(!isSignUpMode);
              setErrorMsg('');
            }}
          />
        )}

        <button
          onClick={handleClose}
          className="mt-4 w-full text-center text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          닫기
        </button>
      </div>
    </div>
  );
};
