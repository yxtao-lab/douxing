import { transcribeAudioFile } from '@/api/speech';
import { mobileT } from '@/i18n/mobileT';
import {
  bindSpeechSession,
  type SpeechToTextHandlers,
  type SpeechToTextSession,
  type SpeechToTextStopOptions,
} from './speech-to-text.shared';

const recorderManager = uni.getRecorderManager();

type RecorderSessionState = {
  stopped: boolean;
  recorderStarted: boolean;
  stopAfterStart: boolean;
  skipTranscribe: boolean;
};

let activeHandlers: SpeechToTextHandlers | null = null;
let sessionState: RecorderSessionState | null = null;
let recorderHooksReady = false;

function requestRecorderStop() {
  try {
    recorderManager.stop();
  } catch {
    /* ignore */
  }
}

function ensureRecorderHooks() {
  if (recorderHooksReady) return;
  recorderHooksReady = true;

  recorderManager.onStart(() => {
    const state = sessionState;
    if (!state || state.stopped) return;

    state.recorderStarted = true;
    if (state.stopAfterStart) {
      state.stopAfterStart = false;
      requestRecorderStop();
    }
    activeHandlers?.onStart?.();
  });

  recorderManager.onStop(async (res) => {
    bindSpeechSession(null);
    const handlers = activeHandlers;
    const state = sessionState;
    activeHandlers = null;
    sessionState = null;

    if (!handlers) return;

    if (state?.skipTranscribe) {
      handlers.onEnd?.();
      return;
    }

    if (!res.tempFilePath) {
      handlers.onError(mobileT('speech.recordingFailed'));
      handlers.onEnd?.();
      return;
    }

    uni.showLoading({ title: mobileT('speech.transcribing'), mask: true });

    try {
      const text = await transcribeAudioFile(res.tempFilePath);
      if (text.trim()) {
        handlers.onFinal(text.trim());
      } else {
        handlers.onError(mobileT('speech.noSpeechRetry'));
      }
    } catch (e) {
      handlers.onError(e instanceof Error ? e.message : mobileT('speech.transcribeFailed'));
    } finally {
      uni.hideLoading();
      handlers.onEnd?.();
    }
  });

  recorderManager.onError(() => {
    bindSpeechSession(null);
    const handlers = activeHandlers;
    activeHandlers = null;
    sessionState = null;
    if (!handlers) return;
    handlers.onError(mobileT('speech.recordingMicCheck'));
    handlers.onEnd?.();
  });
}

function stopSession(options?: SpeechToTextStopOptions) {
  const state = sessionState;
  if (!state || state.stopped) return;

  state.stopped = true;
  if (options?.cancel) {
    state.skipTranscribe = true;
  }

  if (state.recorderStarted) {
    requestRecorderStop();
    return;
  }

  state.stopAfterStart = true;
}

export async function startRecorderSpeechToText(
  handlers: SpeechToTextHandlers,
  ensurePermission: () => Promise<void>,
): Promise<SpeechToTextSession | null> {
  try {
    await ensurePermission();
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : mobileT('speech.micDenied'));
    handlers.onEnd?.();
    return null;
  }

  ensureRecorderHooks();

  sessionState = {
    stopped: false,
    recorderStarted: false,
    stopAfterStart: false,
    skipTranscribe: false,
  };

  activeHandlers = handlers;

  const session: SpeechToTextSession = {
    stop: (options) => stopSession(options),
  };

  try {
    recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      format: 'mp3',
    });
  } catch {
    activeHandlers = null;
    sessionState = null;
    handlers.onError(mobileT('speech.cannotStartRecording'));
    handlers.onEnd?.();
    return null;
  }

  bindSpeechSession(session);
  return session;
}
