<template>
  <div class="changelog">
    <article
      v-for="item in items"
      :key="item.id"
      class="changelog-item"
      :class="{ open: activeKeys.includes(item.id) }"
    >
      <button type="button" class="changelog-trigger" @click="toggleItem(item.id)">
        <span class="changelog-trigger-main">
          <span class="changelog-version">{{ t(item.versionKey) }}</span>
          <a-tag :color="typeColor(item.type)" class="changelog-type">
            {{ typeLabel(item.type) }}
          </a-tag>
        </span>
        <span class="changelog-meta">
          <span class="changelog-date">{{ t(item.dateKey) }}</span>
          <DownOutlined class="changelog-arrow" aria-hidden="true" />
        </span>
      </button>

      <div v-show="activeKeys.includes(item.id)" class="changelog-body">
        <ul class="changelog-points">
          <li v-for="pointKey in item.pointKeys" :key="pointKey" class="changelog-point">
            {{ t(pointKey) }}
          </li>
        </ul>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { DownOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { ChangelogType, WorkbenchChangelogItem } from '@/data/workbench';

defineProps<{
  items: WorkbenchChangelogItem[];
}>();

const activeKeys = defineModel<string[]>('activeKeys', { required: true });

const { t } = useI18n();

function toggleItem(id: string) {
  if (activeKeys.value.includes(id)) {
    activeKeys.value = activeKeys.value.filter((key) => key !== id);
    return;
  }
  activeKeys.value = [...activeKeys.value, id];
}

function typeLabel(type: ChangelogType) {
  if (type === 'major') return t('home.changelogTypeMajor');
  if (type === 'fix') return t('home.changelogTypeFix');
  return t('home.changelogTypeFeature');
}

function typeColor(type: ChangelogType) {
  if (type === 'major') return 'red';
  if (type === 'fix') return 'green';
  return 'blue';
}
</script>

<style scoped>
.changelog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.changelog-item {
  overflow: hidden;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  background: #fafbfc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.changelog-item.open {
  background: #fff;
  border-color: rgba(22, 119, 255, 0.18);
  box-shadow: 0 4px 14px rgba(22, 119, 255, 0.06);
}

.changelog-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.changelog-trigger-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.changelog-version {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.changelog-type {
  margin: 0;
  line-height: 20px;
  font-size: 11px;
  border-radius: 999px;
}

.changelog-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.changelog-date {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.changelog-arrow {
  font-size: 11px;
  color: #9ca3af;
  transition: transform 0.2s ease, color 0.2s ease;
}

.changelog-item.open .changelog-arrow {
  transform: rotate(180deg);
  color: #1677ff;
}

.changelog-body {
  padding: 0 16px 16px 18px;
}

.changelog-points {
  margin: 0;
  padding: 12px 14px 12px 28px;
  list-style: disc;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #eef2f7;
}

.changelog-point {
  padding: 4px 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.65;
}

.changelog-point::marker {
  color: #93c5fd;
}
</style>
