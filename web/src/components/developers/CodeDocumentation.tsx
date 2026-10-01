import React, { useState } from 'react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { buildCodeSnippets, type CodeTab } from './codeSnippets';
import { Check, Code, Copy, Terminal } from 'lucide-react';

interface CodeDocumentationProps {
  /** 예제 코드에 들어갈 posts API 주소. */
  apiEndpoint: string;
}

/** API 연동 가이드: 언어별 예제 코드(복사 가능)와 엔드포인트 레퍼런스. */
export const CodeDocumentation: React.FC<CodeDocumentationProps> = ({ apiEndpoint }) => {
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('curl');
  const { copied, copy } = useCopyToClipboard();
  const codeSnippets = buildCodeSnippets(apiEndpoint);

  return (
    <>
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
            onClick={() => copy(codeSnippets[activeCodeTab])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사됨!' : '코드 복사'}
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
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          API 키는 글·시리즈·태그·이미지 업로드 API 에만 사용할 수 있습니다. 키 발급/폐기와 계정 설정은 로그인 후 이용해 주세요.
        </p>

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
    </>
  );
};
