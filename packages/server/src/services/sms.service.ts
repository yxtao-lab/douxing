import { ApiError, ApiMessageKey } from '@douxing/shared';
import { resolveSmsProvider, shouldExposeDevCode } from '../config/sms.js';
import { sendTencentSmsCode } from './tencent-sms.provider.js';

/** 中国大陆手机号 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

const CODE_TTL_MS = 5 * 60 * 1000;
const SEND_INTERVAL_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

interface SmsCodeRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const codeStore = new Map<string, SmsCodeRecord>();
const lastSendAt = new Map<string, number>();

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function dispatchSmsCode(phone: string, code: string, provider: ReturnType<typeof resolveSmsProvider>): Promise<void> {
  if (provider === 'tencent') {
    await sendTencentSmsCode(phone, code);
    console.info(`[sms] 腾讯云验证码已发送 phone=${phone}`);
    return;
  }

  console.info(`[sms] mock 验证码 phone=${phone} code=${code}`);
}

/** 发送短信验证码 */
export async function sendSmsCode(phone: string): Promise<{ devCode?: string }> {
  const now = Date.now();
  const prev = lastSendAt.get(phone);
  if (prev && now - prev < SEND_INTERVAL_MS) {
    const remainSec = Math.ceil((SEND_INTERVAL_MS - (now - prev)) / 1000);
    throw new ApiError(ApiMessageKey.SMS_RATE_LIMIT, { seconds: remainSec });
  }

  const code = generateCode();
  codeStore.set(phone, {
    code,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
  });
  lastSendAt.set(phone, now);

  const provider = resolveSmsProvider();
  await dispatchSmsCode(phone, code, provider);

  if (provider === 'mock' && shouldExposeDevCode()) {
    return { devCode: code };
  }
  return {};
}

/** 校验验证码，成功后清除记录 */
export function verifySmsCode(phone: string, code: string): boolean {
  const record = codeStore.get(phone);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    codeStore.delete(phone);
    return false;
  }

  record.attempts += 1;
  if (record.attempts > MAX_VERIFY_ATTEMPTS) {
    codeStore.delete(phone);
    return false;
  }

  if (record.code !== code) {
    return false;
  }

  codeStore.delete(phone);
  return true;
}
