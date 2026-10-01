import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_RESET_MS = 2_500;

export interface CopyToClipboard {
  /** 방금 복사했는지 (잠시 후 자동으로 false 로 돌아온다). */
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
}

/** 클립보드에 복사하고 "복사됨" 상태를 잠시 보여준다. 언마운트되면 타이머를 정리하고, 권한 거부 등 실패는 로그로 남긴다. */
export function useCopyToClipboard(resetMs: number = DEFAULT_RESET_MS): CopyToClipboard {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err: unknown) {
        console.error('Failed to copy to clipboard', err);
        return false;
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs]
  );

  return { copied, copy };
}
