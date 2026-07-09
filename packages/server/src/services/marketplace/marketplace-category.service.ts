import {
  SERVICE_CATEGORY_TREE,
  type ServiceCategoryNode,
} from '@douxing/shared';

/**
 * 返回模块 B 预置服务类目树（来自 shared 常量）。
 *
 * @returns 一级类目及其子类目节点列表
 */
export function listServiceCategories(): ServiceCategoryNode[] {
  return SERVICE_CATEGORY_TREE;
}
