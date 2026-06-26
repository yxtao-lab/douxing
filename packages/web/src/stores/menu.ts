import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchNavMenuTree, type NavMenuNode } from '@/api/system';

export const useMenuStore = defineStore('menu', () => {
  const navTree = ref<NavMenuNode[]>([]);
  const loaded = ref(false);
  const loading = ref(false);

  async function loadNavTree(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    try {
      navTree.value = await fetchNavMenuTree();
      loaded.value = true;
    } catch {
      navTree.value = [];
      loaded.value = false;
    } finally {
      loading.value = false;
    }
  }

  function clearNavTree() {
    navTree.value = [];
    loaded.value = false;
    loading.value = false;
  }

  return { navTree, loaded, loading, loadNavTree, clearNavTree };
});
