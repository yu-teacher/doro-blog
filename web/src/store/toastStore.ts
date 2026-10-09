import { create } from 'zustand';

export type ToastKind = 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  show: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

/** 화면에 한꺼번에 쌓아 두는 알림 수. 넘치면 가장 오래된 것부터 걷어 낸다. */
export const MAX_VISIBLE_TOASTS = 4;

let nextId = 1;

/** 브라우저 alert 대신 쓰는 알림 목록. 화면 표시는 ToastHost 가 맡는다. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (kind, message) =>
    set((state) => {
      // 같은 메시지가 이미 떠 있으면 하나만 보여 준다(연속 실패가 화면을 덮지 않게)
      if (state.toasts.some((t) => t.kind === kind && t.message === message)) {
        return state;
      }
      const toast: Toast = { id: nextId++, kind, message };
      return { toasts: [...state.toasts, toast].slice(-MAX_VISIBLE_TOASTS) };
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
