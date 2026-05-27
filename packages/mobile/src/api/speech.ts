import { getApiBaseUrl } from '@/utils/api-base';
import { getStoredToken } from '@/utils/auth-storage';
import { mobileT } from '@/i18n/mobileT';

export function transcribeAudioFile(filePath: string): Promise<string> {
  const token = getStoredToken();

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBaseUrl()}/speech/transcribe`,
      filePath,
      name: 'audio',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data) as {
            code?: number;
            message?: string;
            data?: { text?: string };
          };
          if (body.code === 0 && body.data?.text) {
            resolve(body.data.text);
            return;
          }
          reject(new Error(body.message || mobileT('speech.transcribeFailed')));
        } catch {
          reject(new Error(mobileT('common.invalidResponse')));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || mobileT('common.uploadFailed')));
      },
    });
  });
}
