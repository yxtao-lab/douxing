import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
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
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';

const DEFAULT_BALL: PetCompanionBallPosition = { x: 24, y: 96 };

function readVisibleSetting(): boolean {
  try {
    return isPetCompanionVisibleEnabled(localStorage.getItem(PET_COMPANION_VISIBLE_STORAGE_KEY));
  } catch {
    return true;
  }
}

function readBallPosition(): PetCompanionBallPosition {
  try {
    const raw = localStorage.getItem(PET_COMPANION_BALL_POSITION_STORAGE_KEY);
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
    localStorage.setItem(PET_COMPANION_BALL_POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function usePetCompanion() {
  const router = useRouter();
  const userStore = useUserStore();
  const { currentLocale } = useLocale();

  const companionEnabled = ref(readVisibleSetting());
  const sheetOpen = ref(false);
  const loading = ref(false);
  const ready = ref(false);
  const showBubble = ref(true);
  const ballPosition = ref<PetCompanionBallPosition>(readBallPosition());
  const ambientBubble = ref('');
  const speciesEmoji = ref('🦊');
  const sheetViewModel = ref<TravelPetFloatingSheetViewModel | null>(null);

  const isLoggedIn = computed(() => Boolean(userStore.token && userStore.user));
  const visible = computed(() => companionEnabled.value && isLoggedIn.value && ready.value);

  async function refreshContext() {
    if (!isLoggedIn.value) {
      ready.value = false;
      return;
    }
    loading.value = true;
    try {
      const ctx = await fetchTravelPetFloatingContext();
      speciesEmoji.value = resolveTravelPetSpeciesEmoji(ctx.pet.species);
      ambientBubble.value = resolveTravelPetAmbientBubble(ctx.pet, ctx.petMeta, currentLocale.value);
      sheetViewModel.value = resolveTravelPetFloatingSheetViewModel(
        ctx.pet,
        ctx.petMeta,
        currentLocale.value,
      );
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
    router.push({ name: 'plan' });
  }

  function updateBallPosition(pos: PetCompanionBallPosition) {
    ballPosition.value = pos;
    persistBallPosition(pos);
  }

  function setCompanionEnabled(enabled: boolean) {
    companionEnabled.value = enabled;
    try {
      localStorage.setItem(PET_COMPANION_VISIBLE_STORAGE_KEY, enabled ? '1' : '0');
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

  watch(currentLocale, () => {
    if (ready.value) void refreshContext();
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
    refreshContext,
    updateBallPosition,
    setCompanionEnabled,
    companionEnabled,
  };
}
