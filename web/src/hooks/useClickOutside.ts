import { useEffect } from 'react';
import type { RefObject } from 'react';

/** active 인 동안 ref 요소 바깥을 누르면 onOutside 를 호출한다 (드롭다운 닫기용). */
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, active, onOutside]);
}
