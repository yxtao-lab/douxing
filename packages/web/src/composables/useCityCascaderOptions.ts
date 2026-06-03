import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  buildCityCascaderOptions,
  type CheckInInfo,
  type DynamicCityEntry,
  DEFAULT_LOCALE,
  isLocaleCode,
} from '@douxing/shared';

function collectDynamicCities(items: CheckInInfo[]): DynamicCityEntry[] {
  return items.map((item) => ({
    cityCode: item.cityCode ?? '',
    cityName: item.city,
  }));
}

export function useCityCascaderOptions(items: MaybeRefOrGetter<CheckInInfo[]>) {
  const { locale } = useI18n();

  return computed(() => {
    const code = isLocaleCode(locale.value) ? locale.value : DEFAULT_LOCALE;
    return buildCityCascaderOptions(code, collectDynamicCities(toValue(items)));
  });
}
