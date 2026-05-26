export type { SpeechToTextHandlers, SpeechToTextSession } from './speech-to-text.shared';
export { stopSpeechToText } from './speech-to-text.shared';

// #ifdef H5
export { isSpeechToTextSupported, startSpeechToText } from './speech-to-text.h5';
// #endif

// #ifdef MP-WEIXIN
export { isSpeechToTextSupported, startSpeechToText } from './speech-to-text.mp-weixin';
// #endif

// #ifdef APP-PLUS
export { isSpeechToTextSupported, startSpeechToText } from './speech-to-text.app';
// #endif

// #ifndef H5 || MP-WEIXIN || APP-PLUS
import type { SpeechToTextHandlers, SpeechToTextSession } from './speech-to-text.shared';

/** 默认平台：暂不支持语音输入 */

export function isSpeechToTextSupported(): boolean {
  return false;
}

export async function startSpeechToText(
  handlers: SpeechToTextHandlers,
): Promise<SpeechToTextSession | null> {
  handlers.onError('当前环境不支持语音输入');
  handlers.onEnd?.();
  return null;
}
// #endif
