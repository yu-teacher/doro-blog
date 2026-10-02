import React from 'react';
import { Bold, Code, Image as ImageIcon, Italic, Link2, Loader2, Minus, Quote, Redo2, Strikethrough, Undo2 } from 'lucide-react';

interface MarkdownToolbarProps {
  insertHeading: (level: number) => void;
  insertFormatting: (prefix: string, suffix?: string, defaultText?: string) => void;
  insertCodeBlock: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** 이미지 파일 선택 창을 연다. */
  onPickImage: () => void;
  uploadingEditorImage: boolean;
}

/** 마크다운 서식 버튼 줄: 제목, 강조, 인용/링크/코드/구분선, 이미지 첨부, 실행 취소/다시 실행. */
export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  insertHeading,
  insertFormatting,
  insertCodeBlock,
  onUndo,
  onRedo,
  onPickImage,
  uploadingEditorImage,
}) => (
  <>
    {/* Markdown Formatting Toolbar */}
    <div className="flex flex-wrap items-center justify-between gap-y-2 py-2 px-1 mb-2 border-b border-slate-100 dark:border-slate-800/80 select-none">
      <div className="flex items-center flex-wrap gap-0.5 sm:gap-1 text-slate-600 dark:text-slate-300">
        {/* Headings H1 ~ H4 */}
        <button
          type="button"
          onClick={() => insertHeading(1)}
          className="px-2 py-1 rounded-md text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="대제목 (H1)"
          aria-label="대제목 (H1)"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => insertHeading(2)}
          className="px-2 py-1 rounded-md text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="중제목 (H2)"
          aria-label="중제목 (H2)"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => insertHeading(3)}
          className="px-2 py-1 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="소제목 (H3)"
          aria-label="소제목 (H3)"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => insertHeading(4)}
          className="px-2 py-1 rounded-md text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="세부제목 (H4)"
          aria-label="세부제목 (H4)"
        >
          H4
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Text Styles: Bold, Italic, Strikethrough */}
        <button
          type="button"
          onClick={() => insertFormatting('**', '**', '굵은 텍스트')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="굵게 (Bold)"
          aria-label="굵게 (Bold)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('*', '*', '기울임 텍스트')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="기울임 (Italic)"
          aria-label="기울임 (Italic)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('~~', '~~', '취소선 텍스트')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="취소선 (Strikethrough)"
          aria-label="취소선 (Strikethrough)"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Blocks & Extras: Quote, Link, Code, Divider */}
        <button
          type="button"
          onClick={() => insertFormatting('> ', '', '인용구를 입력하세요')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="인용구 (Quote)"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('[', '](https://)', '링크 텍스트')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="링크 삽입"
          aria-label="링크 삽입"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={insertCodeBlock}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="코드 블록"
          aria-label="코드 블록"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('\n\n---\n\n', '', '')}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="구분선"
          aria-label="구분선"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Image Upload Button */}
        <button
          type="button"
          onClick={() => onPickImage()}
          disabled={uploadingEditorImage}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-xs font-medium"
          title="이미지 파일 첨부"
          aria-label="이미지 파일 첨부"
        >
          {uploadingEditorImage ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span>이미지</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Undo / Redo Buttons */}
        <button
          type="button"
          onClick={onUndo}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="실행 취소 (Cmd+Z / Ctrl+Z)"
          aria-label="실행 취소 (Cmd+Z / Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="다시 실행 (Cmd+Shift+Z / Ctrl+Y)"
          aria-label="다시 실행 (Cmd+Shift+Z / Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {uploadingEditorImage && (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" /> MinIO 업로드 중...
        </span>
      )}
    </div>
  </>
);
