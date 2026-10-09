import { useEffect, useRef, useState } from 'react';

export interface LocalDraft {
  title: string;
  content: string;
  tags: string[];
  summary: string;
  thumbnailUrl: string;
}

interface Options {
  /** 사용자별 localStorage 키. */
  draftKey: string;
  /** 새 글 작성 화면일 때만 true. 이전에 쓰던 백업이 있으면 복원 안내를 띄운다. */
  offerRestore: boolean;
  snapshot: LocalDraft;
  delayMs: number;
}

export interface LocalDraftControls {
  /** 복원할 백업이 있다는 안내를 보여줄지. */
  hasNotice: boolean;
  /** 백업을 읽어 돌려주고 안내를 닫는다 (읽을 수 없으면 null). */
  restore: () => Partial<LocalDraft> | null;
  /** 백업을 지우고 안내를 닫는다. */
  discard: () => void;
}

const isBlank = (d: Pick<LocalDraft, 'title' | 'content'>) => !d.title.trim() && !d.content.trim();

/**
 * 로컬 백업을 지운다. 저장소 접근이 막힌 환경에서 예외가 나도 호출한 쪽의 흐름(출간·저장 성공 처리)을 막지 않는다.
 * 지우는 일은 부가 정리라서, 여기서 던지면 이미 성공한 출간이 실패로 처리되고 자동 저장이 다시 켜져 글을 임시저장으로 되돌릴 수 있다.
 */
export function removeLocalDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err: unknown) {
    console.warn('Local draft backup could not be removed', err);
  }
}

/**
 * 로컬 백업이 쓰는 저장 키. 새 글 작성의 백업과 기존 글 수정의 백업이 같은 키를 쓰면 서로 덮어써서,
 * 글을 고치다 나오면 새 글 복원 안내에 고치던 글의 내용이 나타난다. 수정 중인 글은 글마다 따로 둔다.
 */
export function localDraftStorageKey(baseKey: string, editingPostId?: string): string {
  return editingPostId ? `${baseKey}:edit:${editingPostId}` : baseKey;
}

/** 저장된 JSON 에서 형식이 맞는 필드만 골라낸다 (손상되었거나 예전 형식이어도 화면이 깨지지 않게). */
function parseDraft(raw: string): Partial<LocalDraft> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const draft: Partial<LocalDraft> = {};
  if (typeof record.title === 'string') draft.title = record.title;
  if (typeof record.content === 'string') draft.content = record.content;
  if (typeof record.summary === 'string') draft.summary = record.summary;
  if (typeof record.thumbnailUrl === 'string') draft.thumbnailUrl = record.thumbnailUrl;
  if (Array.isArray(record.tags)) draft.tags = record.tags.filter((t): t is string => typeof t === 'string');
  return draft;
}

/**
 * 작성 중인 글의 로컬 백업. 입력이 delayMs 동안 멈추면 localStorage 에 저장하고,
 * 새 글 화면을 열 때 이전 백업이 있으면 복원 안내를 켠다.
 */
export function useLocalDraft({ draftKey, offerRestore, snapshot, delayMs }: Options): LocalDraftControls {
  const [hasNotice, setHasNotice] = useState(false);
  const hasNoticeRef = useRef(hasNotice);
  hasNoticeRef.current = hasNotice;

  useEffect(() => {
    if (!offerRestore) return;
    try {
      const raw = localStorage.getItem(draftKey);
      const draft = raw ? parseDraft(raw) : null;
      if (draft && ((draft.title ?? '').trim() || (draft.content ?? '').trim())) setHasNotice(true);
    } catch (err: unknown) {
      console.error('Failed to check local draft', err);
    }
  }, [offerRestore, draftKey]);

  // 내용이 바뀌었는지는 문자열 키로 판단하고, 저장할 값은 최신 스냅샷 ref 에서 읽는다 (매 렌더 새 객체이므로)
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const snapshotKey = JSON.stringify(snapshot);
  useEffect(() => {
    if (isBlank(snapshotRef.current)) return;
    // 복원 안내가 떠 있는 동안은 백업을 쓰지 않는다. 사용자가 복원이나 버리기를 고르기 전에 새로 입력한 내용이
    // 이전 백업을 덮어쓰면, 복원을 눌렀을 때 방금 쓴 내용이 돌아오고 원래 백업은 사라진다.
    if (hasNoticeRef.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ ...snapshotRef.current, savedAt: new Date().toISOString() }));
      } catch (err: unknown) {
        console.error('Local auto-save error', err);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [snapshotKey, draftKey, delayMs, hasNotice]);

  const restore = () => {
    setHasNotice(false);
    try {
      const raw = localStorage.getItem(draftKey);
      return raw ? parseDraft(raw) : null;
    } catch (err: unknown) {
      console.error('Failed to restore draft', err);
      return null;
    }
  };

  const discard = () => {
    removeLocalDraft(draftKey);
    setHasNotice(false);
  };

  return { hasNotice, restore, discard };
}
