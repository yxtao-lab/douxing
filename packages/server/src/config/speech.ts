/** 语音识别配置（密钥仅从环境变量读取） */

export type SpeechProvider = 'tencent' | 'mock';

export interface TencentAsrConfig {
  secretId: string;
  secretKey: string;
  region: string;
}

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function getTencentAsrConfig(): TencentAsrConfig | null {
  const secretId = trimEnv('TENCENT_SECRET_ID');
  const secretKey = trimEnv('TENCENT_SECRET_KEY');
  if (!secretId || !secretKey) {
    return null;
  }

  return {
    secretId,
    secretKey,
    region: trimEnv('TENCENT_ASR_REGION') || trimEnv('TENCENT_SMS_REGION') || 'ap-guangzhou',
  };
}

export function isTencentAsrConfigured(): boolean {
  return getTencentAsrConfig() !== null;
}

/** 解析语音识别渠道：auto 优先腾讯云，未配置则 mock */
export function resolveSpeechProvider(): SpeechProvider {
  const raw = (process.env.SPEECH_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'mock') return 'mock';
  if (raw === 'tencent') {
    if (!isTencentAsrConfigured()) {
      throw new Error('SPEECH_PROVIDER=tencent 但未配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
    }
    return 'tencent';
  }
  return isTencentAsrConfigured() ? 'tencent' : 'mock';
}
