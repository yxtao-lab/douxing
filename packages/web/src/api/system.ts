import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type PaginatedResult,
} from '@douxing/shared';

export interface AdminUserRow {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  email: string | null;
  status: number;
  roles: string[];
  createdAt: string;
}

export interface RoleRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
}

export interface DeptRow {
  id: number;
  parentId: number;
  name: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}

export interface PostRow {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  status: number;
  remark: string | null;
  createdAt: string;
}

export interface DictTypeRow {
  id: number;
  dictType: string;
  dictName: string;
  status: number;
  remark: string | null;
  createdAt: string;
}

export interface DictDataRow {
  id: number;
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sortOrder: number;
  status: number;
  remark: string | null;
}

export interface NoticeRow {
  id: number;
  title: string;
  noticeType: number;
  status: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigRow {
  id: number;
  configKey: string;
  configValue: string;
  remark: string | null;
  updatedAt: string;
}

export interface OperLogRow {
  id: number;
  title: string;
  operName: string;
  operUrl: string;
  method: string;
  operIp: string | null;
  status: number;
  operTime: string;
}

export interface LoginLogRow {
  id: number;
  username: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  status: number;
  msg: string | null;
  loginTime: string;
}

export interface ApiLogRow {
  id: number;
  traceId: string | null;
  operName: string;
  requestUrl: string;
  method: string;
  apiModuleKey: string;
  apiDescKey: string;
  requestParams: string | null;
  responseBody: string | null;
  statusCode: number;
  operIp: string | null;
  costTime: number;
  status: number;
  errorMsg: string | null;
  requestTime: string;
}

export interface MenuRow {
  id: number;
  parentId: number;
  menuKey: string;
  menuName: string;
  menuType: number;
  path: string | null;
  component: string | null;
  perms: string | null;
  icon: string | null;
  sortOrder: number;
  isFrame: number;
  visible: number;
  status: number;
  routeParams: string | null;
  remark: string | null;
  children?: MenuRow[];
}

/** S2 · 侧栏导航菜单树（按当前用户 role_menu 过滤） */
export interface NavMenuNode {
  menuKey: string;
  menuName: string;
  path?: string;
  icon?: string;
  children?: NavMenuNode[];
}

/** @deprecated 使用 MenuRow */
export interface MenuTreeNode {
  key: string;
  title: string;
  path?: string;
  children?: MenuTreeNode[];
}

export interface OnlineUserRow {
  userId: number;
  username: string;
  nickname: string;
  ip: string;
  loginTime: string;
  lastActive: string;
}

export interface ScheduledJobRow {
  id: string;
  name: string;
  cron: string;
  status: string;
  remark: string;
}

async function getData<T>(url: string) {
  const { data } = await http.get<ApiResponse<T>>(url);
  return data.data as T;
}

export async function fetchAdminUsersPage(page: number, pageSize: number, keyword?: string) {
  const q = keyword ? `&keyword=${encodeURIComponent(keyword)}` : '';
  const { data } = await http.get<ApiResponse<PaginatedResult<AdminUserRow>>>(
    `/system/users?page=${page}&pageSize=${pageSize}${q}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function updateUserStatus(id: number, status: number) {
  await http.patch(`/system/users/${id}/status`, { status });
}

export async function updateUserRoles(id: number, roleCodes: string[]) {
  await http.put(`/system/users/${id}/roles`, { roleCodes });
}

export async function resetUserPassword(id: number, password: string) {
  await http.post(`/system/users/${id}/reset-password`, { password });
}

export async function fetchRoles(filters?: { keyword?: string }) {
  const query = new URLSearchParams();
  if (filters?.keyword) query.set('keyword', filters.keyword);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return getData<RoleRow[]>(`/system/roles${suffix}`);
}

export async function createRole(body: { code: string; name: string; description?: string }) {
  await http.post('/system/roles', body);
}

export async function updateRole(id: number, body: { name?: string; description?: string }) {
  await http.put(`/system/roles/${id}`, body);
}

export async function deleteRole(id: number) {
  await http.delete(`/system/roles/${id}`);
}

export async function fetchRoleMenus(roleId: number) {
  return getData<{ menuIds: number[] }>(`/system/roles/${roleId}/menus`);
}

export async function updateRoleMenus(roleId: number, menuIds: number[]) {
  await http.put(`/system/roles/${roleId}/menus`, { menuIds });
}

export async function fetchMenusTree(name?: string) {
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return getData<MenuRow[]>(`/system/menus${q}`);
}

/** S2 · 当前用户可访问的侧栏菜单树 */
export async function fetchNavMenuTree() {
  return getData<NavMenuNode[]>('/system/menus/tree');
}

/** @deprecated 使用 fetchMenusTree */
export async function fetchMenuTree(name?: string) {
  return fetchMenusTree(name);
}

export async function fetchMenuDetail(id: number) {
  return getData<MenuRow>(`/system/menus/${id}`);
}

export async function createMenu(body: {
  parentId: number;
  menuKey: string;
  menuName: string;
  menuType?: number;
  path?: string | null;
  component?: string | null;
  perms?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isFrame?: number;
  visible?: number;
  status?: number;
  routeParams?: string | null;
  remark?: string | null;
}) {
  await http.post('/system/menus', body);
}

export async function updateMenu(
  id: number,
  body: Partial<Omit<MenuRow, 'id' | 'children' | 'menuKey'>>,
) {
  await http.put(`/system/menus/${id}`, body);
}

export async function deleteMenu(id: number) {
  await http.delete(`/system/menus/${id}`);
}

export async function fetchDepts(filters?: {
  keyword?: string;
  status?: number;
  parentId?: number;
}) {
  const query = new URLSearchParams();
  if (filters?.keyword) query.set('keyword', filters.keyword);
  if (filters?.status != null) query.set('status', String(filters.status));
  if (filters?.parentId != null) query.set('parentId', String(filters.parentId));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return getData<DeptRow[]>(`/system/depts${suffix}`);
}

export async function createDept(body: Partial<DeptRow>) {
  await http.post('/system/depts', body);
}

export async function updateDept(id: number, body: Partial<DeptRow>) {
  await http.put(`/system/depts/${id}`, body);
}

export async function deleteDept(id: number) {
  await http.delete(`/system/depts/${id}`);
}

export async function fetchPostsPage(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: number;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status != null) query.set('status', String(params.status));
  const { data } = await http.get<ApiResponse<PaginatedResult<PostRow>>>(
    `/system/posts?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export async function createPost(body: {
  code: string;
  name: string;
  sortOrder?: number;
  status?: number;
  remark?: string;
}) {
  await http.post('/system/posts', body);
}

export async function updatePost(id: number, body: Partial<PostRow>) {
  await http.put(`/system/posts/${id}`, body);
}

export async function deletePost(id: number) {
  await http.delete(`/system/posts/${id}`);
}

export async function fetchDictTypes() {
  return getData<DictTypeRow[]>('/system/dict/types');
}

export async function fetchDictData(dictType?: string) {
  const q = dictType ? `?dictType=${encodeURIComponent(dictType)}` : '';
  return getData<DictDataRow[]>(`/system/dict/data${q}`);
}

export async function createDictType(body: Partial<DictTypeRow>) {
  await http.post('/system/dict/types', body);
}

export async function updateDictType(id: number, body: Partial<DictTypeRow>) {
  await http.put(`/system/dict/types/${id}`, body);
}

export async function deleteDictType(id: number) {
  await http.delete(`/system/dict/types/${id}`);
}

export async function createDictData(body: Partial<DictDataRow>) {
  await http.post('/system/dict/data', body);
}

export async function updateDictData(id: number, body: Partial<DictDataRow>) {
  await http.put(`/system/dict/data/${id}`, body);
}

export async function deleteDictData(id: number) {
  await http.delete(`/system/dict/data/${id}`);
}

export async function fetchNoticesPage(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  noticeType?: number;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.noticeType != null) query.set('noticeType', String(params.noticeType));
  if (params.status != null) query.set('status', String(params.status));
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
  const { data } = await http.get<ApiResponse<PaginatedResult<NoticeRow>>>(
    `/system/notices?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export async function createNotice(body: Partial<NoticeRow>) {
  await http.post('/system/notices', body);
}

export async function updateNotice(id: number, body: Partial<NoticeRow>) {
  await http.put(`/system/notices/${id}`, body);
}

export async function deleteNotice(id: number) {
  await http.delete(`/system/notices/${id}`);
}

export async function fetchConfigs(filters?: { keyword?: string }) {
  const query = new URLSearchParams();
  if (filters?.keyword) query.set('keyword', filters.keyword);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return getData<ConfigRow[]>(`/system/config${suffix}`);
}

export async function updateConfig(id: number, configValue: string, remark?: string) {
  await http.put(`/system/config/${id}`, { configValue, remark });
}

export interface AdminOperLogListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  operName?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

export interface AdminLoginLogListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

export interface AdminApiLogListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  operName?: string;
  method?: string;
  moduleKey?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

function appendLogQuery(
  query: URLSearchParams,
  params: AdminOperLogListParams | AdminLoginLogListParams | AdminApiLogListParams,
) {
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status != null) query.set('status', String(params.status));
  if (params.dateStart) query.set('dateStart', params.dateStart);
  if (params.dateEnd) query.set('dateEnd', params.dateEnd);
}

export async function fetchOperLogsPage(params: AdminOperLogListParams) {
  const query = new URLSearchParams();
  appendLogQuery(query, params);
  if (params.operName) query.set('operName', params.operName);
  const { data } = await http.get<ApiResponse<PaginatedResult<OperLogRow>>>(
    `/system/logs/oper?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export async function fetchLoginLogsPage(params: AdminLoginLogListParams) {
  const query = new URLSearchParams();
  appendLogQuery(query, params);
  const { data } = await http.get<ApiResponse<PaginatedResult<LoginLogRow>>>(
    `/system/logs/login?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export async function fetchApiLogsPage(params: AdminApiLogListParams) {
  const query = new URLSearchParams();
  appendLogQuery(query, params);
  if (params.method) query.set('method', params.method);
  if (params.operName) query.set('operName', params.operName);
  if (params.moduleKey) query.set('moduleKey', params.moduleKey);
  const { data } = await http.get<ApiResponse<PaginatedResult<ApiLogRow>>>(
    `/system/logs/api?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, { page: params.page, pageSize: params.pageSize });
}

export async function fetchOnlineUsers(filters?: { keyword?: string }) {
  const query = new URLSearchParams();
  if (filters?.keyword) query.set('keyword', filters.keyword);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return getData<OnlineUserRow[]>(`/system/monitor/online${suffix}`);
}

export async function fetchScheduledJobs(filters?: { keyword?: string; status?: string }) {
  const query = new URLSearchParams();
  if (filters?.keyword) query.set('keyword', filters.keyword);
  if (filters?.status) query.set('status', filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return getData<ScheduledJobRow[]>(`/system/monitor/jobs${suffix}`);
}

export async function fetchDataMonitor() {
  return getData<Record<string, unknown>>('/system/monitor/data');
}

export async function fetchServerMonitor() {
  return getData<Record<string, unknown>>('/system/monitor/server');
}

export async function fetchCacheMonitor() {
  return getData<Record<string, unknown>>('/system/monitor/cache');
}

export async function fetchCacheKeys(pattern = '*', limit = 100) {
  return getData<string[]>(
    `/system/monitor/cache/keys?pattern=${encodeURIComponent(pattern)}&limit=${limit}`,
  );
}

export async function deleteCacheKey(key: string) {
  await http.delete('/system/monitor/cache/keys', { data: { key } });
}
