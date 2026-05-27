import {
  stopSpeechToText,
  type SpeechToTextHandlers,
  type SpeechToTextSession,
} from './speech-to-text.shared';
import { startRecorderSpeechToText } from './speech-to-text.recorder-upload';
import { mobileT } from '@/i18n/mobileT';

export type { SpeechToTextHandlers, SpeechToTextSession };
export { stopSpeechToText };

type AuthSetting = Record<string, boolean | undefined>;

function getAuthSetting(): Promise<AuthSetting> {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (res) => resolve((res.authSetting || {}) as unknown as AuthSetting),
      fail: () => resolve({}),
    });
  });
}

function requestRecordAuthorize(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

function promptOpenRecordSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: mobileT('speech.micPermissionTitle'),
      content: mobileT('speech.micPermissionContentMp'),
      confirmText: mobileT('common.goSettings'),
      cancelText: mobileT('common.cancel'),
      success: (modalRes) => {
        if (!modalRes.confirm) {
          resolve(false);
          return;
        }
        uni.openSetting({
          success: (settingRes) => {
            resolve(settingRes.authSetting['scope.record'] === true);
          },
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

async function ensureWeixinRecordPermission(): Promise<void> {
  const auth = await getAuthSetting();
  if (auth['scope.record'] === true) return;

  if (auth['scope.record'] === false) {
    const opened = await promptOpenRecordSettings();
    if (!opened) {
      throw new Error(mobileT('speech.micDenied'));
    }
    return;
  }

  const authorized = await requestRecordAuthorize();
  if (authorized) return;

  const opened = await promptOpenRecordSettings();
  if (!opened) {
    throw new Error(mobileT('speech.micDenied'));
  }
}

export function isSpeechToTextSupported(): boolean {
  return true;
}

export async function startSpeechToText(
  handlers: SpeechToTextHandlers,
): Promise<SpeechToTextSession | null> {
  return startRecorderSpeechToText(handlers, ensureWeixinRecordPermission);
}
