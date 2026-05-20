/** 短信服务配置（密钥仅从环境变量读取，禁止硬编码） */

export type SmsProvider = 'tencent' | 'mock';

export interface TencentSmsConfig {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  templateId: string;
  region: string;
  /** 模板第二参数，如「5分钟内有效」中的 5 */
  templateMinutes?: string;
}

function trimEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function getTencentSmsConfig(): TencentSmsConfig | null {
  const secretId = trimEnv('TENCENT_SECRET_ID');
  const secretKey = trimEnv('TENCENT_SECRET_KEY');
  const sdkAppId = trimEnv('TENCENT_SMS_SDK_APP_ID');
  const signName = trimEnv('TENCENT_SMS_SIGN_NAME');
  const templateId = trimEnv('TENCENT_SMS_TEMPLATE_ID');

  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
    return null;
  }

  const templateMinutes = trimEnv('TENCENT_SMS_TEMPLATE_MINUTES');

  return {
    secretId,
    secretKey,
    sdkAppId,
    signName,
    templateId,
    region: trimEnv('TENCENT_SMS_REGION') || 'ap-guangzhou',
    templateMinutes: templateMinutes || undefined,
  };
}

export function isTencentSmsConfigured(): boolean {
  return getTencentSmsConfig() !== null;
}

/** 解析短信发送渠道：auto 优先腾讯云，未配置则 mock */
export function resolveSmsProvider(): SmsProvider {
  const raw = (process.env.SMS_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'mock') return 'mock';
  if (raw === 'tencent') {
    if (!isTencentSmsConfigured()) {
      throw new Error('SMS_PROVIDER=tencent 但未配置完整的腾讯云短信环境变量');
    }
    return 'tencent';
  }
  return isTencentSmsConfigured() ? 'tencent' : 'mock';
}

export function shouldExposeDevCode(): boolean {
  return (
    process.env.NODE_ENV === 'development' || process.env.SMS_DEV_EXPOSE_CODE === 'true'
  );
}
