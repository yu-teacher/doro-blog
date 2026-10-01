import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react';

const HISTORY_LIMIT = 80;
/** 입력이 멈춘 뒤 이 시간이 지나야 되돌리기 기록에 한 단계로 남긴다. */
const HISTORY_DEBOUNCE_MS = 400;
const INDENT = '  ';

interface HistoryEntry {
  content: string;
  cursor: number;
}

interface Selection {
  start: number;
  end: number;
}

interface Options {
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** 이 값이 바뀌면(다른 글을 열면) 되돌리기 기록을 새로 시작한다. */
  resetKey: string | null | undefined;
}

export interface MarkdownEditor {
  handleContentChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleEditorKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  /** 선택 영역을 prefix/suffix 로 감싸거나, 선택이 없으면 defaultText 를 넣어 감싼다. */
  insertFormatting: (prefix: string, suffix?: string, defaultText?: string) => void;
  insertHeading: (level: number) => void;
  insertCodeBlock: () => void;
}

/**
 * 마크다운 텍스트 영역의 편집 동작: 서식 삽입, 단축키(Cmd/Ctrl + Z/Shift+Z/B/I, Tab), 되돌리기/다시 실행.
 * 내용이 바뀐 뒤 커서를 맞추는 일은 setTimeout 이 아니라 렌더 직후(useLayoutEffect)에 처리한다.
 */
export function useMarkdownEditor({ content, setContent, textareaRef, resetKey }: Options): MarkdownEditor {
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<Selection | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // 글을 새로 열거나 처음 내용이 채워질 때 기록의 시작점을 만든다
  useEffect(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, [resetKey]);
  useEffect(() => {
    if (historyRef.current.length === 0 && (content || !resetKey)) {
      historyRef.current = [{ content, cursor: 0 }];
      historyIndexRef.current = 0;
    }
  }, [content, resetKey]);

  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    []
  );

  const pushHistory = useCallback((newContent: string, cursor: number) => {
    if (isUndoRedoRef.current) return;
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history.length > 0 && history[history.length - 1].content === newContent) return;
    history.push({ content: newContent, cursor });
    if (history.length > HISTORY_LIMIT) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  }, []);

  const applySelection = useCallback(
    (selection: Selection) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
    },
    [textareaRef]
  );

  // 내용이 렌더된 직후에 커서를 맞춘다
  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;
    isUndoRedoRef.current = false;
    applySelection(pending);
  }, [content, applySelection]);

  /** 내용을 바꾸고 커서 위치를 예약한다. 내용이 같아 다시 렌더되지 않으면 바로 적용한다. */
  const replaceContent = useCallback(
    (newContent: string, selection: Selection) => {
      if (newContent === contentRef.current) {
        isUndoRedoRef.current = false;
        applySelection(selection);
        return;
      }
      pendingSelectionRef.current = selection;
      setContent(newContent);
    },
    [setContent, applySelection]
  );

  const flushTypingTimer = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const stepHistory = useCallback(
    (direction: -1 | 1) => {
      const nextIndex = historyIndexRef.current + direction;
      if (nextIndex < 0 || nextIndex > historyRef.current.length - 1) return;
      historyIndexRef.current = nextIndex;
      const entry = historyRef.current[nextIndex];
      isUndoRedoRef.current = true;
      replaceContent(entry.content, { start: entry.cursor, end: entry.cursor });
    },
    [replaceContent]
  );

  const handleUndo = useCallback(() => stepHistory(-1), [stepHistory]);
  const handleRedo = useCallback(() => stepHistory(1), [stepHistory]);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(value);
    flushTypingTimer();
    typingTimerRef.current = setTimeout(() => pushHistory(value, cursor), HISTORY_DEBOUNCE_MS);
  };

  const insertFormatting = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    flushTypingTimer();
    pushHistory(contentRef.current, textarea.selectionStart);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);

    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`;
    const newContent = current.substring(0, start) + replacement + current.substring(end);
    const cursorAfter = selected ? start + prefix.length + selected.length : start + prefix.length + defaultText.length;

    pushHistory(newContent, cursorAfter);
    replaceContent(
      newContent,
      selected ? { start: start + prefix.length, end: start + prefix.length + selected.length } : { start: cursorAfter, end: cursorAfter }
    );
  };

  const insertHeading = (level: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    flushTypingTimer();
    pushHistory(contentRef.current, textarea.selectionStart);

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const hashes = '#'.repeat(level) + ' ';

    const lineStart = current.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = current.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? current.length : lineEnd;
    // 이미 제목 표시가 있으면 교체한다
    const cleanLine = current.substring(lineStart, actualLineEnd).replace(/^#{1,6}\s*/, '');

    const newContent = current.substring(0, lineStart) + hashes + cleanLine + current.substring(actualLineEnd);
    const cursor = lineStart + hashes.length + cleanLine.length;

    pushHistory(newContent, cursor);
    replaceContent(newContent, { start: cursor, end: cursor });
  };

  const insertCodeBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selected.includes('\n') || !selected) {
      insertFormatting('```javascript\n', '\n```\n', selected || '// 코드를 입력하세요');
    } else {
      insertFormatting('`', '`', selected);
    }
  };

  const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && !e.shiftKey && key === 'z') {
      e.preventDefault();
      handleUndo();
    } else if ((mod && e.shiftKey && key === 'z') || (!isMac && mod && key === 'y')) {
      e.preventDefault();
      handleRedo();
    } else if (mod && key === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', '굵은 텍스트');
    } else if (mod && key === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', '기울임 텍스트');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      insertFormatting(INDENT, '', '');
    }
  };

  return { handleContentChange, handleEditorKeyDown, handleUndo, handleRedo, insertFormatting, insertHeading, insertCodeBlock };
}
