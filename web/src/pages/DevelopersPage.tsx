import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Shield,
  Code,
  Terminal,
  RefreshCw,
  Loader2,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { blogApi } from '../api/blogApi';
import { ApiKey, ApiKeyLog, CreateApiKeyResponse } from '../api/types';
import { useAuthStore } from '../store/authStore';
import { getErrorMessage } from '../utils/errors';
import { formatDate, formatDateTime } from '../utils/date';

const API_LOGS_PAGE_SIZE = 20;

export const DevelopersPage: React.FC = () => {
  const { isAuthenticated, openLoginModal } = useAuthStore();

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
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'python' | 'node' | 'github'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopy = (text: string, isKey = false) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    }
  };

  const apiEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/v1/posts` : 'https://blog.doro.local/api/v1/posts';

  // Code Snippets
  const codeSnippets = {
    curl: `curl -X POST ${apiEndpoint} \\
  -H "X-API-Key: doro_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "DORO 자동화 포스트 제목",
    "slug": "automated-post-slug",
    "content": "### DORO Blog API 게시물\\n\\n이 글은 API 키를 통해 자동 게시되었습니다.",
    "summary": "헤드리스 API 키를 사용한 자동 발행 포스트",
    "status": "PUBLISHED",
    "tags": ["Automation", "API", "Doro"]
  }'`,

    python: `import requests

API_KEY = "doro_live_your_api_key_here"
API_URL = "${apiEndpoint}"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

payload = {
    "title": "Python 스크립트로 자동 작성된 포스트",
    "slug": "python-automated-post",
    "content": "## 데이터 리포트\\n\\nPython 스크립트가 매일 정기적으로 요약된 데이터를 게시합니다.",
    "summary": "Python 자동화 스크립트 게시물",
    "status": "PUBLISHED",
    "tags": ["Python", "Automation", "Bot"]
}

response = requests.post(API_URL, json=payload, headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())`,

    node: `// Node.js (v18+ native fetch or Axios)
const API_KEY = "doro_live_your_api_key_here";
const API_URL = "${apiEndpoint}";

async function publishPost() {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Node.js CI 파이프라인 자동 게시",
      slug: "nodejs-ci-automated-post",
      content: "## 배포 완료 공지\\n\\n신규 빌드가 성공적으로 배포되어 블로그에 자동 공지합니다.",
      summary: "Node.js 배포 파이프라인 자동 공지글",
      status: "PUBLISHED",
      tags: ["NodeJS", "CI/CD", "Automation"],
    }),
  });

  const result = await response.json();
  console.log("Result:", result);
}

publishPost();`,

    github: `name: Publish Release Notes to DORO Blog

on:
  release:
    types: [published]

jobs:
  publish-post:
    runs-on: ubuntu-latest
    steps:
      - name: Send Post to DORO Blog
        run: |
          curl -X POST ${apiEndpoint} \\
            -H "X-API-Key: \${{ secrets.DORO_BLOG_API_KEY }} \\
            -H "Content-Type: application/json" \\
            -d '{
              "title": "새 버전 \${{ github.event.release.tag_name }} 출시 노트",
              "slug": "release-\${{ github.event.release.tag_name }}",
              "content": "\${{ github.event.release.body }}",
              "summary": "새 버전 \${{ github.event.release.tag_name }}가 배포되었습니다.",
              "status": "PUBLISHED",
              "tags": ["Release", "Changelog"]
            }'`,
  };

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

      {/* Newly Issued Key Modal Alert */}
      {newlyCreatedKey && (
        <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50 dark:bg-emerald-950/40 p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
              <Key className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-200">
                  새 API 키가 성공적으로 발급되었습니다!
                </h3>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white text-sm font-semibold"
                >
                  닫기
                </button>
              </div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300/90 mb-4">
                이 키는 사용자의 보안을 위해 <span className="font-bold underline">지금 단 한 번만 표시</span>되며,
                서버에는 SHA-256 해시로만 안전하게 보관됩니다. 지금 복사하여 환경 변수나 안전한 시크릿에 저장하세요.
              </p>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3">
                <code className="flex-1 font-mono text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 select-all break-all">
                  {newlyCreatedKey.apiKey}
                </code>
                <button
                  onClick={() => handleCopy(newlyCreatedKey.apiKey, true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex-shrink-0"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? '복사됨!' : '키 복사'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />새 API 키 발급
            </button>
          ) : (
            <button
              onClick={openLoginModal}
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
                onClick={() => setShowCreateModal(true)}
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
                            onClick={() => handleRevokeKey(k.id, k.name)}
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
              onClick={openLoginModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              DORO 계정으로 로그인하기
            </button>
          </div>
        )}
      </section>

      {/* Interactive Code Documentation & Integration */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
            <Code className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            빠른 시작 가이드 & 연동 예제
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            원하는 언어나 도구를 선택하여 손쉽게 자동 포스팅을 시작하세요.
          </p>
        </div>

        {/* Code Tabs Container */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-950/70">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCodeTab('curl')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCodeTab === 'curl'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveCodeTab('python')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCodeTab === 'python'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Python (requests)
              </button>
              <button
                onClick={() => setActiveCodeTab('node')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCodeTab === 'node'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Node.js (Fetch)
              </button>
              <button
                onClick={() => setActiveCodeTab('github')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCodeTab === 'github'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                GitHub Actions CI/CD
              </button>
            </div>

            <button
              onClick={() => handleCopy(codeSnippets[activeCodeTab])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet ? '복사됨!' : '코드 복사'}
            </button>
          </div>

          <pre className="p-5 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto text-emerald-300/90 bg-slate-950">
            <code>{codeSnippets[activeCodeTab]}</code>
          </pre>
        </div>

        {/* API Reference Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              API 파라미터 규격 (POST /api/v1/posts)
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md">
              인증: X-API-Key 또는 Authorization: Bearer
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">필드명</th>
                  <th className="px-4 py-2.5">타입</th>
                  <th className="px-4 py-2.5">필수 여부</th>
                  <th className="px-4 py-2.5">설명 및 기본값</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">title</td>
                  <td className="px-4 py-3 text-slate-500">String</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">필수 (Required)</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">포스트 제목 (최대 255자)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">content</td>
                  <td className="px-4 py-3 text-slate-500">String</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">필수 (Required)</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">마크다운(Markdown) 포맷의 본문 내용</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">slug</td>
                  <td className="px-4 py-3 text-slate-500">String</td>
                  <td className="px-4 py-3 text-slate-400">선택</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    URL 고유 식별자 (미입력 시 title 기반 자동 영문/한글 슬러그 생성)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">summary</td>
                  <td className="px-4 py-3 text-slate-500">String</td>
                  <td className="px-4 py-3 text-slate-400">선택</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    피드 및 검색 카드에 노출될 포스트 요약 문구
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">thumbnailUrl</td>
                  <td className="px-4 py-3 text-slate-500">String</td>
                  <td className="px-4 py-3 text-slate-400">선택</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">대표 썸네일 이미지 URL 링크</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">status</td>
                  <td className="px-4 py-3 text-slate-500">Enum</td>
                  <td className="px-4 py-3 text-slate-400">선택 (기본: PUBLISHED)</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <code>PUBLISHED</code>, <code>DRAFT</code> (임시저장), <code>PRIVATE</code> (비공개)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">tags</td>
                  <td className="px-4 py-3 text-slate-500">Array&lt;String&gt;</td>
                  <td className="px-4 py-3 text-slate-400">선택</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    태그 문자열 배열 (예: <code>["AI", "Automation", "Python"]</code>)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">seriesId</td>
                  <td className="px-4 py-3 text-slate-500">UUID</td>
                  <td className="px-4 py-3 text-slate-400">선택</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">기존에 작성된 시리즈에 연재할 경우 시리즈 UUID</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
                    setSelectedKeyId(e.target.value);
                    fetchLogs(e.target.value);
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
                onClick={() => fetchLogs(selectedKeyId)}
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

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />새 API 키 발급
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              자동 포스팅에 사용할 키 이름을 지정하고 만료 기간을 선택하세요.
            </p>

            <form onSubmit={handleCreateKey} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  키 이름 (용도 구분용)
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="예: GitHub Actions 배포, Python 일일 봇"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  만료 기간
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { label: '30일', value: 30 },
                    { label: '90일', value: 90 },
                    { label: '1년', value: 365 },
                    { label: '무기한', value: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setExpireDays(opt.value)}
                      className={`py-2 rounded-xl font-medium border transition-all ${
                        expireDays === opt.value
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={issuing || !keyName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
                >
                  {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  발급하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
