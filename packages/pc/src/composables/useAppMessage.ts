import { ref } from 'vue';

export type AppMessageType = 'success' | 'error' | 'warning' | 'info';

export interface AppMessageItem {
  id: number;
  type: AppMessageType;
  content: string;
  duration: number;
}

const messages = ref<AppMessageItem[]>([]);
let messageIdSeq = 0;

function removeMessage(id: number) {
  messages.value = messages.value.filter((item) => item.id !== id);
}

function showMessage(type: AppMessageType, content: string, duration = 3000) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const id = ++messageIdSeq;
  messages.value = [...messages.value, { id, type, content: trimmed, duration }];

  if (duration > 0) {
    window.setTimeout(() => {
      removeMessage(id);
    }, duration);
  }
}

/** 全局轻提示（用法类似 Ant Design `message`） */
export const appMessage = {
  success: (content: string, duration?: number) => showMessage('success', content, duration),
  error: (content: string, duration?: number) => showMessage('error', content, duration ?? 4000),
  warning: (content: string, duration?: number) => showMessage('warning', content, duration),
  info: (content: string, duration?: number) => showMessage('info', content, duration),
};

export function useAppMessage() {
  return {
    messages,
    removeMessage,
    ...appMessage,
  };
}
