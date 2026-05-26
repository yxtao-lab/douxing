import {
  bindSpeechSession,
  stopSpeechToText,
  type SpeechToTextHandlers,
  type SpeechToTextSession,
} from './speech-to-text.shared';

export type { SpeechToTextHandlers, SpeechToTextSession };
export { stopSpeechToText };

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string };
    };
  };
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限未开启，请在浏览器设置中允许';
    case 'no-speech':
      return '未识别到语音，请重试';
    case 'network':
      return '网络异常，语音识别失败';
    case 'aborted':
      return '语音识别已取消';
    default:
      return '语音识别失败，请重试';
  }
}

export function isSpeechToTextSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export async function startSpeechToText(
  handlers: SpeechToTextHandlers,
): Promise<SpeechToTextSession | null> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    handlers.onError('当前浏览器不支持语音识别');
    handlers.onEnd?.();
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;

  let stopped = false;
  let latestInterim = '';

  const session: SpeechToTextSession = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    },
  };

  recognition.onstart = () => {
    handlers.onStart?.();
  };

  recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
    let interim = '';
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) {
        finalChunk += piece;
      } else {
        interim += piece;
      }
    }

    if (interim) {
      latestInterim = interim;
      handlers.onPartial?.(interim);
    }

    if (finalChunk.trim()) {
      latestInterim = '';
      handlers.onFinal(finalChunk.trim());
    }
  };

  recognition.onerror = (event: { error: string }) => {
    if (stopped) return;
    if (event.error === 'aborted') return;
    handlers.onError(mapSpeechError(event.error));
  };

  recognition.onend = () => {
    if (!stopped && latestInterim.trim()) {
      handlers.onFinal(latestInterim.trim());
    }
    bindSpeechSession(null);
    handlers.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    handlers.onError('无法启动语音识别');
    handlers.onEnd?.();
    return null;
  }

  bindSpeechSession(session);
  return session;
}
