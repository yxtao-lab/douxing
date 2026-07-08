<template>
  <a-tour
    v-model:current="currentStep"
    :open="open"
    :steps="steps"
    @close="emit('complete')"
    @finish="emit('complete')"
  >
    <template #indicatorsRender="{ current, total }">
      <div class="workflow-editor-tour__indicators">
        <a-button
          v-if="current < total - 1"
          type="link"
          size="small"
          class="workflow-editor-tour__skip"
          @click="emit('complete')"
        >
          {{ t('workflowEditor.onboarding.skip') }}
        </a-button>
        <span
          v-for="index in total"
          :key="index - 1"
          class="workflow-editor-tour__dot"
          :class="{ 'workflow-editor-tour__dot--active': current === index - 1 }"
        />
      </div>
    </template>
  </a-tour>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TourProps } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  open: boolean;
  paletteTarget: HTMLElement | null;
  canvasTarget: HTMLElement | null;
  toolbarTarget: HTMLElement | null;
  sideTarget: HTMLElement | null;
}>();

const emit = defineEmits<{
  complete: [];
}>();

const { t } = useI18n();
const currentStep = ref(0);

/**
 * 编排器首次进入引导步骤。
 */
const steps = computed((): TourProps['steps'] => [
  {
    title: t('workflowEditor.onboarding.welcomeTitle'),
    description: t('workflowEditor.onboarding.welcomeDesc'),
  },
  {
    title: t('workflowEditor.onboarding.stepPaletteTitle'),
    description: t('workflowEditor.onboarding.stepPaletteDesc'),
    target: () => props.paletteTarget ?? document.body,
  },
  {
    title: t('workflowEditor.onboarding.stepCanvasTitle'),
    description: t('workflowEditor.onboarding.stepCanvasDesc'),
    target: () => props.canvasTarget ?? document.body,
  },
  {
    title: t('workflowEditor.onboarding.stepToolbarTitle'),
    description: t('workflowEditor.onboarding.stepToolbarDesc'),
    target: () => props.toolbarTarget ?? document.body,
  },
  {
    title: t('workflowEditor.onboarding.stepSideTitle'),
    description: t('workflowEditor.onboarding.stepSideDesc'),
    target: () => props.sideTarget ?? document.body,
  },
  {
    title: t('workflowEditor.onboarding.stepFinishTitle'),
    description: t('workflowEditor.onboarding.stepFinishDesc'),
  },
]);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) currentStep.value = 0;
  },
);
</script>

<style scoped>
.workflow-editor-tour__indicators {
  display: flex;
  align-items: center;
  gap: 6px;
}

.workflow-editor-tour__skip {
  padding: 0 4px 0 0;
  height: auto;
  font-size: 12px;
}

.workflow-editor-tour__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(0 0 0 / 15%);
  transition: background-color 0.2s;
}

.workflow-editor-tour__dot--active {
  background: #1677ff;
}
</style>
