import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Terminal,
  Zap,
  Activity,
} from 'lucide-react';
import { blogApi } from '../api/blogApi';
import { ApiKey, ApiKeyLog, CreateApiKeyResponse } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../utils/errors';
import { NewKeyAlert } from '../components/developers/NewKeyAlert';
import { ApiKeySection } from '../components/developers/ApiKeySection';
import { CodeDocumentation } from '../components/developers/CodeDocumentation';
import { ApiLogsSection } from '../components/developers/ApiLogsSection';
import { CreateKeyModal } from '../components/developers/CreateKeyModal';

const API_LOGS_PAGE_SIZE = 20;

export const DevelopersPage: React.FC = () => {
  const { isAuthenticated, login } = useAuthStore();

  // API Key State
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expireDays, setExpireDays] = useState<number | null>(30);
  const [issuing, setIssuing] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateApiKeyResponse | null>(null);

  // Logs State
  const [logs, setLogs] = useState<ApiKeyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');

  // Code Snippet Active Tab

  // Fetch Keys
  const fetchKeys = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingKeys(true);
      const data = await blogApi.getMyApiKeys();
      setKeys(data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoadingKeys(false);
    }
  }, [isAuthenticated]);

  // Fetch Logs
  const fetchLogs = useCallback(async (keyId?: string) => {
    if (!isAuthenticated) return;
    try {
      setLoadingLogs(true);
      const pageRes = await blogApi.getApiKeyLogs(keyId || undefined, 0, API_LOGS_PAGE_SIZE);
      setLogs(pageRes.content);
    } catch (err) {
      console.error('Failed to load API logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchKeys();
      fetchLogs();
    }
  }, [isAuthenticated, fetchKeys, fetchLogs]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    try {
      setIssuing(true);
      const res = await blogApi.createApiKey({
        name: keyName.trim(),
        expireDays: expireDays === 0 ? null : expireDays,
      });
      setNewlyCreatedKey(res);
      setShowCreateModal(false);
      setKeyName('');
      fetchKeys();
    } catch (err: unknown) {
      console.error('Failed to create API key:', err);
      const msg = getErrorMessage(err, 'API 키 발급 중 오류가 발생했습니다.');
      alert(msg);
    } finally {
      setIssuing(false);
    }
  };

  const handleRevokeKey = async (id: string, name: string) => {
    if (!window.confirm(`정말 "${name}" API 키를 폐기하시겠습니까?\n폐기된 키로 요청하는 모든 자동화 스크립트는 즉시 차단됩니다.`)) {
      return;
    }

    try {
      await blogApi.revokeApiKey(id);
      fetchKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
      alert('API 키 폐기 중 오류가 발생했습니다.');
    }
  };

  const apiEndpoint = `${window.location.origin}/api/v1/posts`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-8 sm:p-12 text-white shadow-2xl border border-slate-700/50">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4 border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5" />
            Headless API & Developer Platform
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">
            DORO Blog 개발자 센터
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
            개인 API 키를 발급받아 외부 Python 스크립트, GitHub Actions, AI 에이전트(LangChain, AutoGPT)에서
            직접 내 블로그에 글을 자동으로 게시하고 관리하세요.
          </p>

          <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> SHA-256 단방향 해시 암호화
            </span>
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> 실시간 호출 감사 로그(Audit)
            </span>
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Terminal className="w-3.5 h-3.5 text-amber-400" /> cURL / Python / Node / CI-CD 지원
            </span>
          </div>
        </div>

        {/* Decorative Background Element */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {newlyCreatedKey && <NewKeyAlert createdKey={newlyCreatedKey} onDismiss={() => setNewlyCreatedKey(null)} />}

      <ApiKeySection
        isAuthenticated={isAuthenticated}
        login={login}
        keys={keys}
        loadingKeys={loadingKeys}
        onCreate={() => setShowCreateModal(true)}
        onRevoke={handleRevokeKey}
      />

      <CodeDocumentation apiEndpoint={apiEndpoint} />

      <ApiLogsSection
        isAuthenticated={isAuthenticated}
        keys={keys}
        logs={logs}
        loadingLogs={loadingLogs}
        selectedKeyId={selectedKeyId}
        onSelectKey={(keyId) => {
          setSelectedKeyId(keyId);
          fetchLogs(keyId);
        }}
        onRefresh={() => fetchLogs(selectedKeyId)}
      />

      {showCreateModal && (
        <CreateKeyModal
          keyName={keyName}
          setKeyName={setKeyName}
          expireDays={expireDays}
          setExpireDays={setExpireDays}
          issuing={issuing}
          onSubmit={handleCreateKey}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};
