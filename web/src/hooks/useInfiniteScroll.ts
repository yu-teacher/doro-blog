import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  onIntersect: () => void;
  enabled?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export function useInfiniteScroll({
  onIntersect,
  enabled = true,
  threshold = 0.1,
  rootMargin = '300px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    if (!enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          callbackRef.current();
        }
      },
      { threshold, rootMargin }
    );

    const current = sentinelRef.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
      observer.disconnect();
    };
  }, [enabled, threshold, rootMargin]);

  return sentinelRef;
}
