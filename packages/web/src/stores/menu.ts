import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ApiRequestError } from '@/api/http';
import { fetchNavMenuTree, type NavMenuNode } from '@/api/system';

/** 侧栏菜单树加载结果。 */
export type MenuLoadResult = 'ok' | 'auth' | 'forbidden' | 'error';

/**
 * 根据 HTTP 错误解析菜单加载结果。
 *
 * @param error - 捕获的异常
 * @returns `auth` / `forbidden` / `error`
 */
function resolveMenuLoadResult(error: unknown): MenuLoadResult {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'auth';
    if (error.status === 403) return 'forbidden';
  }
  return 'error';
}

export const useMenuStore = defineStore('menu', () => {
  const navTree = ref<NavMenuNode[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const loadError = ref(false);

  /**
   * 拉取当前用户可访问的侧栏菜单树。
   *
   * @param force - 为 `true` 时忽略已加载缓存并强制刷新
   * @returns 加载结果；`ok` 表示成功写入 `navTree`
   */
  async function loadNavTree(force = false): Promise<MenuLoadResult> {
    if (loading.value) return loaded.value ? 'ok' : 'error';
    if (loaded.value && !force) return 'ok';
    loading.value = true;
    loadError.value = false;
    try {
      navTree.value = await fetchNavMenuTree();
      loaded.value = true;
      return 'ok';
    } catch (error) {
      navTree.value = [];
      loaded.value = false;
      const result = resolveMenuLoadResult(error);
      loadError.value = result === 'error';
      return result;
    } finally {
      loading.value = false;
    }
  }

  /** 清空侧栏菜单缓存与加载状态。 */
  function clearNavTree() {
    navTree.value = [];
    loaded.value = false;
    loading.value = false;
    loadError.value = false;
  }

  return { navTree, loaded, loading, loadError, loadNavTree, clearNavTree };
});
