import { transcribeAudioFile } from '@/api/speech';
import {
  bindSpeechSession,
  type SpeechToTextHandlers,
  type SpeechToTextSession,
} from './speech-to-text.shared';

const recorderManager = uni.getRecorderManager();
let activeHandlers: SpeechToTextHandlers | null = null;
let recorderHooksReady = false;

function ensureRecorderHooks() {
  if (recorderHooksReady) return;
  recorderHooksReady = true;

  recorderManager.onStart(() => {
    activeHandlers?.onStart?.();
  });

  recorderManager.onStop(async (res) => {
    bindSpeechSession(null);
    const handlers = activeHandlers;
    activeHandlers = null;

    if (!handlers) return;

    if (!res.tempFilePath) {
      handlers.onError('录音失败，请重试');
      handlers.onEnd?.();
      return;
    }

    uni.showLoading({ title: '识别中...', mask: true });

    try {
      const text = await transcribeAudioFile(res.tempFilePath);
      if (text.trim()) {
        handlers.onFinal(text.trim());
      } else {
        handlers.onError('未识别到语音，请重试');
      }
    } catch (e) {
      handlers.onError(e instanceof Error ? e.message : '语音识别失败');
    } finally {
      uni.hideLoading();
      handlers.onEnd?.();
    }
  });

  recorderManager.onError(() => {
    bindSpeechSession(null);
    const handlers = activeHandlers;
    activeHandlers = null;
    if (!handlers) return;
    handlers.onError('录音失败，请检查麦克风权限');
    handlers.onEnd?.();
  });
}

export async function startRecorderSpeechToText(
  handlers: SpeechToTextHandlers,
  ensurePermission: () => Promise<void>,
): Promise<SpeechToTextSession | null> {
  try {
    await ensurePermission();
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : '麦克风权限未开启');
    handlers.onEnd?.();
    return null;
  }

  ensureRecorderHooks();

  let stopped = false;
  const session: SpeechToTextSession = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        recorderManager.stop();
      } catch {
        /* ignore */
      }
    },
  };

  activeHandlers = handlers;

  try {
    recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      format: 'mp3',
    });
  } catch {
    activeHandlers = null;
    handlers.onError('无法启动录音');
    handlers.onEnd?.();
    return null;
  }

  bindSpeechSession(session);
  return session;
}
