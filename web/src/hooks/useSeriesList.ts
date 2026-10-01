import { useCallback, useEffect, useState } from 'react';
import { blogApi } from '../api/blogApi';
import type { Series } from '../api/types';
import { getErrorMessage, isCancelled } from '../utils/errors';
import { generateSlug } from '../utils/slug';

export interface SeriesList {
  series: Series[];
  /** 새 시리즈를 만들고 목록 맨 앞에 넣은 뒤 만들어진 시리즈를 돌려준다. 실패하면 메시지와 함께 예외를 던진다. */
  create: (title: string) => Promise<Series>;
}

/** 내 시리즈 목록. 사용자명이 바뀔 때만(프로필 객체가 갱신될 때마다가 아니라) 다시 불러오고, 요청은 취소할 수 있다. */
export function useSeriesList(username: string | undefined, enabled: boolean): SeriesList {
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    if (!enabled || !username) return;
    const controller = new AbortController();
    blogApi
      .getUserSeries(username, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setSeries(res ?? []);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        console.error('Failed to load series', err);
      });
    return () => controller.abort();
  }, [enabled, username]);

  const create = useCallback(async (title: string) => {
    const clean = title.trim();
    try {
      const created = await blogApi.createSeries({ title: clean, slug: generateSlug(clean) });
      setSeries((prev) => [created, ...prev]);
      return created;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, '시리즈 생성에 실패했습니다.'));
    }
  }, []);

  return { series, create };
}
