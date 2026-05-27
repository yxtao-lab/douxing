import { asr } from 'tencentcloud-sdk-nodejs';
import { ApiError, ApiMessageKey } from '@douxing/shared';
import { getTencentAsrConfig } from '../config/speech.js';

type AsrClient = InstanceType<typeof asr.v20190614.Client>;

export type TencentVoiceFormat = 'mp3' | 'wav' | 'm4a' | 'pcm';

let cachedClient: AsrClient | null = null;

function createClient(): AsrClient {
  const config = getTencentAsrConfig();
  if (!config) {
    throw new ApiError(ApiMessageKey.TENCENT_ASR_NOT_CONFIGURED);
  }

  return new asr.v20190614.Client({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: config.region,
    profile: {
      httpProfile: {
        endpoint: 'asr.tencentcloudapi.com',
      },
    },
  });
}

function getClient(): AsrClient {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

export async function transcribeWithTencent(
  audio: Buffer,
  voiceFormat: TencentVoiceFormat,
): Promise<string> {
  const client = getClient();
  const response = await client.SentenceRecognition({
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: '16k_zh',
    SourceType: 1,
    VoiceFormat: voiceFormat,
    UsrAudioKey: `douxing-${Date.now()}`,
    Data: audio.toString('base64'),
    DataLen: audio.length,
  });

  const text = response.Result?.trim() ?? '';
  if (!text) {
    throw new ApiError(ApiMessageKey.SPEECH_NO_CONTENT);
  }
  return text;
}
