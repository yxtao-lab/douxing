<template>
  <div class="w-full">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-base font-semibold text-dx-text">{{ t('routeMap.title') }}</h3>
        <p v-if="routePath?.date" class="text-sm text-dx-muted">{{ routePath.date }}</p>
      </div>
      <p v-if="hiddenHint" class="text-xs text-amber-700">{{ hiddenHint }}</p>
    </div>

    <div
      ref="mapWrapRef"
      class="relative overflow-hidden rounded-xl border border-dx-border bg-gradient-to-br from-slate-50 to-blue-50"
    >
      <svg
        v-if="routePath && mapSize.width > 0"
        :viewBox="`0 0 ${mapSize.width} ${mapSize.height}`"
        class="block w-full"
        :style="{ height: `${mapSize.height}px` }"
      >
        <polyline
          v-if="animatedPolylinePoints.length >= 2"
          :points="polylineAttr"
          fill="none"
          stroke="#1677ff"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.85"
        />
        <circle
          v-for="(poi, idx) in projectedPois"
          :key="`poi-${idx}`"
          :cx="poi.x"
          :cy="poi.y"
          r="6"
          fill="#fff"
          stroke="#1677ff"
          stroke-width="2"
        />
        <text
          v-for="(poi, idx) in projectedPois"
          :key="`label-${idx}`"
          :x="poi.x"
          :y="poi.y - 10"
          text-anchor="middle"
          class="select-none text-[10px]"
          fill="#1f2937"
        >
          {{ truncateLabel(routePath.pois[idx]?.name ?? '') }}
        </text>
        <circle
          v-if="travelerPoint"
          :cx="travelerProjected.x"
          :cy="travelerProjected.y"
          r="8"
          fill="#13c2c2"
          stroke="#fff"
          stroke-width="2"
        />
      </svg>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" class="dx-btn-secondary !px-3 !py-1.5 text-xs" @click="handleTogglePlay">
        {{ playing ? t('routeMap.pause') : t('routeMap.play') }}
      </button>
      <button type="button" class="dx-btn-secondary !px-3 !py-1.5 text-xs" @click="handleReplay">
        {{ t('routeMap.replay') }}
      </button>
      <span v-if="playing" class="text-xs text-dx-muted">{{ t('routeMap.animating') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { LatLng, RoutePath } from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';
import { createRoutePathAnimation } from '@/utils/route-path-animation';
import { projectLatLngPoints } from '@/utils/route-map-projection';

const props = withDefaults(
  defineProps<{
    routePath: RoutePath | null;
    autoPlay?: boolean;
    durationMs?: number;
  }>(),
  {
    autoPlay: true,
    durationMs: 8000,
  },
);

const { t } = useLocale();

const mapWrapRef = ref<HTMLElement | null>(null);
const mapSize = ref({ width: 640, height: 320 });
const playing = ref(false);
const animatedPolylinePoints = ref<LatLng[]>([]);
const travelerPoint = ref<LatLng | null>(null);

let animationController: ReturnType<typeof createRoutePathAnimation> | null = null;
let resizeObserver: ResizeObserver | null = null;

const hiddenHint = computed(() => {
  if (!props.routePath || props.routePath.hiddenSpotCount <= 0) return '';
  return t('routeMap.hiddenSpots', { count: props.routePath.hiddenSpotCount });
});

const projectedPois = computed(() => {
  if (!props.routePath) return [];
  return projectLatLngPoints(
    props.routePath.pois,
    mapSize.value.width,
    mapSize.value.height,
  );
});

const travelerProjected = computed(() => {
  if (!travelerPoint.value || !props.routePath) {
    return { x: 0, y: 0 };
  }
  const [point] = projectLatLngPoints(
    [travelerPoint.value],
    mapSize.value.width,
    mapSize.value.height,
  );
  return point ?? { x: 0, y: 0 };
});

const polylineAttr = computed(() => {
  const projected = projectLatLngPoints(
    animatedPolylinePoints.value,
    mapSize.value.width,
    mapSize.value.height,
  );
  return projected.map((p) => `${p.x},${p.y}`).join(' ');
});

function truncateLabel(name: string): string {
  if (name.length <= 8) return name;
  return `${name.slice(0, 7)}…`;
}

function syncMapSize() {
  const el = mapWrapRef.value;
  if (!el) return;
  const width = Math.max(320, Math.floor(el.clientWidth));
  mapSize.value = { width, height: Math.round(width * 0.45) };
}

function destroyAnimation() {
  animationController?.destroy();
  animationController = null;
  playing.value = false;
}

function setupAnimation() {
  destroyAnimation();
  const fullPoints = props.routePath?.fullPoints ?? [];
  if (fullPoints.length < 2) {
    animatedPolylinePoints.value = fullPoints;
    travelerPoint.value = fullPoints[0] ?? null;
    return;
  }

  animationController = createRoutePathAnimation({
    fullPoints,
    durationMs: props.durationMs,
    onPolylineUpdate(points) {
      animatedPolylinePoints.value = points;
    },
    onMarkerUpdate(point) {
      travelerPoint.value = point;
    },
    onComplete() {
      playing.value = false;
    },
  });

  if (props.autoPlay) {
    playing.value = true;
    animationController.play();
  }
}

function handleTogglePlay() {
  if (!animationController) return;
  if (playing.value) {
    animationController.pause();
    playing.value = false;
  } else {
    animationController.play();
    playing.value = true;
  }
}

function handleReplay() {
  if (!animationController) return;
  playing.value = true;
  animationController.restart();
}

watch(
  () => props.routePath,
  () => {
    setupAnimation();
  },
  { immediate: true },
);

onMounted(() => {
  syncMapSize();
  if (typeof ResizeObserver !== 'undefined' && mapWrapRef.value) {
    resizeObserver = new ResizeObserver(() => syncMapSize());
    resizeObserver.observe(mapWrapRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  destroyAnimation();
});
</script>
