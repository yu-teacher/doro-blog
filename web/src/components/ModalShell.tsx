import React, { useEffect, useRef } from 'react';

interface ModalShellProps {
  onClose: () => void;
  /** 모달 제목 요소의 id. 스크린리더가 대화상자 이름으로 읽는다. */
  labelledBy?: string;
  /** 보이는 제목 요소가 없을 때 쓰는 대화상자 이름. */
  ariaLabel?: string;
  /** false 면 바깥 영역을 눌러도 닫히지 않는다 (입력 중 실수로 닫히는 것을 막는 모달용). */
  closeOnOverlayClick?: boolean;
  overlayClassName: string;
  panelClassName: string;
  children: React.ReactNode;
}

const FIELD_SELECTOR = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
const BUTTON_SELECTOR = 'button:not([disabled]), a[href]';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Tab 으로 대화상자 밖으로 포커스가 새지 않게, 다음에 포커스를 줄 요소를 정한다.
 * 정할 필요가 없으면(대화상자 안에서 평소처럼 이동하면 되면) null 을 돌려준다.
 */
export function nextFocusTarget(focusables: HTMLElement[], active: Element | null, shift: boolean): HTMLElement | null {
  if (focusables.length === 0) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const index = active instanceof HTMLElement ? focusables.indexOf(active) : -1;
  if (index === -1) return shift ? last : first; // 포커스가 대화상자 밖(또는 패널 자체)에 있으면 안으로 끌어온다
  if (shift && active === first) return last;
  if (!shift && active === last) return first;
  return null;
}

/** 열릴 때 첫 입력칸(없으면 첫 버튼)으로 포커스를 옮기고, 닫히면 원래 포커스 위치로 돌려준다. Esc 로 닫고, Tab 은 대화상자 안에서만 순환한다. */
export function useDialogBehavior(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? panel?.querySelector<HTMLElement>(BUTTON_SELECTOR) ?? panel;
    target?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) {
          e.preventDefault(); // 포커스할 곳이 없으면 패널에 머문다
          return;
        }
        const target = nextFocusTarget(focusables, document.activeElement, e.shiftKey);
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return panelRef;
}

/** 오버레이 + 접근성 속성을 갖춘 대화상자 패널. 마운트 시점이 곧 열림이므로 열린 상태에서만 렌더해야 한다. */
export const ModalShell: React.FC<ModalShellProps> = ({ onClose, labelledBy, ariaLabel, closeOnOverlayClick = true, overlayClassName, panelClassName, children }) => {
  const panelRef = useDialogBehavior(onClose);
  return (
    <div onClick={closeOnOverlayClick ? onClose : undefined} className={overlayClassName}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`${panelClassName} focus:outline-none`}
      >
        {children}
      </div>
    </div>
  );
};
