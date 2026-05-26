export type SpeechToTextHandlers = {
  onStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
};

export type SpeechToTextStopOptions = {
  /** 为 true 时停止录音且不做识别（上滑取消） */
  cancel?: boolean;
};

export type SpeechToTextSession = {
  stop: (options?: SpeechToTextStopOptions) => void;
};

let activeSession: SpeechToTextSession | null = null;

export function bindSpeechSession(session: SpeechToTextSession | null) {
  activeSession = session;
}

export function stopSpeechToText(options?: SpeechToTextStopOptions) {
  activeSession?.stop(options);
  activeSession = null;
}
