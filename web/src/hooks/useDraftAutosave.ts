import { useCallback, useEffect, useRef, useState } from 'react';

export interface DraftSnapshot {
  title: string;
  content: string;
  tags: string[];
  summary: string;
  thumbnailUrl: string;
  slug: string;
  seriesId: string;
}

/** 저장을 수행하는 함수. postId 가 없으면 새로 만들고, 있으면 수정한 뒤 글 id 를 돌려준다. */
export type SaveDraft = (snapshot: DraftSnapshot, postId: string | null) => Promise<{ id: string }>;

interface Options {
  snapshot: DraftSnapshot;
  /** 현재 편집 중인 서버 글 id (없으면 첫 저장 때 새로 만들어진다). */
  postId: string | null;
  save: SaveDraft;
  /** 첫 저장으로 새 글이 만들어졌을 때 호출된다. */
  onCreated: (id: string) => void;
  /** true 이면 저장하지 않는다 (서버에서 본문을 불러오는 중 등, 덮어쓸 위험이 있을 때). */
  paused?: boolean;
  delayMs: number;
}

export interface DraftAutosave {
  /** 서버에 저장 중. */
  saving: boolean;
  lastSavedAt: Date | null;
  /** 마지막 저장 시도의 오류. 성공하면 null. */
  error: unknown;
  /**
   * 자동 저장을 멈추고, 진행 중인 저장이 있으면 끝날 때까지 기다린다.
   * 출간/수동 저장 직전에 호출해 자동 저장(DRAFT)이 뒤늦게 도착해 상태를 되돌리거나 글이 중복 생성되는 것을 막는다.
   */
  suspend: () => Promise<void>;
  /** suspend 후 작업이 실패해 계속 편집할 때 자동 저장을 다시 켠다. */
  resume: () => void;
}

const isBlank = (s: DraftSnapshot) => !s.title.trim() && !s.content.trim();

/**
 * 편집 내용을 입력이 멈춘 뒤 delayMs 후 서버 임시글로 저장한다.
 * - 저장 중에 내용이 더 바뀌면 끝난 직후 최신 내용으로 한 번 더 저장한다 (바뀐 내용이 저장되지 않고 사라지지 않게).
 * - 동시에 두 요청이 나가지 않으므로 첫 저장에서 글이 중복 생성되지 않는다.
 */
export function useDraftAutosave({ snapshot, postId, save, onCreated, paused = false, delayMs }: Options): DraftAutosave {
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<unknown>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const saveRef = useRef(save);
  saveRef.current = save;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const idRef = useRef<string | null>(postId);
  /** 편집 대상 글이 바뀔 때마다 올라간다. 저장이 끝났을 때 그사이 글이 바뀌었는지 가린다. */
  const generationRef = useRef(0);
  const lastSavedKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const suspendedRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // 부모가 편집 대상 글을 바꾼 경우(임시글 선택/삭제)에는 새 글 기준으로 다시 시작한다.
  useEffect(() => {
    if (postId !== idRef.current) {
      idRef.current = postId;
      lastSavedKeyRef.current = null;
      generationRef.current += 1;
    }
  }, [postId]);

  const flush = useCallback((): void => {
    if (suspendedRef.current || pausedRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const snap = snapshotRef.current;
    if (isBlank(snap)) return;
    const key = JSON.stringify(snap);
    if (key === lastSavedKeyRef.current) return;

    setSaving(true);
    const generation = generationRef.current;
    const run = (async () => {
      try {
        const wasNew = idRef.current === null;
        const { id } = await saveRef.current(snap, idRef.current);
        // 저장하는 동안 사용자가 다른 글을 골랐다면 이 결과는 이전 글의 것이다. 지금 글의 id·저장 기록을 덮어쓰면
        // 이후 자동 저장이 지금 글의 내용을 이전 글에 저장한다.
        if (generation !== generationRef.current) return;
        idRef.current = id;
        lastSavedKeyRef.current = key;
        setError(null);
        setLastSavedAt(new Date());
        if (wasNew) onCreatedRef.current(id);
      } catch (e) {
        setError(e);
      } finally {
        inFlightRef.current = null;
        setSaving(false);
        if (queuedRef.current) {
          queuedRef.current = false;
          flush();
        }
      }
    })();
    inFlightRef.current = run;
  }, []);

  const key = JSON.stringify(snapshot);
  useEffect(() => {
    if (paused || isBlank(snapshotRef.current)) return;
    const timer = setTimeout(flush, delayMs);
    return () => clearTimeout(timer);
  }, [key, paused, delayMs, flush]);

  const suspend = useCallback(async () => {
    suspendedRef.current = true;
    queuedRef.current = false;
    await inFlightRef.current;
  }, []);

  const resume = useCallback(() => {
    suspendedRef.current = false;
    flush(); // 멈춰 있는 동안 바뀐 내용이 있으면 바로 저장한다
  }, [flush]);

  return { saving, lastSavedAt, error, suspend, resume };
}
