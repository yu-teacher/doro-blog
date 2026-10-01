import React from 'react';
import type { SavedAccount } from '../../store/authStore';
import { ChevronRight, ShieldCheck, Sparkles, Trash2, UserPlus } from 'lucide-react';

interface AccountChooserProps {
  savedAccounts: SavedAccount[];
  errorMsg: string;
  onSelectAccount: (account: SavedAccount) => void;
  onRemoveAccount: (e: React.MouseEvent, email: string) => void;
  onUseOtherAccount: () => void;
}

/** 이 기기에 저장된 DORO 계정을 고르는 Google 스타일 계정 선택 화면. */
export const AccountChooser: React.FC<AccountChooserProps> = ({ savedAccounts, errorMsg, onSelectAccount, onRemoveAccount, onUseOtherAccount }) => (
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
                    onClick={() => onSelectAccount(acc)}
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
                        onClick={(e) => onRemoveAccount(e, acc.email)}
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
                    onUseOtherAccount();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>다른 계정으로 로그인 (아이디/비밀번호)</span>
                </button>
              </div>
            </div>
);
