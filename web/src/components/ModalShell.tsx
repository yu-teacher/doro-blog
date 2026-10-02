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

/** 열릴 때 첫 입력칸(없으면 첫 버튼)으로 포커스를 옮기고, 닫히면 원래 포커스 위치로 돌려준다. Esc 로 닫는다. */
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
