import React from 'react';
import { MarkdownViewer } from '../MarkdownViewer';

interface EditorPreviewProps {
  title: string;
  tags: string[];
  content: string;
}

/** 작성 중인 글의 실시간 미리보기 (제목, 태그, 마크다운 본문). */
export const EditorPreview: React.FC<EditorPreviewProps> = ({ title, tags, content }) => (
  <>
    {/* Right Side: Live Markdown Preview */}
    <div className="hidden lg:block w-1/2 p-10 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-6 break-words">
          {title || <span className="text-slate-300 dark:text-slate-700">제목 미리보기</span>}
        </h1>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-medium">
                #{t}
              </span>
            ))}
          </div>
        )}
        <MarkdownViewer content={content || '*작성 중인 내용이 여기에 실시간으로 표시됩니다.*'} />
      </div>
    </div>
  </>
);
