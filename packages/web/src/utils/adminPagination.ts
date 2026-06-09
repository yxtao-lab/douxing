import type { TablePaginationConfig } from 'ant-design-vue/es/table';
import { DEFAULT_PAGE_SIZE } from '@douxing/shared';

/** 管理端表格默认每页条数选项 */
export const ADMIN_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'] as const;

export type AdminPaginationInput = false | TablePaginationConfig | undefined;

export type AdminPaginationOverrides = Partial<
  Pick<
    TablePaginationConfig,
    | 'current'
    | 'pageSize'
    | 'total'
    | 'showSizeChanger'
    | 'showQuickJumper'
    | 'hideOnSinglePage'
    | 'showLessItems'
    | 'pageSizeOptions'
    | 'showTotal'
  >
>;

/** 构建管理端表格分页配置（跳转页码、省略号、每页条数等） */
export function createAdminPaginationConfig(
  overrides: AdminPaginationOverrides = {},
  showTotalFn?: (total: number, range: [number, number]) => string,
): TablePaginationConfig {
  return {
    pageSize: DEFAULT_PAGE_SIZE,
    showSizeChanger: true,
    showQuickJumper: true,
    showLessItems: false,
    pageSizeOptions: [...ADMIN_PAGE_SIZE_OPTIONS],
    hideOnSinglePage: false,
    ...overrides,
    showTotal: overrides.showTotal ?? showTotalFn,
  };
}

/** 客户端分页（无 current/total，仅样式与选项统一） */
export function createClientAdminPaginationConfig(
  overrides: AdminPaginationOverrides = {},
  showTotalFn?: (total: number, range: [number, number]) => string,
): TablePaginationConfig {
  return createAdminPaginationConfig(
    {
      showSizeChanger: overrides.showSizeChanger ?? true,
      ...overrides,
    },
    showTotalFn,
  );
}

/** 合并传入的分页对象与默认配置 */
export function mergeAdminPagination(
  input: AdminPaginationInput,
  showTotalFn?: (total: number, range: [number, number]) => string,
): false | TablePaginationConfig {
  if (input === false || input == null) return false;
  return createAdminPaginationConfig(input, showTotalFn);
}
