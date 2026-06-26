<template>
  <div class="screen-kpi-card">
    <p class="screen-kpi-card__label">{{ label }}</p>
    <p class="screen-kpi-card__value">{{ formattedValue }}</p>
    <p v-if="sub" class="screen-kpi-card__sub">{{ sub }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: number;
  sub?: string;
}>();

const formattedValue = computed(() => props.value.toLocaleString());
</script>

<style scoped>
.screen-kpi-card {
  padding: 12px 14px;
  background: linear-gradient(180deg, rgba(0, 80, 140, 0.22), rgba(0, 40, 80, 0.08));
  border: 1px solid rgba(0, 180, 255, 0.22);
  border-radius: 4px;
  text-align: center;
}

.screen-kpi-card__label {
  margin: 0 0 6px;
  font-size: 12px;
  color: rgba(186, 231, 255, 0.75);
  letter-spacing: 0.06em;
}

.screen-kpi-card__value {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: #40e0ff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 12px rgba(64, 224, 255, 0.35);
}

.screen-kpi-card__sub {
  margin: 6px 0 0;
  font-size: 11px;
  color: rgba(186, 231, 255, 0.55);
}
</style>
