import { ref } from 'vue';
import { i18n } from '@/i18n';

export interface AppDialogOptions {
  title?: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除等）确认按钮样式 */
  danger?: boolean;
}

interface AppDialogState extends AppDialogOptions {
  visible: boolean;
  resolve: (confirmed: boolean) => void;
}

const dialogState = ref<AppDialogState | null>(null);

function translate(key: string): string {
  return i18n.global.t(key) as string;
}

function settleDialog(confirmed: boolean) {
  const current = dialogState.value;
  if (!current) return;
  dialogState.value = null;
  current.resolve(confirmed);
}

/** 全局确认框（用法类似 Ant Design `Modal.confirm`） */
export const appDialog = {
  confirm(options: AppDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      dialogState.value = {
        title: options.title,
        content: options.content,
        confirmText: options.confirmText ?? translate('common.confirm'),
        cancelText: options.cancelText ?? translate('common.cancel'),
        danger: options.danger ?? false,
        visible: true,
        resolve,
      };
    });
  },
};

export function useAppDialog() {
  function confirmAction() {
    settleDialog(true);
  }

  function cancelAction() {
    settleDialog(false);
  }

  return {
    dialogState,
    confirmAction,
    cancelAction,
  };
}
