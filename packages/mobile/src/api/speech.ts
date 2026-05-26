import { getApiBaseUrl } from '@/utils/api-base';
import { getStoredToken } from '@/utils/auth-storage';

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
          reject(new Error(body.message || '语音识别失败'));
        } catch {
          reject(new Error('响应格式错误'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '上传失败'));
      },
    });
  });
}
