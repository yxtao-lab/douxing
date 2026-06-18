import { computed, onMounted, ref, watch } from 'vue';
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

function readVisibleSetting(): boolean {
  try {
    const raw = uni.getStorageSync(PET_COMPANION_VISIBLE_STORAGE_KEY) as string;
    return isPetCompanionVisibleEnabled(raw);
  } catch {
    return true;
  }
}

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

function persistBallPosition(pos: PetCompanionBallPosition) {
  try {
    uni.setStorageSync(PET_COMPANION_BALL_POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function usePetCompanion() {
  const companionEnabled = ref(readVisibleSetting());
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
    () => companionEnabled.value && isLoggedIn.value && ready.value && !isAiPlanLoading(),
  );

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

  function updateBallPosition(pos: PetCompanionBallPosition) {
    ballPosition.value = pos;
    persistBallPosition(pos);
  }

  function setCompanionEnabled(enabled: boolean) {
    companionEnabled.value = enabled;
    try {
      uni.setStorageSync(PET_COMPANION_VISIBLE_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
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
    companionEnabled,
  };
}
