<template>
  <div class="workflow-palette-doc">
    <a-tag class="workflow-palette-doc__badge" color="blue">
      {{ t('workflowEditor.paletteDoc.catalogBadge') }}
    </a-tag>

    <h3 class="workflow-palette-doc__title">{{ title }}</h3>
    <p class="workflow-palette-doc__kind">{{ kindLabel }}</p>

    <a-alert
      type="info"
      show-icon
      :message="t('workflowEditor.paletteDoc.readOnlyHint')"
      class="workflow-palette-doc__hint"
    />

    <section v-for="section in docSections" :key="section.key" class="workflow-palette-doc__section">
      <h4 class="workflow-palette-doc__section-title">{{ section.title }}</h4>
      <p class="workflow-palette-doc__section-body">{{ section.body }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  resolveWorkflowPaletteDocKeyPrefix,
  type WorkflowPaletteSelection,
} from '@/utils/workflow-palette-selection';

const props = defineProps<{
  selection: WorkflowPaletteSelection;
}>();

const { t, te } = useI18n();

/** 文档段落键 */
const SECTION_KEYS = ['summary', 'whenToUse', 'inputs', 'outputs', 'tips'] as const;

/**
 * 节点标题。
 */
const title = computed((): string => {
  const sel = props.selection;
  if (sel.toolName) {
    const key = `agent.status.${sel.toolName}`;
    const translated = t(key);
    return translated !== key ? translated : sel.toolName;
  }
  if (sel.labelKey) return t(sel.labelKey);
  return t(`workflowEditor.kind.${sel.kind}`);
});

/**
 * 节点类型徽章文案。
 */
const kindLabel = computed(() => t(`workflowEditor.kind.${props.selection.kind}`));

/**
 * 读取文档段落；缺失时返回空字符串（段落会被过滤）。
 *
 * @param prefix - i18n 前缀
 * @param sectionKey - 段落键
 * @returns 段落正文
 */
function readDocSection(prefix: string, sectionKey: (typeof SECTION_KEYS)[number]): string {
  const key = `${prefix}.${sectionKey}`;
  if (!te(key)) return '';
  const text = t(key);
  return text !== key ? text : '';
}

/**
 * 可展示的文档段落列表。
 */
const docSections = computed(() => {
  const prefix = resolveWorkflowPaletteDocKeyPrefix(props.selection);
  return SECTION_KEYS.map((sectionKey) => ({
    key: sectionKey,
    title: t(`workflowEditor.paletteDoc.sections.${sectionKey}`),
    body: readDocSection(prefix, sectionKey),
  })).filter((section) => section.body.trim().length > 0);
});
</script>

<style scoped>
.workflow-palette-doc {
  width: 100%;
}

.workflow-palette-doc__badge {
  margin-bottom: 8px;
}

.workflow-palette-doc__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.workflow-palette-doc__kind {
  margin: 0 0 12px;
  font-size: 12px;
  color: #8c8c8c;
}

.workflow-palette-doc__hint {
  margin-bottom: 16px;
}

.workflow-palette-doc__section {
  margin-bottom: 14px;
}

.workflow-palette-doc__section-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: #434343;
}

.workflow-palette-doc__section-body {
  margin: 0;
  font-size: 13px;
  color: #595959;
  line-height: 1.6;
  white-space: pre-line;
}
</style>
