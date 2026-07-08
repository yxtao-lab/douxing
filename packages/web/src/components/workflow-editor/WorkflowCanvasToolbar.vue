<template>
  <Panel position="top-right" class="workflow-canvas-toolbar">
    <div class="workflow-canvas-toolbar__group" @click.stop @mousedown.stop>
      <a-tooltip :title="t('workflowEditor.canvasToolbar.undoHint')">
        <span class="workflow-canvas-toolbar__btn-wrap">
          <button
            type="button"
            class="workflow-canvas-toolbar__btn"
            :class="{ 'workflow-canvas-toolbar__btn--disabled': !canUndo }"
            :disabled="!canUndo"
            :aria-label="t('workflowEditor.canvasToolbar.undo')"
            @click="emit('undo')"
          >
            <WorkflowToolbarUndoIcon />
          </button>
        </span>
      </a-tooltip>

      <a-tooltip :title="t('workflowEditor.canvasToolbar.redoHint')">
        <span class="workflow-canvas-toolbar__btn-wrap">
          <button
            type="button"
            class="workflow-canvas-toolbar__btn"
            :class="{ 'workflow-canvas-toolbar__btn--disabled': !canRedo }"
            :disabled="!canRedo"
            :aria-label="t('workflowEditor.canvasToolbar.redo')"
            @click="emit('redo')"
          >
            <WorkflowToolbarRedoIcon />
          </button>
        </span>
      </a-tooltip>

      <span class="workflow-canvas-toolbar__divider" aria-hidden="true" />

      <a-popover
        v-model:open="historyOpen"
        trigger="click"
        placement="bottomRight"
        overlay-class-name="workflow-canvas-toolbar__history-popover"
      >
        <template #content>
          <div class="workflow-canvas-toolbar__history">
            <div class="workflow-canvas-toolbar__history-title">
              {{ t('workflowEditor.canvasToolbar.historyTitle') }}
            </div>

            <ul class="workflow-canvas-toolbar__history-list">
              <li
                v-for="entry in safeTimelineEntries"
                :key="`${entry.action}-${entry.stepsBack}`"
                class="workflow-canvas-toolbar__history-item"
                :class="{ 'workflow-canvas-toolbar__history-item--current': entry.isCurrent }"
              >
                <button
                  type="button"
                  class="workflow-canvas-toolbar__history-btn"
                  :disabled="entry.isCurrent"
                  @click="onJump(entry.stepsBack)"
                >
                  <span class="workflow-canvas-toolbar__history-label">
                    {{ formatActionLabel(entry.action) }}
                  </span>
                  <span class="workflow-canvas-toolbar__history-meta">
                    {{
                      entry.isCurrent
                        ? t('workflowEditor.canvasToolbar.currentState')
                        : t('workflowEditor.canvasToolbar.stepsBack', { count: entry.stepsBack })
                    }}
                  </span>
                </button>
              </li>
            </ul>

            <button
              type="button"
              class="workflow-canvas-toolbar__clear"
              :disabled="!canUndo && !canRedo"
              @click="onClearHistory"
            >
              {{ t('workflowEditor.canvasToolbar.clearHistory') }}
            </button>

            <p class="workflow-canvas-toolbar__tip">
              {{ t('workflowEditor.canvasToolbar.historyTip', { max: maxHistoryDepth }) }}
            </p>
          </div>
        </template>

        <a-tooltip :title="t('workflowEditor.canvasToolbar.history')">
          <span class="workflow-canvas-toolbar__btn-wrap">
            <button
              type="button"
              class="workflow-canvas-toolbar__btn"
              :class="{ 'workflow-canvas-toolbar__btn--active': historyOpen }"
              :aria-label="t('workflowEditor.canvasToolbar.history')"
            >
              <WorkflowToolbarHistoryIcon />
            </button>
          </span>
        </a-tooltip>
      </a-popover>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Panel } from '@vue-flow/core';
import { useI18n } from 'vue-i18n';
import {
  WorkflowToolbarHistoryIcon,
  WorkflowToolbarRedoIcon,
  WorkflowToolbarUndoIcon,
} from './workflow-editor-toolbar-icons';
import {
  WORKFLOW_GRAPH_MAX_HISTORY_DEPTH,
  type WorkflowGraphHistoryActionKind,
  type WorkflowGraphHistoryTimelineEntry,
} from '@/composables/useWorkflowGraphHistory';

const props = defineProps<{
  canUndo: boolean;
  canRedo: boolean;
  timelineEntries: WorkflowGraphHistoryTimelineEntry[];
}>();

const emit = defineEmits<{
  undo: [];
  redo: [];
  jump: [stepsBack: number];
  'clear-history': [];
}>();

const { t } = useI18n();
const historyOpen = ref(false);
const maxHistoryDepth = WORKFLOW_GRAPH_MAX_HISTORY_DEPTH;

/**
 * 安全读取时间线条目，避免非数组导致渲染报错。
 */
const safeTimelineEntries = computed((): WorkflowGraphHistoryTimelineEntry[] => {
  return Array.isArray(props.timelineEntries) ? props.timelineEntries : [];
});

/**
 * 格式化变更历史动作文案。
 *
 * @param action - 动作类型
 * @returns 本地化标签
 */
function formatActionLabel(action: WorkflowGraphHistoryActionKind): string {
  return t(`workflowEditor.canvasToolbar.action.${action}`);
}

/**
 * 跳转到指定历史步并关闭弹层。
 *
 * @param stepsBack - 相对当前的撤销步数
 */
function onJump(stepsBack: number): void {
  emit('jump', stepsBack);
  historyOpen.value = false;
}

/**
 * 清除历史栈并关闭弹层。
 */
function onClearHistory(): void {
  emit('clear-history');
  historyOpen.value = false;
}
</script>

<style scoped>
.workflow-canvas-toolbar {
  margin: 12px;
  z-index: 6;
}

.workflow-canvas-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.workflow-canvas-toolbar__btn-wrap {
  display: inline-flex;
}

.workflow-canvas-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #434343;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.workflow-canvas-toolbar__btn :deep(.workflow-editor-toolbar-icon) {
  width: 18px;
  height: 18px;
}

.workflow-canvas-toolbar__btn:hover:not(:disabled) {
  background: #f5f5f5;
  color: #1677ff;
}

.workflow-canvas-toolbar__btn:disabled,
.workflow-canvas-toolbar__btn--disabled {
  color: #bfbfbf;
  cursor: not-allowed;
}

.workflow-canvas-toolbar__btn--active:not(:disabled) {
  background: #e6f4ff;
  color: #1677ff;
}

.workflow-canvas-toolbar__divider {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: #f0f0f0;
}

.workflow-canvas-toolbar__history {
  width: 280px;
}

.workflow-canvas-toolbar__history-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.workflow-canvas-toolbar__history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
}

.workflow-canvas-toolbar__history-item {
  margin-bottom: 4px;
}

.workflow-canvas-toolbar__history-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.workflow-canvas-toolbar__history-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.workflow-canvas-toolbar__history-btn:disabled {
  cursor: default;
}

.workflow-canvas-toolbar__history-item--current .workflow-canvas-toolbar__history-btn {
  background: #e6f4ff;
}

.workflow-canvas-toolbar__history-label {
  font-size: 13px;
  font-weight: 500;
  color: #262626;
  line-height: 1.4;
}

.workflow-canvas-toolbar__history-meta {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.workflow-canvas-toolbar__clear {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #ff4d4f;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.workflow-canvas-toolbar__clear:hover:not(:disabled) {
  color: #cf1322;
}

.workflow-canvas-toolbar__clear:disabled {
  color: #d9d9d9;
  cursor: not-allowed;
}

.workflow-canvas-toolbar__tip {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}
</style>
