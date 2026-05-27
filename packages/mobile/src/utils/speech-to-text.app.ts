import {
  stopSpeechToText,
  type SpeechToTextHandlers,
  type SpeechToTextSession,
} from './speech-to-text.shared';
import { startRecorderSpeechToText } from './speech-to-text.recorder-upload';
import { mobileT } from '@/i18n/mobileT';

export type { SpeechToTextHandlers, SpeechToTextSession };
export { stopSpeechToText };

type PlusAndroid = {
  requestPermissions: (
    permissions: string[],
    success: (result: { granted?: string[] }) => void,
    fail: (error: unknown) => void,
  ) => void;
};

type PlusRuntime = {
  android?: PlusAndroid;
};

function getPlusRuntime(): PlusRuntime | undefined {
  return (globalThis as { plus?: PlusRuntime }).plus;
}

function promptOpenAppSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: mobileT('speech.micPermissionTitle'),
      content: mobileT('speech.micPermissionContentApp'),
      confirmText: mobileT('common.goSettings'),
      cancelText: mobileT('common.cancel'),
      success: (modalRes) => {
        if (!modalRes.confirm) {
          resolve(false);
          return;
        }
        uni.openAppAuthorizeSetting({
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

function requestAndroidRecordPermission(): Promise<void> {
  return new Promise((resolve, reject) => {
    const plusRuntime = getPlusRuntime();
    const requestPermissions = plusRuntime?.android?.requestPermissions;
    if (!requestPermissions) {
      resolve();
      return;
    }

    requestPermissions(
      ['android.permission.RECORD_AUDIO'],
      (result) => {
        const granted = result.granted ?? [];
        if (granted.includes('android.permission.RECORD_AUDIO')) {
          resolve();
          return;
        }
        reject(new Error(mobileT('speech.micDenied')));
      },
      () => reject(new Error(mobileT('speech.micDenied'))),
    );
  });
}

async function ensureAppRecordPermission(): Promise<void> {
  const platform = uni.getSystemInfoSync().platform;

  if (platform === 'android') {
    try {
      await requestAndroidRecordPermission();
      return;
    } catch {
      const opened = await promptOpenAppSettings();
      if (!opened) {
        throw new Error(mobileT('speech.micDenied'));
      }
      return;
    }
  }

  if (typeof uni.getAppAuthorizeSetting === 'function') {
    const setting = uni.getAppAuthorizeSetting();
    if (setting.microphoneAuthorized === 'denied') {
      const opened = await promptOpenAppSettings();
      if (!opened) {
        throw new Error(mobileT('speech.micDenied'));
      }
    }
  }
}

export function isSpeechToTextSupported(): boolean {
  return true;
}

export async function startSpeechToText(
  handlers: SpeechToTextHandlers,
): Promise<SpeechToTextSession | null> {
  return startRecorderSpeechToText(handlers, ensureAppRecordPermission);
}
