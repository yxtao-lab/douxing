<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-space wrap>
            <a-tag :color="statusTagColor">{{ statusLabel }}</a-tag>
            <span class="hint">{{ t('routeSolverLab.decoupleHint') }}</span>
          </a-space>
        </template>
        <template #right>
          <a-space>
            <a-button @click="refreshStatus">{{ t('routeSolverLab.refreshStatus') }}</a-button>
            <a-button type="primary" :loading="solving" @click="runSolve">
              {{ t('routeSolverLab.solve') }}
            </a-button>
          </a-space>
        </template>
      </AdminToolbar>
    </template>

    <div class="admin-desc-block lab-body">
    <a-row :gutter="16">
      <a-col :xs="24" :lg="10">
        <a-card size="small" :title="t('routeSolverLab.factorsTitle')" class="block">
          <a-alert
            type="info"
            show-icon
            class="mb"
            :message="t('routeSolverLab.presetHint')"
          />
          <a-form layout="vertical">
            <a-form-item :label="t('routeSolverLab.preset')">
              <a-select
                v-model:value="presetId"
                :options="presetSelectOptions"
                allow-clear
                :placeholder="t('routeSolverLab.presetPlaceholder')"
                @change="onPresetChange"
              />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.firstSolution')">
              <a-select v-model:value="options.firstSolution" :options="firstSolutionOptions" />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.metaheuristic')">
              <a-select v-model:value="options.metaheuristic" :options="metaOptions" />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.timeLimitSeconds')">
              <a-input-number
                v-model:value="options.timeLimitSeconds"
                :min="0.1"
                :max="120"
                :step="0.5"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.travelTimeWeight')">
              <a-input-number
                v-model:value="options.travelTimeWeight"
                :min="0"
                :max="10"
                :step="0.1"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.distanceWeight')">
              <a-input-number
                v-model:value="options.distanceWeight"
                :min="0"
                :max="10"
                :step="0.1"
                style="width: 100%"
              />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.returnToDepot')">
              <a-switch v-model:checked="options.returnToDepot" />
            </a-form-item>
            <a-form-item :label="t('routeSolverLab.enableTimeWindows')">
              <a-switch v-model:checked="options.enableTimeWindows" />
            </a-form-item>
          </a-form>
        </a-card>

        <a-card size="small" :title="t('routeSolverLab.nodesTitle')" class="block">
          <a-space class="mb">
            <a-button size="small" @click="loadDemoNodes">{{ t('routeSolverLab.loadDemo') }}</a-button>
            <a-button size="small" @click="addNode">{{ t('routeSolverLab.addNode') }}</a-button>
          </a-space>
          <a-table
            size="small"
            :pagination="false"
            :data-source="nodes"
            :columns="nodeColumns"
            row-key="id"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'name'">
                <a-input v-model:value="record.name" size="small" />
              </template>
              <template v-else-if="column.key === 'lat'">
                <a-input-number v-model:value="record.lat" size="small" :step="0.0001" style="width: 100%" />
              </template>
              <template v-else-if="column.key === 'lng'">
                <a-input-number v-model:value="record.lng" size="small" :step="0.0001" style="width: 100%" />
              </template>
              <template v-else-if="column.key === 'stay'">
                <a-input-number v-model:value="record.stayMinutes" size="small" :min="0" style="width: 100%" />
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  type="link"
                  size="small"
                  danger
                  :disabled="index === 0"
                  @click="removeNode(index)"
                >
                  {{ t('routeSolverLab.deleteNode') }}
                </a-button>
              </template>
            </template>
          </a-table>
          <p class="hint mt">{{ t('routeSolverLab.depotHint') }}</p>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="14">
        <a-card size="small" :title="t('routeSolverLab.resultTitle')" class="block">
          <template v-if="result">
            <a-descriptions size="small" :column="2" bordered class="mb">
              <a-descriptions-item :label="t('routeSolverLab.totalCost')">
                {{ result.totalCost }} {{ result.costUnit }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('routeSolverLab.solveMs')">
                {{ result.solveMs }} ms
              </a-descriptions-item>
              <a-descriptions-item :label="t('routeSolverLab.matrixSource')" :span="2">
                {{ result.matrixSource }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('routeSolverLab.path')" :span="2">
                {{ result.orderNames.join(' → ') }}
              </a-descriptions-item>
            </a-descriptions>
            <a-table
              size="small"
              class="mb"
              :pagination="false"
              :data-source="result.appliedFactors"
              :columns="factorResultColumns"
              row-key="key"
            />
          </template>
          <a-empty v-else :description="t('routeSolverLab.resultEmpty')" />

          <RouteSolverMap
            :points="mapPoints"
            :order-indexes="result?.order ?? []"
            :height="380"
          />
        </a-card>
      </a-col>
    </a-row>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/layouts/components/PageContainer.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import RouteSolverMap from '@/components/RouteSolverMap.vue';
import {
  fetchRouteSolverFactors,
  fetchRouteSolverStatus,
  solveRouteSolverLab,
  type RouteSolverNode,
  type RouteSolverOptions,
  type RouteSolverSolveResult,
  type RouteSolverStatus,
} from '@/api/route-solver';

const { t } = useI18n();

const status = ref<RouteSolverStatus | null>(null);
const solving = ref(false);
const result = ref<RouteSolverSolveResult | null>(null);
const presetId = ref<string | undefined>('balanced');
const catalogPresets = ref<
  Array<{ id: string; label: string; description: string; options: RouteSolverOptions }>
>([]);

const options = reactive<RouteSolverOptions>({
  preset: 'balanced',
  timeLimitSeconds: 2,
  firstSolution: 'PATH_CHEAPEST_ARC',
  metaheuristic: 'GUIDED_LOCAL_SEARCH',
  returnToDepot: false,
  travelTimeWeight: 1,
  distanceWeight: 0,
  enableTimeWindows: false,
  depotStartMinutes: 9 * 60,
  waitingSlackMinutes: 30,
});

const nodes = ref<RouteSolverNode[]>([]);

const DEMO_NODES: RouteSolverNode[] = [
  { id: 'hotel', name: '酒店', lat: 30.259, lng: 120.164, stayMinutes: 0 },
  { id: 'westlake', name: '西湖', lat: 30.242, lng: 120.148, stayMinutes: 90, windowStart: 8 * 60, windowEnd: 18 * 60 },
  { id: 'lingyin', name: '灵隐寺', lat: 30.2426, lng: 120.099, stayMinutes: 90, windowStart: 7 * 60, windowEnd: 17 * 60 },
  { id: 'leifeng', name: '雷峰塔', lat: 30.231, lng: 120.149, stayMinutes: 60, windowStart: 8 * 60, windowEnd: 20 * 60 },
  { id: 'hefang', name: '河坊街', lat: 30.245, lng: 120.17, stayMinutes: 60, windowStart: 10 * 60, windowEnd: 22 * 60 },
];

const statusTagColor = computed(() => {
  if (!status.value?.enabled) return 'default';
  if (status.value.health?.ortoolsAvailable) return 'success';
  return 'warning';
});

const statusLabel = computed(() => {
  if (!status.value) return t('routeSolverLab.statusUnknown');
  if (!status.value.enabled) return t('routeSolverLab.statusDisabled');
  if (status.value.health?.ortoolsAvailable) return t('routeSolverLab.statusOk');
  return t('routeSolverLab.statusDegraded');
});

const presetSelectOptions = computed(() =>
  catalogPresets.value.map((p) => ({
    value: p.id,
    label: `${p.label} — ${p.description}`,
  })),
);

const firstSolutionOptions = [
  { value: 'PATH_CHEAPEST_ARC', label: 'PATH_CHEAPEST_ARC' },
  { value: 'SAVINGS', label: 'SAVINGS' },
  { value: 'CHRISTOFIDES', label: 'CHRISTOFIDES' },
  { value: 'PARALLEL_CHEAPEST_INSERTION', label: 'PARALLEL_CHEAPEST_INSERTION' },
];

const metaOptions = [
  { value: 'GUIDED_LOCAL_SEARCH', label: 'GUIDED_LOCAL_SEARCH' },
  { value: 'SIMULATED_ANNEALING', label: 'SIMULATED_ANNEALING' },
  { value: 'TABU_SEARCH', label: 'TABU_SEARCH' },
  { value: '', label: '(off)' },
];

const nodeColumns = computed(() => [
  { title: t('routeSolverLab.colName'), key: 'name', width: 120 },
  { title: 'Lat', key: 'lat', width: 110 },
  { title: 'Lng', key: 'lng', width: 110 },
  { title: t('routeSolverLab.colStay'), key: 'stay', width: 80 },
  { title: t('routeSolverLab.colAction'), key: 'action', width: 70 },
]);

const factorResultColumns = computed(() => [
  { title: t('routeSolverLab.colFactor'), dataIndex: 'label', key: 'label' },
  { title: t('routeSolverLab.colValue'), dataIndex: 'value', key: 'value' },
]);

const mapPoints = computed(() =>
  nodes.value
    .filter((n) => n.lat != null && n.lng != null)
    .map((n) => ({ name: n.name, lat: Number(n.lat), lng: Number(n.lng) })),
);

/**
 * 加载杭州演示节点。
 *
 * @returns void
 */
function loadDemoNodes(): void {
  nodes.value = DEMO_NODES.map((n) => ({ ...n }));
  result.value = null;
}

/**
 * 追加一个空白 POI 节点。
 *
 * @returns void
 */
function addNode(): void {
  const i = nodes.value.length;
  nodes.value.push({
    id: `poi_${i}_${Date.now()}`,
    name: `POI ${i}`,
    lat: 30.25,
    lng: 120.16,
    stayMinutes: 60,
  });
}

/**
 * 删除节点（不允许删除 depot 下标 0）。
 *
 * @param index - 节点下标
 * @returns void
 */
function removeNode(index: number): void {
  if (index <= 0) return;
  nodes.value.splice(index, 1);
}

/**
 * 应用预设方案到表单。
 *
 * @returns void
 */
function onPresetChange(): void {
  const preset = catalogPresets.value.find((p) => p.id === presetId.value);
  if (!preset) {
    options.preset = null;
    return;
  }
  Object.assign(options, preset.options);
  options.preset = preset.id as RouteSolverOptions['preset'];
}

/**
 * 刷新外置服务状态。
 *
 * @returns Promise<void>
 */
async function refreshStatus(): Promise<void> {
  try {
    status.value = await fetchRouteSolverStatus();
  } catch {
    status.value = { enabled: false, health: null };
  }
}

/**
 * 加载因子目录（失败时仍可用本地默认预设）。
 *
 * @returns Promise<void>
 */
async function loadCatalog(): Promise<void> {
  try {
    const catalog = await fetchRouteSolverFactors();
    catalogPresets.value = catalog.presets;
  } catch {
    catalogPresets.value = [
      {
        id: 'balanced',
        label: t('routeSolverLab.presetBalanced'),
        description: t('routeSolverLab.presetBalancedDesc'),
        options: { ...options, preset: 'balanced' },
      },
    ];
  }
}

/**
 * 发起求解并展示结果。
 *
 * @returns Promise<void>
 */
async function runSolve(): Promise<void> {
  if (nodes.value.length < 1) {
    message.warning(t('routeSolverLab.needNodes'));
    return;
  }
  solving.value = true;
  try {
    result.value = await solveRouteSolverLab({
      nodes: nodes.value,
      options: { ...options, preset: (presetId.value as RouteSolverOptions['preset']) ?? null },
    });
    message.success(t('routeSolverLab.solveSuccess'));
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('routeSolverLab.solveFailed'));
  } finally {
    solving.value = false;
  }
}

onMounted(async () => {
  loadDemoNodes();
  await refreshStatus();
  await loadCatalog();
});
</script>

<style scoped>
.block {
  margin-bottom: 16px;
}
.lab-body {
  overflow: auto;
  padding-right: 4px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 8px;
}
.hint {
  color: var(--dx-text-secondary, #8c8c8c);
  font-size: 12px;
}
</style>
