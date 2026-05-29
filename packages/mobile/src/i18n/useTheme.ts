import { computed, ref } from 'vue';
import { useTf } from './useTf';

export type AppThemeId = 'blue' | 'teal';

export const THEME_STORAGE_KEY = 'douxing_app_theme';

const themeId = ref<AppThemeId>(readStoredTheme());

function readStoredTheme(): AppThemeId {
  try {
    const stored = uni.getStorageSync(THEME_STORAGE_KEY);
    if (stored === 'teal') return 'teal';
  } catch {
    /* ignore */
  }
  return 'blue';
}

function syncDomThemeClass(id: AppThemeId) {
  // #ifdef H5
  try {
    document.documentElement.classList.toggle('theme-teal', id === 'teal');
    document.body?.classList.toggle('theme-teal', id === 'teal');
  } catch {
    /* ignore */
  }
  // #endif
}

export function initAppTheme() {
  themeId.value = readStoredTheme();
  syncDomThemeClass(themeId.value);
}

export function useTheme() {
  const { t } = useTf();

  const themeClass = computed(() => (themeId.value === 'teal' ? 'theme-teal' : ''));

  const themeLabel = computed(() =>
    themeId.value === 'teal' ? t('profile.themeTeal') : t('profile.themeBlue'),
  );

  function setTheme(id: AppThemeId) {
    if (themeId.value === id) return;
    themeId.value = id;
    try {
      uni.setStorageSync(THEME_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    syncDomThemeClass(id);
  }

  function showThemePicker() {
    uni.showActionSheet({
      itemList: [t('profile.themeBlue'), t('profile.themeTeal')],
      success: (res) => {
        setTheme(res.tapIndex === 1 ? 'teal' : 'blue');
      },
    });
  }

  return {
    themeId,
    themeClass,
    themeLabel,
    setTheme,
    showThemePicker,
  };
}
