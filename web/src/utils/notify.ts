import { useToastStore } from '../store/toastStore';

/** 사용자에게 알리는 한 줄 메시지. 브라우저 alert 처럼 화면을 멈추지 않고, 라우트가 바뀌어도 남는다. */
export const notify = {
  error: (message: string): void => useToastStore.getState().show('error', message),
  info: (message: string): void => useToastStore.getState().show('info', message),
};
