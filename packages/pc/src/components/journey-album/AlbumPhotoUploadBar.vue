<template>
  <div class="mb-4">
    <button type="button" class="dx-btn-primary" :disabled="uploading" @click="openUploadModal">
      {{ uploading ? t('common.loading') : t('myAlbum.upload') }}
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="uploadModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6"
      @mousedown.self="onBackdropMouseDown"
    >
      <div class="upload-modal flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" @mousedown.stop>
        <div class="border-b border-dx-border px-6 py-5">
          <h3 class="text-xl font-semibold text-dx-text">{{ t('myAlbum.uploadModalTitle') }}</h3>
          <p class="mt-1 text-sm text-dx-muted">{{ t('myAlbum.uploadInAlbumHint') }}</p>
        </div>

        <div class="modal-body flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div
            class="drop-zone rounded-xl border-2 border-dashed p-8 text-center transition"
            :class="
              isDragging
                ? 'border-dx-primary bg-dx-primary-light'
                : 'border-dx-border bg-dx-bg hover:border-dx-primary/50'
            "
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="handleDrop"
          >
            <p class="text-base font-medium text-dx-text">{{ t('myAlbum.dropHint') }}</p>
            <p class="mt-2 text-sm text-dx-muted">{{ t('myAlbum.dropTypesHint') }}</p>
            <label class="dx-btn-secondary mt-5 inline-flex cursor-pointer items-center justify-center">
              {{ t('myAlbum.selectFiles') }}
              <input
                ref="fileInputRef"
                type="file"
                :accept="TRAVEL_PHOTO_ACCEPT"
                multiple
                class="file-input-overlay"
                @change="handleFileInputChange"
              />
            </label>
          </div>

          <div
            v-if="lastAddedNotice"
            class="rounded-lg border border-dx-primary/30 bg-dx-primary-light px-4 py-2 text-sm text-dx-primary"
          >
            {{ lastAddedNotice }}
          </div>

          <div class="preview-panel rounded-xl border border-dx-border bg-dx-bg p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <p class="text-sm font-medium text-dx-text">
                {{ t('myAlbum.previewTitle', { count: pendingItems.length }) }}
              </p>
            </div>
            <div v-if="pendingItems.length === 0" class="preview-empty">
              <p class="text-sm text-dx-muted">{{ t('myAlbum.previewEmpty') }}</p>
            </div>
            <div v-else class="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
              <div
                v-for="item in pendingItems"
                :key="item.id"
                class="group relative aspect-square overflow-hidden rounded-lg border border-dx-border bg-white shadow-sm"
              >
                <img :src="item.previewUrl" alt="" class="h-full w-full object-cover" />
                <button
                  type="button"
                  class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                  :title="t('myAlbum.removeFile')"
                  @click="removePending(item.id)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <p v-if="uploadProgress" class="text-sm text-dx-muted">{{ uploadProgress }}</p>
        </div>

        <div class="flex justify-end gap-3 border-t border-dx-border px-6 py-5">
          <button type="button" class="dx-btn-secondary" :disabled="uploading" @click="closeUploadModal">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="dx-btn-primary"
            :disabled="!canSubmitUpload"
            @click="submitUpload"
          >
            {{ submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { uploadJourneyAlbumPhoto } from '@/api/journey-albums';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import {
  partitionTravelPhotoFiles,
  TRAVEL_PHOTO_ACCEPT,
} from '@/utils/travel-photo-file';

const MAX_BATCH_SIZE = 20;
const FILE_PICKER_GUARD_MS = 800;

interface PendingItem {
  id: string;
  file: File;
  previewUrl: string;
}

const props = defineProps<{
  albumId: number;
}>();

const emit = defineEmits<{
  uploaded: [];
}>();

const { t } = useLocale();

const uploadModalOpen = ref(false);
const pendingItems = ref<PendingItem[]>([]);
const uploading = ref(false);
const uploadProgress = ref('');
const isDragging = ref(false);
const dragDepth = ref(0);
const lastAddedNotice = ref('');
const ignoreBackdropCloseUntil = ref(0);

let pendingIdSeq = 0;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

const canSubmitUpload = computed(
  () => !uploading.value && props.albumId > 0 && pendingItems.value.length > 0,
);

const submitLabel = computed(() => {
  const count = pendingItems.value.length;
  if (uploading.value) return t('common.loading');
  if (count === 0) return t('myAlbum.upload');
  return t('myAlbum.uploadConfirm', { count });
});

function revokeAllPreviews() {
  for (const item of pendingItems.value) {
    URL.revokeObjectURL(item.previewUrl);
  }
  pendingItems.value = [];
}

function armBackdropGuard() {
  ignoreBackdropCloseUntil.value = Date.now() + FILE_PICKER_GUARD_MS;
}

function onBackdropMouseDown() {
  if (Date.now() < ignoreBackdropCloseUntil.value) return;
  closeUploadModal();
}

function showAddedNotice(count: number) {
  lastAddedNotice.value = t('myAlbum.filesAdded', { count });
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    lastAddedNotice.value = '';
  }, 5000);
}

function addFiles(files: File[]) {
  if (files.length === 0) return;

  const { accepted, rejectedCount } = partitionTravelPhotoFiles(files);
  if (rejectedCount > 0) {
    appMessage.warning(t('myAlbum.invalidFileSkipped', { count: rejectedCount }));
  }
  if (accepted.length === 0) return;

  const room = MAX_BATCH_SIZE - pendingItems.value.length;
  if (room <= 0) {
    appMessage.warning(t('myAlbum.batchLimit', { max: MAX_BATCH_SIZE }));
    return;
  }

  const toAdd = accepted.slice(0, room);
  if (accepted.length > room) {
    appMessage.warning(t('myAlbum.batchLimit', { max: MAX_BATCH_SIZE }));
  }

  const newItems: PendingItem[] = [];
  for (const file of toAdd) {
    pendingIdSeq += 1;
    newItems.push({
      id: `pending-${pendingIdSeq}`,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  pendingItems.value = [...pendingItems.value, ...newItems];
  showAddedNotice(newItems.length);
  armBackdropGuard();
}

function handleFileInputChange(event: Event) {
  armBackdropGuard();
  const input = event.target as HTMLInputElement;
  const fileList = input.files;
  if (!fileList?.length) return;
  addFiles(Array.from(fileList));
  input.value = '';
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  dragDepth.value = 0;
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  addFiles(Array.from(files));
}

function removePending(id: string) {
  const index = pendingItems.value.findIndex((item) => item.id === id);
  if (index < 0) return;
  const item = pendingItems.value[index];
  URL.revokeObjectURL(item.previewUrl);
  pendingItems.value = pendingItems.value.filter((row) => row.id !== id);
}

function openUploadModal() {
  if (props.albumId <= 0) return;
  uploadModalOpen.value = true;
  revokeAllPreviews();
  uploadProgress.value = '';
  lastAddedNotice.value = '';
}

function closeUploadModal() {
  if (uploading.value) return;
  uploadModalOpen.value = false;
  revokeAllPreviews();
  uploadProgress.value = '';
  lastAddedNotice.value = '';
  isDragging.value = false;
  dragDepth.value = 0;
}

function onDragEnter() {
  dragDepth.value += 1;
  isDragging.value = true;
}

function onDragOver() {
  isDragging.value = true;
}

function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0) isDragging.value = false;
}

async function submitUpload() {
  if (!canSubmitUpload.value) {
    if (pendingItems.value.length === 0) {
      appMessage.warning(t('myAlbum.previewEmpty'));
    }
    return;
  }

  uploading.value = true;
  let successCount = 0;
  const total = pendingItems.value.length;
  const snapshot = [...pendingItems.value];

  try {
    for (let i = 0; i < snapshot.length; i += 1) {
      const item = snapshot[i];
      uploadProgress.value = t('myAlbum.uploadProgress', {
        current: i + 1,
        total,
      });
      try {
        await uploadJourneyAlbumPhoto(props.albumId, item.file);
        successCount += 1;
      } catch (err) {
        appMessage.error(getAppErrorMessage(err, t('myAlbum.uploadFailed')));
        break;
      }
    }

    if (successCount > 0) {
      appMessage.success(t('myAlbum.uploadSuccessCount', { count: successCount }));
      emit('uploaded');
      closeUploadModal();
    }
  } finally {
    uploading.value = false;
    uploadProgress.value = '';
  }
}

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer);
  revokeAllPreviews();
});
</script>

<style scoped>
.upload-modal {
  min-height: min(560px, 92vh);
  max-height: 92vh;
}
.modal-body {
  min-height: 0;
}
.drop-zone {
  min-height: 140px;
}
.preview-panel {
  min-height: 160px;
}
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px dashed var(--dx-border, #e5e7eb);
  border-radius: 12px;
  background: white;
}
.file-input-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
label.dx-btn-secondary {
  position: relative;
  min-height: 40px;
  padding: 0 16px;
}
</style>
