import { computed, onMounted, ref, watch } from 'vue';
import { onHide, onShow, onUnload } from '@dcloudio/uni-app';
import {
  isPetCompanionVisibleEnabled,
  PET_COMPANION_BALL_POSITION_STORAGE_KEY,
  PET_COMPANION_VISIBLE_STORAGE_KEY,
  resolveTravelPetAmbientBubble,
  resolveTravelPetFloatingSheetViewModel,
  resolveTravelPetSpeciesEmoji,
  type PetCompanionBallPosition,
  type TravelPetFloatingSheetViewModel,
} from '@douxing/shared';
import { fetchTravelPetFloatingContext } from '@/api/pets';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { getStoredToken, getStoredUser } from '@/utils/auth-storage';
import { isAiPlanLoading } from '@/utils/ai-plan-loading';

const DEFAULT_BALL: PetCompanionBallPosition = { x: 0, y: 0 };

/** 全站共享：用户是否开启旅行伙伴浮球 */
const companionEnabled = ref(readVisibleSetting());

/** 全站共享：当前页面是否临时隐藏浮球（如定制服务表单页） */
const routeSuppressed = ref(false);

/**
 * 读取本地存储的浮球显示偏好。
 *
 * @returns 是否显示浮球；未设置时移动端默认 false（隐藏）
 */
function readVisibleSetting(): boolean {
  try {
    const raw = uni.getStorageSync(PET_COMPANION_VISIBLE_STORAGE_KEY) as string;
    if (!raw) return false;
    return isPetCompanionVisibleEnabled(raw);
  } catch {
    return false;
  }
}

/**
 * 读取本地持久化的浮球坐标。
 *
 * @returns 视口内 px 坐标；无记录时返回默认右下角锚点
 */
function readBallPosition(): PetCompanionBallPosition {
  try {
    const raw = uni.getStorageSync(PET_COMPANION_BALL_POSITION_STORAGE_KEY) as string;
    if (!raw) return { ...DEFAULT_BALL };
    const parsed = JSON.parse(raw) as PetCompanionBallPosition;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_BALL };
}

/**
 * 将浮球坐标写入本地存储。
 *
 * @param pos - 视口内 px 坐标
 */
function persistBallPosition(pos: PetCompanionBallPosition) {
  try {
    uni.setStorageSync(PET_COMPANION_BALL_POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

/**
 * 订阅旅行伙伴浮层状态（全站单例，多组件实例共享显示/隐藏）。
 *
 * @returns 浮层可见性、面板状态与操作方法
 */
export function usePetCompanion() {
  const sheetOpen = ref(false);
  const loading = ref(false);
  const ready = ref(false);
  const showBubble = ref(true);
  const ballPosition = ref<PetCompanionBallPosition>(readBallPosition());
  const ambientBubble = ref('');
  const speciesEmoji = ref('🦊');
  const sheetViewModel = ref<TravelPetFloatingSheetViewModel | null>(null);

  const isLoggedIn = computed(() => Boolean(getStoredToken() && getStoredUser()));
  const visible = computed(
    () =>
      companionEnabled.value &&
      !routeSuppressed.value &&
      isLoggedIn.value &&
      ready.value &&
      !isAiPlanLoading(),
  );

  /**
   * 拉取旅行伙伴浮层上下文并刷新展示数据。
   */
  async function refreshContext() {
    if (!isLoggedIn.value) {
      ready.value = false;
      return;
    }
    loading.value = true;
    try {
      const ctx = await fetchTravelPetFloatingContext();
      const locale = getApiAcceptLanguage();
      speciesEmoji.value = resolveTravelPetSpeciesEmoji(ctx.pet.species);
      ambientBubble.value = resolveTravelPetAmbientBubble(
        ctx.pet,
        ctx.petMeta,
        locale,
        ctx.prePlanAnalyze,
      );
      sheetViewModel.value = resolveTravelPetFloatingSheetViewModel(ctx.pet, ctx.petMeta, locale);
      ready.value = true;
    } catch {
      ready.value = false;
    } finally {
      loading.value = false;
    }
  }

  function openSheet() {
    sheetOpen.value = true;
    showBubble.value = false;
  }

  function closeSheet() {
    sheetOpen.value = false;
    showBubble.value = true;
  }

  function goPlan() {
    closeSheet();
    uni.switchTab({ url: '/pages/plan/plan' });
  }

  function goMemoryWall() {
    closeSheet();
    uni.navigateTo({ url: '/pages/profile/pet-memories' });
  }

  async function triggerPrePlanAnalyze() {
    closeSheet();
    uni.navigateTo({ url: '/pages/profile/pet-memories?analyze=1' });
  }

  /**
   * 更新浮球拖拽坐标并持久化。
   *
   * @param pos - 视口内 px 坐标
   */
  function updateBallPosition(pos: PetCompanionBallPosition) {
    ballPosition.value = pos;
    persistBallPosition(pos);
  }

  /**
   * 设置全站浮球显示开关并写入本地存储。
   *
   * @param enabled - true 显示；false 隐藏直至用户重新开启
   */
  function setCompanionEnabled(enabled: boolean) {
    companionEnabled.value = enabled;
    if (!enabled) {
      sheetOpen.value = false;
      showBubble.value = true;
    }
    try {
      uni.setStorageSync(PET_COMPANION_VISIBLE_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  /**
   * 隐藏旅行伙伴浮球（写入本地偏好，全站生效）。
   */
  function hideCompanion() {
    setCompanionEnabled(false);
  }

  onMounted(() => {
    void refreshContext();
  });

  watch(isLoggedIn, (loggedIn) => {
    if (loggedIn) void refreshContext();
    else ready.value = false;
  });

  return {
    visible,
    loading,
    sheetOpen,
    showBubble,
    ballPosition,
    ambientBubble,
    speciesEmoji,
    sheetViewModel,
    openSheet,
    closeSheet,
    goPlan,
    goMemoryWall,
    triggerPrePlanAnalyze,
    refreshContext,
    updateBallPosition,
    setCompanionEnabled,
    hideCompanion,
    companionEnabled,
  };
}

/**
 * 在当前页面显示期间临时隐藏旅行伙伴浮球（离开页面后恢复）。
 * 适用于定制服务等表单密集页面，避免浮球遮挡操作。
 */
export function useSuppressPetFloatingOnPage() {
  onShow(() => {
    routeSuppressed.value = true;
  });

  onHide(() => {
    routeSuppressed.value = false;
  });

  onUnload(() => {
    routeSuppressed.value = false;
  });
}
