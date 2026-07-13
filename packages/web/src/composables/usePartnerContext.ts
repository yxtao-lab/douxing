import { ref } from 'vue';
import type { MarketplacePartnerContext } from '@douxing/shared';
import { fetchPartnerContext } from '@/api/marketplace-partner';

const context = ref<MarketplacePartnerContext | null>(null);
const loading = ref(false);
const loaded = ref(false);

/**
 * 订阅并刷新商户工作台上下文（入驻状态、可报价身份）。
 *
 * @returns `context` 上下文；`loading` 加载中；`reload` 手动刷新
 */
export function usePartnerContext() {
  /**
   * 从服务端拉取最新上下文。
   *
   * @returns 无返回值；结果写入 `context`
   */
  async function reload() {
    loading.value = true;
    try {
      context.value = await fetchPartnerContext();
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { context, loading, loaded, reload };
}
