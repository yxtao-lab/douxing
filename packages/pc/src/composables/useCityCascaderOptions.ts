import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import {
  buildCityCascaderOptions,
  type CheckInInfo,
  type DynamicCityEntry,
  DEFAULT_LOCALE,
  isLocaleCode,
} from '@douxing/shared';
import { useLocale } from '@/i18n/useLocale';

function collectDynamicCities(items: CheckInInfo[]): DynamicCityEntry[] {
  return items.map((item) => ({
    cityCode: item.cityCode ?? '',
    cityName: item.city,
  }));
}

export function useCityCascaderOptions(items: MaybeRefOrGetter<CheckInInfo[]>) {
  const { currentLocale } = useLocale();

  return computed(() => {
    const code = isLocaleCode(currentLocale.value) ? currentLocale.value : DEFAULT_LOCALE;
    return buildCityCascaderOptions(code, collectDynamicCities(toValue(items)));
  });
}
