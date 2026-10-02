import React, { useId } from 'react';
import { ArrowLeft, ExternalLink, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';

import { AUTH_DIALOG_TITLE_ID } from './authDialog';

const DORO_SIGNUP_URL = '/portal/signup';

interface CredentialsFormProps {
  isSignUpMode: boolean;
  hasSavedAccounts: boolean;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  errorMsg: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBackToChooser: () => void;
  onToggleSignUp: () => void;
}

/** 이메일/비밀번호 로그인 및 회원가입 폼 (포털 가입 안내 포함). */
export const CredentialsForm: React.FC<CredentialsFormProps> = ({
  isSignUpMode, hasSavedAccounts, email, setEmail, password, setPassword, name, setName, errorMsg, loading, onSubmit, onBackToChooser, onToggleSignUp,
}) => {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  return (
  <div>
              {hasSavedAccounts && (
                <button
                  type="button"
                  onClick={() => {
                    onBackToChooser();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium mb-3 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>저장된 계정 목록으로</span>
                </button>
              )}

              <div id={AUTH_DIALOG_TITLE_ID} className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg mb-1">
                <ShieldCheck className="w-6 h-6" />
                <span>DORO ID {isSignUpMode ? '회원가입' : '직접 로그인'}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
                {isSignUpMode
                  ? '새로운 DORO 통합 계정을 생성합니다.'
                  : '이메일과 비밀번호를 입력하여 로그인하세요. 로그인 후 이 기기에 안전하게 저장됩니다.'}
              </p>

              {errorMsg && (
                <div role="alert" className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3.5">
                {isSignUpMode && (
                  <div>
                    <label htmlFor={nameId} className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이름</label>
                    <div className="relative">
                      <input
                        id={nameId}
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
                  <label htmlFor={emailId} className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">이메일 (DORO ID)</label>
                  <div className="relative">
                    <input
                      id={emailId}
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
                  <label htmlFor={passwordId} className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">비밀번호</label>
                  <div className="relative">
                    <input
                      id={passwordId}
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
                      onToggleSignUp();
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
  );
};
