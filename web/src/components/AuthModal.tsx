import React, { useEffect, useState } from 'react';
import { useAuthStore, getSavedAccounts, removeSavedAccount, type SavedAccount } from '../store/authStore';
import { ArrowLeft, ChevronRight, ExternalLink, Lock, Mail, ShieldCheck, Sparkles, Trash2, UserCheck, UserPlus } from 'lucide-react';

const DORO_SIGNUP_URL = '/portal/signup';
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
          /* Google-style Account Chooser View */
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg">
                <ShieldCheck className="w-6 h-6" />
                <span>DORO 계정 선택</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <Sparkles className="w-3 h-3" />
                원클릭 로그인
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5 leading-relaxed">
              이 기기에 저장된 DORO 통합 계정입니다. 클릭 한 번으로 비밀번호 입력 없이 즉시 로그인할 수 있습니다.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* Account List */}
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-0.5">
              {savedAccounts.map((acc) => (
                <div
                  key={acc.email}
                  onClick={() => handleSelectSavedAccount(acc)}
                  role="button"
                  tabIndex={0}
                  className="group flex items-center justify-between p-3.5 rounded-2xl border border-gray-200/90 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {acc.profileImageUrl ? (
                      <img
                        src={acc.profileImageUrl}
                        alt={acc.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-sm border border-emerald-500/20 shrink-0">
                        {(acc.name || acc.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-left min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {acc.name || acc.nickname || acc.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {acc.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSavedAccount(e, acc.email)}
                      title="이 기기에서 계정 기록 삭제"
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>

            {/* Switch to direct password input */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('direct_input');
                  setErrorMsg('');
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>다른 계정으로 로그인 (아이디/비밀번호)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Direct Input / Sign-up View */
          <div>
            {savedAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('saved_accounts');
                  setErrorMsg('');
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium mb-3 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>저장된 계정 목록으로</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg mb-1">
              <ShieldCheck className="w-6 h-6" />
              <span>DORO ID {isSignUpMode ? '회원가입' : '직접 로그인'}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              {isSignUpMode
                ? '새로운 DORO 통합 계정을 생성합니다.'
                : '이메일과 비밀번호를 입력하여 로그인하세요. 로그인 후 이 기기에 안전하게 저장됩니다.'}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {isSignUpMode && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이름</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="홍길동"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                    <UserCheck className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이메일 (DORO ID)</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="name@doro.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                  <Mail className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">비밀번호</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                  <Lock className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? '인증 처리 중...' : isSignUpMode ? 'DORO ID 회원가입' : 'DORO ID로 로그인'}</span>
              </button>
            </form>

            {/* DORO Central Portal Sign Up Guidance */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 text-center space-y-2">
              <div className="text-xs text-gray-600 dark:text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
                <span>{isSignUpMode ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUpMode(!isSignUpMode);
                    setErrorMsg('');
                  }}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  <span>{isSignUpMode ? '로그인하기' : '회원가입하기'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                DORO ID 하나로 블로그 및 도로 플랫폼 전체 서비스를 이용할 수 있습니다.
              </p>
              <div>
                <a
                  href={DORO_SIGNUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                >
                  <span>도로(DORO) 포털 웹에서 가입하기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
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
