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

export async function fetchRoles() {
  return getData<RoleRow[]>('/system/roles');
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

export async function fetchMenusTree(name?: string) {
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return getData<MenuRow[]>(`/system/menus${q}`);
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

export async function fetchDepts() {
  return getData<DeptRow[]>('/system/depts');
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

export async function fetchPostsPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<PostRow>>>(
    `/system/posts?page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
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

export async function fetchNoticesPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<NoticeRow>>>(
    `/system/notices?page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
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

export async function fetchConfigs() {
  return getData<ConfigRow[]>('/system/config');
}

export async function updateConfig(id: number, configValue: string, remark?: string) {
  await http.put(`/system/config/${id}`, { configValue, remark });
}

export async function fetchOperLogsPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<OperLogRow>>>(
    `/system/logs/oper?page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function fetchLoginLogsPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<LoginLogRow>>>(
    `/system/logs/login?page=${page}&pageSize=${pageSize}`,
  );
  return normalizePaginatedResult(data.data, { page, pageSize });
}

export async function fetchOnlineUsers() {
  return getData<OnlineUserRow[]>('/system/monitor/online');
}

export async function fetchScheduledJobs() {
  return getData<ScheduledJobRow[]>('/system/monitor/jobs');
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
