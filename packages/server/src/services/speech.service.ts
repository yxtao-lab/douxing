import { ApiError, ApiMessageKey } from '@douxing/shared';
import { resolveSpeechProvider } from '../config/speech.js';
import { transcribeWithTencent, type TencentVoiceFormat } from './tencent-asr.provider.js';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function detectVoiceFormat(mimeType?: string, originalName?: string): TencentVoiceFormat {
  const mime = (mimeType ?? '').toLowerCase();
  const name = (originalName ?? '').toLowerCase();

  if (mime.includes('wav') || name.endsWith('.wav')) return 'wav';
  if (mime.includes('m4a') || mime.includes('aac') || mime.includes('mp4')) return 'm4a';
  if (mime.includes('pcm')) return 'pcm';
  return 'mp3';
}

export async function transcribeSpeechBuffer(
  audio: Buffer,
  options?: { mimeType?: string; originalName?: string },
): Promise<string> {
  if (!audio.length) {
    throw new ApiError(ApiMessageKey.SPEECH_EMPTY);
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    throw new ApiError(ApiMessageKey.SPEECH_FILE_TOO_LARGE_HINT);
  }

  const provider = resolveSpeechProvider();
  if (provider === 'mock') {
    throw new ApiError(ApiMessageKey.SPEECH_NOT_CONFIGURED);
  }

  const voiceFormat = detectVoiceFormat(options?.mimeType, options?.originalName);
  return transcribeWithTencent(audio, voiceFormat);
}
