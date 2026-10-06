import React from 'react';
import type { ApiKey } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/date';
import { CheckCircle2, Key, Loader2, Plus, Trash2 } from 'lucide-react';

interface ApiKeySectionProps {
  isAuthenticated: boolean;
  login: () => void;
  keys: ApiKey[];
  loadingKeys: boolean;
  onCreate: () => void;
  onRevoke: (id: string, name: string) => void;
}

/** API 키 목록과 발급/폐기 버튼. */
export const ApiKeySection: React.FC<ApiKeySectionProps> = ({ isAuthenticated, login, keys, loadingKeys, onCreate, onRevoke }) => {
  return (
    <>
    {/* API Key Management Section */}
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
            <Key className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            내 API 키 관리
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            자동 포스팅 및 외부 연동에 사용되는 발급된 키 목록을 확인하고 관리합니다.
          </p>
        </div>

        {isAuthenticated ? (
          <button
            onClick={() => onCreate()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />새 API 키 발급
          </button>
        ) : (
          <button
            onClick={login}
            className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 font-semibold transition-colors"
          >
            로그인하고 API 키 발급받기 →
          </button>
        )}
      </div>

      {/* Keys Table / Card */}
      {isAuthenticated ? (
        loadingKeys ? (
          <div className="flex justify-center items-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2 text-emerald-500" />
            API 키 목록 불러오는 중...
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
            <Key className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              발급된 API 키가 없습니다
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">
              새 API 키를 생성하여 스크립트나 외부 연동 도구에서 글을 작성해 보세요.
            </p>
            <button
              onClick={() => onCreate()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />첫 API 키 발급하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">키 이름</th>
                  <th className="px-5 py-3.5">키 프리픽스</th>
                  <th className="px-5 py-3.5">상태</th>
                  <th className="px-5 py-3.5">마지막 사용</th>
                  <th className="px-5 py-3.5">만료일</th>
                  <th className="px-5 py-3.5 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                      {k.name}
                    </td>
                    <td className="px-5 py-4">
                      <code className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {k.keyPrefix}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      {k.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                          만료됨
                        </span>
                      ) : k.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> 활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                          폐기됨
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(k.lastUsedAt, '사용 이력 없음')}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(k.expiresAt, 'date', '무기한')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {k.isActive && !k.isExpired && (
                        <button
                          onClick={() => onRevoke(k.id, k.name)}
                          className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-medium p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="API 키 폐기"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 폐기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <Key className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-60" />
          <p className="text-slate-700 dark:text-slate-300 font-semibold mb-1">
            로그인 후 나만의 개인 API 키를 발급받고 관리할 수 있습니다.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            발급된 키는 즉시 cURL, Python 스크립트, GitHub Actions 등에서 사용 가능합니다.
          </p>
          <button
            onClick={login}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            DORO 계정으로 로그인하기
          </button>
        </div>
      )}
    </section>
    </>
  );
};
