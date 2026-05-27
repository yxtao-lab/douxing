<template>
  <view class="voice-text-composer">
    <view
      v-if="speechRecordingUi"
      class="voice-hold-mask"
      @touchmove.stop.prevent="handleHoldMove"
      @touchend.stop="handleHoldEnd"
      @touchcancel.stop="handleHoldEnd"
    />
    <view class="composer">
      <view v-if="inputMode === 'voice'" class="composer-voice-wrap">
        <text v-if="speechRecordingUi" class="hold-speak-hint">
          {{ speechHoldCancel ? cancelHint : recordingHint }}
        </text>
        <view class="composer-voice">
          <view
            class="hold-speak-zone"
            @touchstart.stop="handleHoldStart"
            @touchmove.stop.prevent="handleHoldMove"
            @touchend.stop="handleHoldEnd"
            @touchcancel.stop="handleHoldEnd"
          >
            <view
              class="hold-speak-btn"
              :class="{
                'hold-speak-btn--active': speechRecordingUi,
                'hold-speak-btn--cancel': speechRecordingUi && speechHoldCancel,
                'hold-speak-btn--disabled': disabled || !speechSupported,
              }"
            >
              <text v-if="!speechRecordingUi" class="hold-speak-text">{{ holdLabel }}</text>
              <view v-else class="waveform">
                <view
                  v-for="(bar, index) in waveformBars"
                  :key="index"
                  class="waveform-bar"
                  :style="{
                    height: `${bar.height}rpx`,
                    opacity: bar.opacity,
                    animationDelay: `${bar.delay}s`,
                    animationDuration: `${bar.duration}s`,
                  }"
                />
              </view>
            </view>
          </view>
          <view class="btn-mode-switch" @tap.stop="switchToKeyboard">
            <view class="keyboard-icon" aria-hidden="true">
              <view class="keyboard-shell">
                <view class="keyboard-row">
                  <view class="keyboard-key" />
                  <view class="keyboard-key" />
                  <view class="keyboard-key" />
                  <view class="keyboard-key" />
                </view>
                <view class="keyboard-row keyboard-row--mid">
                  <view class="keyboard-key" />
                  <view class="keyboard-key" />
                  <view class="keyboard-key" />
                </view>
                <view class="keyboard-space" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <template v-else>
        <view class="composer-input-wrap">
          <textarea
            :key="composerKey"
            :value="modelValue"
            class="composer-input"
            :class="{
              'composer-input--empty': !modelValue,
              'composer-input--has-clear': showClearButton,
            }"
            :placeholder="placeholderText"
            placeholder-style="color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
            :maxlength="maxlength"
            :disabled="disabled"
            :auto-height="autoHeightEnabled"
            :show-confirm-bar="false"
            confirm-type="send"
            @input="onTextInput"
            @confirm="emitSend"
          />
          <view
            v-if="showClearButton"
            class="btn-clear"
            @tap.stop="handleClear"
          >
            <view class="clear-icon" aria-hidden="true">
              <view class="clear-icon-line clear-icon-line--a" />
              <view class="clear-icon-line clear-icon-line--b" />
            </view>
          </view>
        </view>
        <view v-if="speechSupported" class="btn-mode-switch" @tap.stop="switchToVoice">
          <view class="mic-icon">
            <view class="mic-head" />
            <view class="mic-neck" />
            <view class="mic-base" />
          </view>
        </view>
        <button
          class="btn-send"
          :loading="loading"
          :disabled="disabled || !modelValue.trim()"
          @click="emitSend"
        >
          {{ sendLabel }}
        </button>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useTf } from '@/i18n/useTf';
import { mobileT } from '@/i18n/mobileT';
import {
  isSpeechToTextSupported,
  startSpeechToText,
  stopSpeechToText,
} from '@/utils/speech-to-text';
import type { SpeechToTextSession } from '@/utils/speech-to-text';

const props = withDefaults(
  defineProps<{
    /** 输入框内容（v-model） */
    modelValue?: string;
    /** 占位提示 */
    placeholder?: string;
    /** 禁用输入与录音 */
    disabled?: boolean;
    /** 发送按钮 loading */
    loading?: boolean;
    /** 默认输入模式 */
    defaultMode?: 'voice' | 'keyboard';
    /** 最大字数 */
    maxlength?: number;
    /** 发送按钮文案 */
    sendLabel?: string;
    /** 按住说话按钮文案 */
    holdLabel?: string;
    /** 录音中提示 */
    recordingHint?: string;
    /** 上滑取消后松开提示 */
    cancelHint?: string;
    /** 上滑取消阈值（px） */
    slideCancelThresholdPx?: number;
  }>(),
  {
    modelValue: '',
    placeholder: '',
    disabled: false,
    loading: false,
    defaultMode: 'keyboard',
    maxlength: 500,
    sendLabel: undefined,
    holdLabel: undefined,
    recordingHint: undefined,
    cancelHint: undefined,
    slideCancelThresholdPx: 50,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  /** 用户点击发送或语音识别完成后触发 */
  send: [text: string];
}>();

const { t } = useTf();

const sendLabel = computed(() => props.sendLabel ?? t('plan.composerSend'));
const holdLabel = computed(() => props.holdLabel ?? t('plan.composerHold'));
const recordingHint = computed(() => props.recordingHint ?? t('plan.composerRecording'));
const cancelHint = computed(() => props.cancelHint ?? t('plan.composerCancelHold'));
const placeholderText = computed(() => props.placeholder || t('plan.inputRequired'));

const showClearButton = computed(() => Boolean(props.modelValue) && !props.disabled);

/** 空内容时关闭 auto-height，避免小程序端收起后仍保留多行高度 */
const autoHeightEnabled = computed(() => Boolean(props.modelValue.trim()));

const speechSupported = isSpeechToTextSupported();
const composerKey = ref(0);

function remountTextarea() {
  composerKey.value += 1;
}

watch(
  () => props.modelValue,
  (val, prev) => {
    const wasNonEmpty = Boolean(prev?.trim());
    const isEmpty = !val.trim();
    if (wasNonEmpty && isEmpty) {
      nextTick(remountTextarea);
    }
  },
);
const inputMode = ref<'voice' | 'keyboard'>(props.defaultMode);
const speechRecordingUi = ref(false);
const holdFingerDown = ref(false);
const speechSession = ref<SpeechToTextSession | null>(null);
const pendingHoldStop = ref(false);
const speechBaseText = ref('');
const shouldSendAfterSpeech = ref(false);
const speechHoldCancel = ref(false);
const speechHoldCancelled = ref(false);
const holdStartY = ref(0);
const holdReleased = ref(false);

type TouchLikeEvent = {
  touches?: Array<{ clientY?: number; pageY?: number }>;
  changedTouches?: Array<{ clientY?: number; pageY?: number }>;
};

const WAVEFORM_BAR_COUNT = 17;
const waveformBars = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
  const center = (WAVEFORM_BAR_COUNT - 1) / 2;
  const ratio = 1 - Math.abs(index - center) / center;
  return {
    height: Math.round(8 + ratio * 36),
    opacity: Number((0.18 + ratio * 0.82).toFixed(2)),
    delay: Number((((index * 3) % 7) * 0.07).toFixed(2)),
    duration: Number((0.52 + (index % 4) * 0.11).toFixed(2)),
  };
});

function onTextInput(event: { detail: { value: string } }) {
  emit('update:modelValue', event.detail.value);
}

function joinSpeechText(base: string, recognized: string) {
  const trimmedBase = base.trim();
  const trimmedRecognized = recognized.trim();
  if (!trimmedRecognized) return trimmedBase;
  if (!trimmedBase) return trimmedRecognized;
  return `${trimmedBase} ${trimmedRecognized}`;
}

function applySpeechPartial(recognized: string) {
  emit('update:modelValue', joinSpeechText(speechBaseText.value, recognized));
}

function applySpeechFinal(recognized: string) {
  const merged = joinSpeechText(speechBaseText.value, recognized);
  emit('update:modelValue', merged);
  speechBaseText.value = merged.trim();
  shouldSendAfterSpeech.value = Boolean(merged.trim());
}

function readTouchY(event: TouchLikeEvent, useChanged = false): number | null {
  const list = useChanged ? event.changedTouches : event.touches;
  const touch = list?.[0];
  if (!touch) return null;
  return touch.pageY ?? touch.clientY ?? null;
}

function updateHoldCancel(event: TouchLikeEvent, useChanged = false) {
  const y = readTouchY(event, useChanged);
  if (y == null) return;
  speechHoldCancel.value = holdStartY.value - y > props.slideCancelThresholdPx;
}

function resetSpeechHoldState() {
  holdFingerDown.value = false;
  speechRecordingUi.value = false;
  pendingHoldStop.value = false;
  speechSession.value = null;
  speechHoldCancel.value = false;
  holdReleased.value = false;
}

function finishSpeechHold(
  session: SpeechToTextSession | null = speechSession.value,
  options?: { cancel?: boolean },
) {
  session?.stop(options?.cancel ? { cancel: true } : undefined);
  if (speechSession.value === session) {
    speechSession.value = null;
  }
}

function switchToKeyboard() {
  finishSpeechHold();
  stopSpeechToText();
  resetSpeechHoldState();
  shouldSendAfterSpeech.value = false;
  speechHoldCancelled.value = false;
  inputMode.value = 'keyboard';
}

function switchToVoice() {
  inputMode.value = 'voice';
}

function emitSend() {
  if (props.disabled) return;
  const text = props.modelValue.trim();
  if (!text) {
    uni.showToast({ title: t('plan.inputRequired'), icon: 'none' });
    return;
  }
  emit('send', text);
}

function handleHoldMove(event: TouchLikeEvent) {
  if (!speechRecordingUi.value || holdReleased.value) return;
  updateHoldCancel(event, false);
}

async function handleHoldStart(event: TouchLikeEvent) {
  if (props.disabled) return;
  if (!speechSupported) {
    uni.showToast({ title: mobileT('speech.unsupportedEnv'), icon: 'none' });
    return;
  }
  if (speechRecordingUi.value) return;

  holdReleased.value = false;
  const startY = readTouchY(event, false);
  holdStartY.value = startY ?? 0;
  holdFingerDown.value = true;
  speechHoldCancel.value = false;
  speechHoldCancelled.value = false;
  pendingHoldStop.value = false;
  speechBaseText.value = props.modelValue.trim();
  shouldSendAfterSpeech.value = false;
  speechRecordingUi.value = true;

  const session = await startSpeechToText({
    onPartial: (recognized) => {
      if (speechHoldCancelled.value) return;
      applySpeechPartial(recognized);
    },
    onFinal: (recognized) => {
      if (speechHoldCancelled.value) return;
      applySpeechFinal(recognized);
    },
    onError: (message) => {
      shouldSendAfterSpeech.value = false;
      uni.showToast({ title: message, icon: 'none' });
    },
    onEnd: () => {
      const cancelled = speechHoldCancelled.value;
      resetSpeechHoldState();
      speechHoldCancelled.value = false;
      if (cancelled) {
        shouldSendAfterSpeech.value = false;
        return;
      }
      if (shouldSendAfterSpeech.value) {
        shouldSendAfterSpeech.value = false;
        emitSend();
      }
    },
  });

  if (!session) {
    resetSpeechHoldState();
    shouldSendAfterSpeech.value = false;
    speechHoldCancelled.value = false;
    return;
  }

  speechSession.value = session;
  if (pendingHoldStop.value || !holdFingerDown.value) {
    finishSpeechHold(session, { cancel: speechHoldCancelled.value });
  }
}

function handleHoldEnd(event?: TouchLikeEvent) {
  if (holdReleased.value) return;
  if (!holdFingerDown.value && !speechRecordingUi.value) return;

  holdReleased.value = true;
  holdFingerDown.value = false;
  pendingHoldStop.value = true;

  if (event) {
    updateHoldCancel(event, true);
  }

  const cancel = speechHoldCancel.value;
  speechHoldCancel.value = false;

  if (cancel) {
    speechHoldCancelled.value = true;
    shouldSendAfterSpeech.value = false;
  }

  if (speechSession.value) {
    finishSpeechHold(speechSession.value, { cancel });
  }
}

/** 清空输入并重置 textarea（发送成功后调用） */
function clear() {
  emit('update:modelValue', '');
}

function handleClear() {
  if (props.disabled) return;
  clear();
}

onBeforeUnmount(() => {
  finishSpeechHold();
  stopSpeechToText();
  resetSpeechHoldState();
});

defineExpose({ clear });
</script>

<style scoped>
.voice-text-composer {
  --composer-row-height: 80rpx;
  --composer-text-line-height: 56rpx;
  --composer-input-padding-y: 12rpx;
  --composer-max-height: calc(
    var(--composer-input-padding-y) * 2 + var(--composer-text-line-height) * 4
  );
  width: 100%;
}
.voice-hold-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
  background: transparent;
}
.composer {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}
.composer-voice-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}
.hold-speak-hint {
  text-align: center;
  font-size: 26rpx;
  color: #374151;
  line-height: 1.4;
}
.composer-voice {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}
.hold-speak-zone {
  flex: 1;
  min-width: 0;
}
.hold-speak-btn {
  width: 100%;
  min-width: 0;
  height: var(--composer-row-height);
  border-radius: 12rpx;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  user-select: none;
  position: relative;
  overflow: hidden;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.hold-speak-btn--active {
  border-radius: 999rpx;
  background: #1677ff;
  box-shadow: 0 6rpx 20rpx rgba(22, 119, 255, 0.38);
}
.hold-speak-btn--cancel {
  background: #ef4444;
  box-shadow: 0 6rpx 20rpx rgba(239, 68, 68, 0.35);
}
.hold-speak-btn--disabled {
  opacity: 0.45;
}
.waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  height: 100%;
  padding: 0 24rpx;
  box-sizing: border-box;
}
.waveform-bar {
  width: 6rpx;
  border-radius: 999rpx;
  background: #fff;
  flex-shrink: 0;
  transform-origin: center center;
  animation-name: waveformPulse;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
.hold-speak-text {
  font-size: 30rpx;
  color: #111827;
  font-weight: 500;
}
.btn-mode-switch {
  flex-shrink: 0;
  width: var(--composer-row-height);
  height: var(--composer-row-height);
  border-radius: 12rpx;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.keyboard-icon {
  width: 48rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.keyboard-shell {
  width: 100%;
  height: 100%;
  border: 3rpx solid #374151;
  border-radius: 8rpx;
  padding: 5rpx 6rpx 6rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.keyboard-row {
  display: flex;
  gap: 4rpx;
}
.keyboard-row--mid {
  padding: 0 4rpx;
}
.keyboard-key {
  flex: 1;
  height: 6rpx;
  border-radius: 2rpx;
  background: #374151;
}
.keyboard-space {
  align-self: center;
  width: 72%;
  height: 6rpx;
  border-radius: 2rpx;
  background: #374151;
}
@keyframes waveformPulse {
  0% {
    transform: scaleY(0.28);
  }
  100% {
    transform: scaleY(1);
  }
}
.composer-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}
.composer-input {
  flex: 1;
  width: 100%;
  min-height: var(--composer-row-height);
  max-height: var(--composer-max-height);
  font-size: 28rpx;
  line-height: var(--composer-text-line-height);
  padding: var(--composer-input-padding-y) 8rpx;
  overflow-y: auto;
  box-sizing: border-box;
}
.composer-input--has-clear {
  padding-right: 64rpx;
}
.composer-input--empty {
  height: var(--composer-row-height) !important;
  min-height: var(--composer-row-height);
  max-height: var(--composer-row-height);
  overflow: hidden;
}
.btn-clear {
  position: absolute;
  right: 4rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
}
.btn-clear:active {
  opacity: 0.75;
}
.clear-icon {
  position: relative;
  width: 24rpx;
  height: 24rpx;
}
.clear-icon-line {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 24rpx;
  height: 3rpx;
  margin-left: -12rpx;
  margin-top: -1.5rpx;
  border-radius: 999rpx;
  background: #6b7280;
}
.clear-icon-line--a {
  transform: rotate(45deg);
}
.clear-icon-line--b {
  transform: rotate(-45deg);
}
.mic-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.mic-head {
  width: 20rpx;
  height: 28rpx;
  border-radius: 10rpx;
  background: #6b7280;
}
.mic-neck {
  width: 4rpx;
  height: 8rpx;
  margin-top: 2rpx;
  background: #6b7280;
}
.mic-base {
  width: 28rpx;
  height: 4rpx;
  margin-top: 2rpx;
  border-radius: 2rpx;
  background: #6b7280;
}
.btn-send {
  flex-shrink: 0;
  min-width: 120rpx;
  height: var(--composer-row-height);
  line-height: var(--composer-row-height);
  padding: 0 28rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin: 0;
  box-sizing: border-box;
}
.btn-send::after {
  border: none;
}
</style>
