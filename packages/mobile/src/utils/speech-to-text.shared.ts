export type SpeechToTextHandlers = {
  onStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
};

export type SpeechToTextSession = {
  stop: () => void;
};

let activeSession: SpeechToTextSession | null = null;

export function bindSpeechSession(session: SpeechToTextSession | null) {
  activeSession = session;
}

export function stopSpeechToText() {
  activeSession?.stop();
  activeSession = null;
}
