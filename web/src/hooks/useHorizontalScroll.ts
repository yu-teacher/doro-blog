import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, RefObject } from 'react';

const EDGE_TOLERANCE_PX = 5;
const SCROLL_STEP_RATIO = 0.7;

export interface HorizontalScroll {
  ref: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  /** 스크롤 이벤트에서 호출해 양쪽 화살표 표시를 갱신한다. */
  update: () => void;
  scrollBy: (direction: 'left' | 'right') => void;
}

/**
 * 가로로 스크롤되는 줄(태그 바 등)의 좌우 화살표 표시와 이동.
 * resetKey 가 바뀌면 맨 앞으로 돌려놓고 다시 계산한다.
 */
export function useHorizontalScroll(resetKey: DependencyList): HorizontalScroll {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > EDGE_TOLERANCE_PX);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - EDGE_TOLERANCE_PX);
  }, []);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * SCROLL_STEP_RATIO;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  const keyString = JSON.stringify(resetKey);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [keyString, update]);

  return { ref, canScrollLeft, canScrollRight, update, scrollBy };
}
