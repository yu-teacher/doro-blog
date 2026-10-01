import React from 'react';
import type { ApiKey, ApiKeyLog } from '../../api/types';
import { formatDateTime } from '../../utils/date';
import { Activity, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';

interface ApiLogsSectionProps {
  isAuthenticated: boolean;
  keys: ApiKey[];
  logs: ApiKeyLog[];
  loadingLogs: boolean;
  selectedKeyId: string;
  onSelectKey: (keyId: string) => void;
  onRefresh: () => void;
}

/** API 키 호출 이력(감사 로그) 표. 키별로 걸러 볼 수 있다. */
export const ApiLogsSection: React.FC<ApiLogsSectionProps> = ({ isAuthenticated, keys, logs, loadingLogs, selectedKeyId, onSelectKey, onRefresh }) => {
  return (
    <>
    {/* Real-Time Request Audit Logs (호출 이력) */}
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            실시간 호출 감사 로그 (Audit Logs)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            발급된 API 키로 인입된 요청과 응답 상태, 레이턴시, 클라이언트 정보를 투명하게 추적합니다.
          </p>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-3">
            {keys.length > 0 && (
              <select
                value={selectedKeyId}
                onChange={(e) => {
                  onSelectKey(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">모든 API 키 로그</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.keyPrefix})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => onRefresh()}
              disabled={loadingLogs}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        )}
      </div>

      {isAuthenticated ? (
        loadingLogs ? (
          <div className="flex justify-center items-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
            호출 로그 확인 중...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
            <Activity className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              아직 기록된 API 호출 로그가 없습니다
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              위의 cURL 또는 Python 코드를 사용하여 첫 포스트를 발행해 보세요!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="px-4 py-3">메서드 & 경로</th>
                  <th className="px-4 py-3">상태 코드</th>
                  <th className="px-4 py-3">소요 시간</th>
                  <th className="px-4 py-3">클라이언트 정보</th>
                  <th className="px-4 py-3">오류 메시지</th>
                  <th className="px-4 py-3 text-right">요청 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {logs.map((log) => {
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.method === 'POST'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                            {log.endpoint}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            isSuccess
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {log.durationMs} ms
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.userAgent}>
                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block">
                          {log.ipAddress}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {log.userAgent}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-rose-500 dark:text-rose-400 text-xs">
                        {log.errorMessage || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
          로그인하면 API 호출 감사 로그를 실시간으로 모니터링할 수 있습니다.
        </div>
      )}
    </section>
    </>
  );
};
