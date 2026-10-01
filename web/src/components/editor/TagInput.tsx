import React, { useState } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** 입력창에서 Enter/쉼표로 태그를 추가하고, 비어 있을 때 Backspace 로 마지막 태그를 지운다. 태그를 누르면 삭제된다. */
export function addTag(tags: string[], raw: string): string[] {
  const value = raw.trim().replace(/^#/, '');
  return value && !tags.includes(value) ? [...tags, value] : tags;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 입력 중에는 Enter 가 두 번 들어오므로 무시한다
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      onChange(addTag(tags, input));
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
      {tags.map((t) => (
        <span
          key={t}
          onClick={() => onChange(tags.filter((x) => x !== t))}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-full text-xs font-semibold cursor-pointer transition-colors"
          title="클릭하여 태그 삭제"
        >
          #{t} ✕
        </span>
      ))}
      <input
        type="text"
        placeholder="태그를 입력하세요 (Enter 또는 쉼표)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none flex-1 min-w-[200px] bg-transparent"
      />
    </div>
  );
};
