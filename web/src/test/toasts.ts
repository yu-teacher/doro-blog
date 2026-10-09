import { useToastStore } from '../store/toastStore';

/** 테스트에서 지금 떠 있는 알림 메시지들 */
export const toastMessages = (): string[] => useToastStore.getState().toasts.map((t) => t.message);

/** 테스트 사이에 알림을 비운다 */
export const clearToasts = (): void => useToastStore.setState({ toasts: [] });
