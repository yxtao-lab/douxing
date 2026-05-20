import { sms } from 'tencentcloud-sdk-nodejs';
import { getTencentSmsConfig } from '../config/sms.js';

type SmsClient = InstanceType<typeof sms.v20210111.Client>;

let cachedClient: SmsClient | null = null;

function createClient(): SmsClient {
  const config = getTencentSmsConfig();
  if (!config) {
    throw new Error('腾讯云短信未配置');
  }

  return new sms.v20210111.Client({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: config.region,
    profile: {
      httpProfile: {
        endpoint: 'sms.tencentcloudapi.com',
      },
    },
  });
}

function getClient(): SmsClient {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

function buildTemplateParams(code: string): string[] {
  const config = getTencentSmsConfig();
  if (config?.templateMinutes) {
    return [code, config.templateMinutes];
  }
  return [code];
}

const TENCENT_ERROR_MAP: Record<string, string> = {
  'AuthFailure.SecretIdNotFound': '腾讯云 SecretId 无效',
  'AuthFailure.SignatureFailure': '腾讯云密钥配置错误',
  'FailedOperation.SignatureIncorrectOrUnapproved': '短信签名未审核或不可用',
  'FailedOperation.TemplateIncorrectOrUnapproved': '短信模板未审核或不可用',
  'FailedOperation.TemplateParamSetNotMatchApprovedTemplate': '模板参数与审核模板不一致',
  'LimitExceeded.PhoneNumberDailyLimit': '该手机号今日发送次数已达上限',
  'LimitExceeded.PhoneNumberOneHourLimit': '发送过于频繁，请稍后再试',
  'LimitExceeded.PhoneNumberSameContentDailyLimit': '相同内容发送次数过多，请稍后再试',
  'UnsupportedOperation.InsufficientBalanceInSmsPackage': '短信套餐包余额不足',
};

function mapTencentError(code: string | undefined, message: string | undefined): string {
  if (code && TENCENT_ERROR_MAP[code]) {
    return TENCENT_ERROR_MAP[code];
  }
  return message || '短信发送失败';
}

/** 通过腾讯云 SendSms 接口发送验证码 */
export async function sendTencentSmsCode(phone: string, code: string): Promise<void> {
  const config = getTencentSmsConfig();
  if (!config) {
    throw new Error('腾讯云短信未配置');
  }

  const client = getClient();

  try {
    const response = await client.SendSms({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: config.sdkAppId,
      SignName: config.signName,
      TemplateId: config.templateId,
      TemplateParamSet: buildTemplateParams(code),
    });

    const status = response.SendStatusSet?.[0];
    if (!status || status.Code !== 'Ok') {
      throw new Error(mapTencentError(status?.Code, status?.Message));
    }
  } catch (err) {
    if (err instanceof Error && err.message !== '短信发送失败') {
      throw err;
    }
    console.error('[tencent-sms] 发送失败', err);
    throw new Error('短信发送失败，请稍后重试');
  }
}
