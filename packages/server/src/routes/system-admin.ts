import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey, ApiError } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requirePerm, requireStaff } from '../middleware/admin.middleware.js';
import { success, fail } from '../utils/response.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  parseDateRangeFilter,
  parseOptionalInt,
  parseOptionalString,
} from '../utils/admin-list-filter.js';
import { recordOperLogFromRequest } from '../services/sys-log.service.js';
import {
  listAdminUsersPaginated,
  updateAdminUserStatus,
  updateAdminUserRoles,
  resetAdminUserPassword,
  listRolesWithStats,
  createRole,
  updateRole,
  deleteRole,
  listDepts,
  createDept,
  updateDept,
  deleteDept,
  listPostsPaginated,
  createPost,
  updatePost,
  deletePost,
  listDictTypes,
  createDictType,
  updateDictType,
  deleteDictType,
  listDictData,
  createDictData,
  updateDictData,
  deleteDictData,
  listNoticesPaginated,
  createNotice,
  updateNotice,
  deleteNotice,
  listConfigs,
  updateConfig,
  listOperLogsPaginated,
  listLoginLogsPaginated,
  listApiLogsPaginated,
  getMenuTree,
  getNavMenuTreeForUser,
  listMenusTree,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
  getRoleMenuIds,
  updateRoleMenus,
  getOnlineUsers,
  getScheduledJobs,
  getDataMonitorStats,
  getServerMonitorInfo,
  getCacheMonitorStats,
  listCacheKeys,
  deleteCacheKey,
} from '../services/sys-admin.service.js';
import { listAiServiceLogsPaginated } from '../services/ai-service-log.service.js';
import {
  getSiteStatusSummary,
  setSiteOnline,
} from '../services/site-status.service.js';
import {
  listMembershipProducts,
  listMembershipUsersForAdminPaginated,
  listMembershipLogsForAdminPaginated,
  updateMembershipByAdmin,
} from '../services/membership.service.js';

const router = Router();

const AdminPerm = {
  systemUser: 'system:user:list',
  systemRole: 'system:role:list',
  systemMenu: 'system:menu:list',
  systemDept: 'system:dept:list',
  systemPost: 'system:post:list',
  systemDict: 'system:dict:list',
  systemConfig: 'system:config:list',
  systemNotice: 'system:notice:list',
  monitorOnline: 'monitor:online:list',
  monitorJob: 'monitor:job:list',
  monitorData: 'monitor:data:view',
  monitorServer: 'monitor:server:view',
  monitorCache: 'monitor:cache:view',
  monitorCacheList: 'monitor:cache:list',
  logOper: 'log:oper:list',
  logLogin: 'log:login:list',
  logApi: 'log:api:list',
  logAiService: 'log:ai-service:list',
  membershipUsers: 'biz:membership:users',
  membershipLogs: 'biz:membership:logs',
  membershipProducts: 'biz:membership:products',
} as const;

router.use(authMiddleware);

async function withPermWrite(
  req: import('express').Request,
  res: import('express').Response,
  perm: string,
  title: string,
  handler: () => Promise<unknown>,
) {
  if (!(await requirePerm(req, res, perm))) return;
  try {
    const result = await handler();
    void recordOperLogFromRequest(req, title).catch((err) => {
      console.warn('[system] 操作日志写入失败:', err);
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '操作失败';
    void recordOperLogFromRequest(req, title, 0, msg).catch((logErr) => {
      console.warn('[system] 操作日志写入失败:', logErr);
    });
    throw err;
  }
}

router.get('/users', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemUser))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
    const result = await listAdminUsersPaginated(page, pageSize, keyword || undefined);
    success(res, result);
  } catch (err) {
    console.error('[system/users]', err);
    fail(res, '获取用户列表失败', 500, 500);
  }
});

router.patch('/users/:id/status', async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const parsed = z.object({ status: z.number().int().min(0).max(1) }).safeParse(req.body);
    if (Number.isNaN(userId) || !parsed.success) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemUser, '修改用户状态', () =>
      updateAdminUserStatus(userId, parsed.data.status),
    );
    if (result === undefined) return;
    success(res, result, '状态已更新');
  } catch (err) {
    console.error('[system/users/status]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.put('/users/:id/roles', async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const parsed = z.object({ roleCodes: z.array(z.string().min(1)) }).safeParse(req.body);
    if (Number.isNaN(userId) || !parsed.success) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemUser, '分配用户角色', () =>
      updateAdminUserRoles(userId, parsed.data.roleCodes),
    );
    if (result === undefined) return;
    success(res, result, '角色已更新');
  } catch (err) {
    console.error('[system/users/roles]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        password: z
          .string()
          .min(12, ApiMessageKey.ADMIN_PASSWORD_TOO_WEAK)
          .max(64)
          .regex(/[a-z]/, ApiMessageKey.ADMIN_PASSWORD_TOO_WEAK)
          .regex(/[A-Z]/, ApiMessageKey.ADMIN_PASSWORD_TOO_WEAK)
          .regex(/[0-9]/, ApiMessageKey.ADMIN_PASSWORD_TOO_WEAK),
      })
      .safeParse(req.body);
    if (Number.isNaN(userId)) return fail(res, ApiMessageKey.PARAM_ERROR);
    if (!parsed.success) {
      const passwordInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'password');
      if (passwordInvalid) return fail(res, ApiMessageKey.ADMIN_PASSWORD_TOO_WEAK, 400, 400);
      return fail(res, ApiMessageKey.PARAM_ERROR);
    }
    await withPermWrite(req, res, AdminPerm.systemUser, '重置用户密码', () =>
      resetAdminUserPassword(userId, parsed.data.password),
    );
    success(res, null, '密码已重置');
  } catch (err) {
    console.error('[system/users/reset-password]', err);
    fail(res, '重置失败', 500, 500);
  }
});

router.get('/roles', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemRole))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      await listRolesWithStats({
        keyword: parseOptionalString(query, 'keyword'),
      }),
    );
  } catch (err) {
    console.error('[system/roles]', err);
    fail(res, '获取角色失败', 500, 500);
  }
});

router.post('/roles', async (req, res) => {
  try {
    const parsed = z
      .object({
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(64),
        description: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemRole, '新增角色', () => createRole(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '角色已创建');
  } catch (err) {
    console.error('[system/roles/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/roles/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({ name: z.string().min(1).max(64).optional(), description: z.string().max(255).optional() })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemRole, '编辑角色', () => updateRole(id, parsed.data));
    success(res, null, '角色已更新');
  } catch (err) {
    console.error('[system/roles/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/roles/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemRole, '删除角色', () => deleteRole(id));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '角色已删除');
  } catch (err) {
    console.error('[system/roles/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/roles/:id/menus', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemRole))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    success(res, { menuIds: await getRoleMenuIds(id) });
  } catch (err) {
    console.error('[system/roles/menus GET]', err);
    fail(res, '获取角色菜单失败', 500, 500);
  }
});

router.put('/roles/:id/menus', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z.object({ menuIds: z.array(z.number().int().positive()) }).safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemRole, '分配角色菜单', () =>
      updateRoleMenus(id, parsed.data.menuIds),
    );
    if (result === undefined) return;
    success(res, null, '角色菜单已更新');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '更新失败';
    console.error('[system/roles/menus PUT]', err);
    fail(res, msg, 500, 500);
  }
});

router.get('/menus/tree', async (req, res) => {
  try {
    const user = await requireStaff(req, res);
    if (!user) return;
    success(res, await getNavMenuTreeForUser(user.id));
  } catch (err) {
    console.error('[system/menus/tree]', err);
    fail(res, '获取导航菜单失败', 500, 500);
  }
});

router.get('/menus', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemMenu))) return;
    const keyword = typeof req.query.name === 'string' ? req.query.name : undefined;
    success(res, await listMenusTree(keyword));
  } catch (err) {
    console.error('[system/menus]', err);
    fail(res, '获取菜单失败', 500, 500);
  }
});

router.get('/menus/:id', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemMenu))) return;
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    const menu = await getMenuById(id);
    if (!menu) return fail(res, '菜单不存在', 404, 404);
    success(res, menu);
  } catch (err) {
    console.error('[system/menus/detail]', err);
    fail(res, '获取菜单失败', 500, 500);
  }
});

router.post('/menus', async (req, res) => {
  try {
    const parsed = z
      .object({
        parentId: z.number().int().min(0),
        menuKey: z.string().min(1).max(64),
        menuName: z.string().min(1).max(64),
        menuType: z.number().int().min(1).max(3).optional(),
        path: z.string().max(128).nullable().optional(),
        component: z.string().max(128).nullable().optional(),
        perms: z.string().max(128).nullable().optional(),
        icon: z.string().max(64).nullable().optional(),
        sortOrder: z.number().int().optional(),
        isFrame: z.number().int().min(0).max(1).optional(),
        visible: z.number().int().min(0).max(1).optional(),
        status: z.number().int().min(0).max(1).optional(),
        routeParams: z.string().max(255).nullable().optional(),
        remark: z.string().max(255).nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemMenu, '新增菜单', () => createMenu(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '菜单已创建');
  } catch (err) {
    console.error('[system/menus/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/menus/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        parentId: z.number().int().min(0).optional(),
        menuName: z.string().min(1).max(64).optional(),
        menuType: z.number().int().min(1).max(3).optional(),
        path: z.string().max(128).nullable().optional(),
        component: z.string().max(128).nullable().optional(),
        perms: z.string().max(128).nullable().optional(),
        icon: z.string().max(64).nullable().optional(),
        sortOrder: z.number().int().optional(),
        isFrame: z.number().int().min(0).max(1).optional(),
        visible: z.number().int().min(0).max(1).optional(),
        status: z.number().int().min(0).max(1).optional(),
        routeParams: z.string().max(255).nullable().optional(),
        remark: z.string().max(255).nullable().optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemMenu, '编辑菜单', () => updateMenu(id, parsed.data));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '菜单已更新');
  } catch (err) {
    console.error('[system/menus/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/menus/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemMenu, '删除菜单', () => deleteMenu(id));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '菜单已删除');
  } catch (err) {
    console.error('[system/menus/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/depts', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemDept))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      await listDepts({
        keyword: parseOptionalString(query, 'keyword'),
        status: parseOptionalInt(query, 'status'),
        parentId: parseOptionalInt(query, 'parentId'),
      }),
    );
  } catch (err) {
    console.error('[system/depts]', err);
    fail(res, '获取部门失败', 500, 500);
  }
});

router.post('/depts', async (req, res) => {
  try {
    const parsed = z
      .object({
        parentId: z.number().int().min(0),
        name: z.string().min(1).max(64),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemDept, '新增部门', () => createDept(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '部门已创建');
  } catch (err) {
    console.error('[system/depts/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/depts/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        parentId: z.number().int().min(0).optional(),
        name: z.string().min(1).max(64).optional(),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemDept, '编辑部门', () => updateDept(id, parsed.data));
    success(res, null, '部门已更新');
  } catch (err) {
    console.error('[system/depts/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/depts/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemDept, '删除部门', () => deleteDept(id));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '部门已删除');
  } catch (err) {
    console.error('[system/depts/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/posts', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemPost))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    success(
      res,
      await listPostsPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        status: parseOptionalInt(query, 'status'),
      }),
    );
  } catch (err) {
    console.error('[system/posts]', err);
    fail(res, '获取岗位失败', 500, 500);
  }
});

router.post('/posts', async (req, res) => {
  try {
    const parsed = z
      .object({
        code: z.string().min(1).max(32),
        name: z.string().min(1).max(64),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemPost, '新增岗位', () => createPost(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '岗位已创建');
  } catch (err) {
    console.error('[system/posts/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        name: z.string().min(1).max(64).optional(),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemPost, '编辑岗位', () => updatePost(id, parsed.data));
    success(res, null, '岗位已更新');
  } catch (err) {
    console.error('[system/posts/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemPost, '删除岗位', () => deletePost(id));
    success(res, null, '岗位已删除');
  } catch (err) {
    console.error('[system/posts/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/dict/types', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemDict))) return;
    success(res, await listDictTypes());
  } catch (err) {
    console.error('[system/dict/types]', err);
    fail(res, '获取字典类型失败', 500, 500);
  }
});

router.post('/dict/types', async (req, res) => {
  try {
    const parsed = z
      .object({
        dictType: z.string().min(1).max(64),
        dictName: z.string().min(1).max(64),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemDict, '新增字典类型', () => createDictType(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '字典类型已创建');
  } catch (err) {
    console.error('[system/dict/types/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/dict/types/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        dictName: z.string().min(1).max(64).optional(),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemDict, '编辑字典类型', () => updateDictType(id, parsed.data));
    success(res, null, '字典类型已更新');
  } catch (err) {
    console.error('[system/dict/types/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/dict/types/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.systemDict, '删除字典类型', () => deleteDictType(id));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '字典类型已删除');
  } catch (err) {
    console.error('[system/dict/types/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/dict/data', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemDict))) return;
    const dictType = typeof req.query.dictType === 'string' ? req.query.dictType : undefined;
    success(res, await listDictData(dictType));
  } catch (err) {
    console.error('[system/dict/data]', err);
    fail(res, '获取字典数据失败', 500, 500);
  }
});

router.post('/dict/data', async (req, res) => {
  try {
    const parsed = z
      .object({
        dictType: z.string().min(1).max(64),
        dictLabel: z.string().min(1).max(64),
        dictValue: z.string().min(1).max(64),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemDict, '新增字典数据', () => createDictData(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '字典数据已创建');
  } catch (err) {
    console.error('[system/dict/data/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/dict/data/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        dictLabel: z.string().min(1).max(64).optional(),
        dictValue: z.string().min(1).max(64).optional(),
        sortOrder: z.number().int().optional(),
        status: z.number().int().min(0).max(1).optional(),
        remark: z.string().max(255).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemDict, '编辑字典数据', () => updateDictData(id, parsed.data));
    success(res, null, '字典数据已更新');
  } catch (err) {
    console.error('[system/dict/data/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/dict/data/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemDict, '删除字典数据', () => deleteDictData(id));
    success(res, null, '字典数据已删除');
  } catch (err) {
    console.error('[system/dict/data/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/notices', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemNotice))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    const { dateStart, dateEnd } = parseDateRangeFilter(query);
    success(
      res,
      await listNoticesPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        noticeType: parseOptionalInt(query, 'noticeType'),
        status: parseOptionalInt(query, 'status'),
        dateStart,
        dateEnd,
      }),
    );
  } catch (err) {
    console.error('[system/notices]', err);
    fail(res, '获取公告失败', 500, 500);
  }
});

router.post('/notices', async (req, res) => {
  try {
    const parsed = z
      .object({
        title: z.string().min(1).max(128),
        noticeType: z.number().int().min(1).max(2).optional(),
        status: z.number().int().min(0).max(1).optional(),
        content: z.string().min(1),
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const id = await withPermWrite(req, res, AdminPerm.systemNotice, '新增公告', () => createNotice(parsed.data));
    if (id === undefined) return;
    success(res, { id }, '公告已创建');
  } catch (err) {
    console.error('[system/notices/create]', err);
    fail(res, '创建失败', 500, 500);
  }
});

router.put('/notices/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        title: z.string().min(1).max(128).optional(),
        noticeType: z.number().int().min(1).max(2).optional(),
        status: z.number().int().min(0).max(1).optional(),
        content: z.string().min(1).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemNotice, '编辑公告', () => updateNotice(id, parsed.data));
    success(res, null, '公告已更新');
  } catch (err) {
    console.error('[system/notices/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemNotice, '删除公告', () => deleteNotice(id));
    success(res, null, '公告已删除');
  } catch (err) {
    console.error('[system/notices/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/config', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemConfig))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      await listConfigs({
        keyword: parseOptionalString(query, 'keyword'),
      }),
    );
  } catch (err) {
    console.error('[system/config]', err);
    fail(res, '获取参数失败', 500, 500);
  }
});

router.get('/site-status', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemConfig))) return;
    success(res, await getSiteStatusSummary());
  } catch (err) {
    console.error('[system/site-status]', err);
    fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.put('/site-status', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.systemConfig))) return;
    const parsed = z.object({ online: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return fail(res, ApiMessageKey.PARAM_ERROR);

    const summary = await setSiteOnline(parsed.data.online);
    success(res, summary, ApiMessageKey.SITE_STATUS_UPDATED);

    const logTitle = parsed.data.online ? '站点上线' : '站点下线';
    void recordOperLogFromRequest(req, logTitle).catch((err) => {
      console.warn('[system/site-status] 操作日志写入失败:', err);
    });
  } catch (err) {
    console.error('[system/site-status/update]', err);
    fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.put('/config/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({ configValue: z.string().min(0), remark: z.string().max(255).optional() })
      .safeParse(req.body);
    if (Number.isNaN(id) || !parsed.success) return fail(res, '参数错误');
    await withPermWrite(req, res, AdminPerm.systemConfig, '修改系统参数', () =>
      updateConfig(id, parsed.data.configValue, parsed.data.remark),
    );
    success(res, null, '参数已更新');
  } catch (err) {
    console.error('[system/config/update]', err);
    fail(res, '更新失败', 500, 500);
  }
});

router.get('/logs/oper', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.logOper))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    const { dateStart, dateEnd } = parseDateRangeFilter(query);
    success(
      res,
      await listOperLogsPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        operName: parseOptionalString(query, 'operName'),
        status: parseOptionalInt(query, 'status'),
        dateStart,
        dateEnd,
      }),
    );
  } catch (err) {
    console.error('[system/logs/oper]', err);
    fail(res, '获取操作日志失败', 500, 500);
  }
});

router.get('/logs/login', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.logLogin))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    const { dateStart, dateEnd } = parseDateRangeFilter(query);
    success(
      res,
      await listLoginLogsPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        status: parseOptionalInt(query, 'status'),
        dateStart,
        dateEnd,
      }),
    );
  } catch (err) {
    console.error('[system/logs/login]', err);
    fail(res, '获取登录日志失败', 500, 500);
  }
});

router.get('/logs/api', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.logApi))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    const { dateStart, dateEnd } = parseDateRangeFilter(query);
    success(
      res,
      await listApiLogsPaginated(page, pageSize, {
        keyword: parseOptionalString(query, 'keyword'),
        operName: parseOptionalString(query, 'operName'),
        method: parseOptionalString(query, 'method'),
        moduleKey: parseOptionalString(query, 'moduleKey'),
        status: parseOptionalInt(query, 'status'),
        dateStart,
        dateEnd,
      }),
    );
  } catch (err) {
    console.error('[system/logs/api]', err);
    fail(res, '获取接口日志失败', 500, 500);
  }
});

router.get('/logs/ai-service', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.logAiService))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const query = req.query as Record<string, unknown>;
    success(
      res,
      listAiServiceLogsPaginated({
        source: parseOptionalString(query, 'source'),
        keyword: parseOptionalString(query, 'keyword'),
        page,
        pageSize,
      }),
    );
  } catch (err) {
    console.error('[system/logs/ai-service]', err);
    if (err instanceof ApiError) {
      fail(res, err.messageKey, 500, 500, err.params);
      return;
    }
    fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.get('/monitor/online', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorOnline))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      getOnlineUsers({
        keyword: parseOptionalString(query, 'keyword'),
      }),
    );
  } catch (err) {
    console.error('[system/monitor/online]', err);
    fail(res, '获取在线用户失败', 500, 500);
  }
});

router.get('/monitor/jobs', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorJob))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      getScheduledJobs({
        keyword: parseOptionalString(query, 'keyword'),
        status: parseOptionalString(query, 'status'),
      }),
    );
  } catch (err) {
    console.error('[system/monitor/jobs]', err);
    fail(res, '获取定时任务失败', 500, 500);
  }
});

router.get('/monitor/data', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorData))) return;
    success(res, await getDataMonitorStats());
  } catch (err) {
    console.error('[system/monitor/data]', err);
    fail(res, '获取数据监控失败', 500, 500);
  }
});

router.get('/monitor/server', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorServer))) return;
    success(res, await getServerMonitorInfo());
  } catch (err) {
    console.error('[system/monitor/server]', err);
    fail(res, '获取服务监控失败', 500, 500);
  }
});

router.get('/monitor/cache', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorCache))) return;
    success(res, await getCacheMonitorStats());
  } catch (err) {
    console.error('[system/monitor/cache]', err);
    fail(res, '获取缓存监控失败', 500, 500);
  }
});

router.get('/monitor/cache/keys', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.monitorCacheList))) return;
    const pattern = typeof req.query.pattern === 'string' ? req.query.pattern : '*';
    const limit = req.query.limit != null ? Number(req.query.limit) : 100;
    success(res, await listCacheKeys(pattern, limit));
  } catch (err) {
    console.error('[system/monitor/cache/keys]', err);
    fail(res, '获取缓存键失败', 500, 500);
  }
});

router.delete('/monitor/cache/keys', async (req, res) => {
  try {
    const parsed = z.object({ key: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const result = await withPermWrite(req, res, AdminPerm.monitorCacheList, '删除缓存键', () => deleteCacheKey(parsed.data.key));
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, null, '缓存键已删除');
  } catch (err) {
    console.error('[system/monitor/cache/delete]', err);
    fail(res, '删除失败', 500, 500);
  }
});

router.get('/membership/products', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.membershipProducts))) return;
    const query = req.query as Record<string, unknown>;
    success(
      res,
      listMembershipProducts({
        targetLevel: parseOptionalInt(query, 'targetLevel'),
        productId: parseOptionalInt(query, 'productId'),
      }),
    );
  } catch (err) {
    console.error('[system/membership/products]', err);
    fail(res, ApiMessageKey.SERVER_ERROR, 500, 500);
  }
});

router.get('/membership/users', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.membershipUsers))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
    const levelRaw = req.query.level != null ? Number(req.query.level) : undefined;
    const level = levelRaw != null && Number.isFinite(levelRaw) ? Math.trunc(levelRaw) : undefined;
    const result = await listMembershipUsersForAdminPaginated(page, pageSize, { keyword, level });
    success(res, result);
  } catch (err) {
    console.error('[system/membership/users]', err);
    fail(res, ApiMessageKey.MEMBERSHIP_USER_LIST_FAILED, 500, 500);
  }
});

router.get('/membership/logs', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, AdminPerm.membershipLogs))) return;
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : undefined;
    const userIdRaw = req.query.userId != null ? Number(req.query.userId) : undefined;
    const userId =
      userIdRaw != null && Number.isFinite(userIdRaw) ? Math.trunc(userIdRaw) : undefined;
    const result = await listMembershipLogsForAdminPaginated(page, pageSize, {
      keyword,
      source,
      userId,
    });
    success(res, result);
  } catch (err) {
    console.error('[system/membership/logs]', err);
    fail(res, ApiMessageKey.MEMBERSHIP_LOG_LIST_FAILED, 500, 500);
  }
});

router.patch('/membership/users/:id', async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    const parsed = z
      .object({
        memberLevel: z.number().int().min(0).max(3),
        memberExpiresAt: z.string().nullable().optional(),
        remark: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (Number.isNaN(userId) || !parsed.success) return fail(res, ApiMessageKey.PARAM_ERROR);
    const result = await withPermWrite(req, res, AdminPerm.membershipUsers, '调整会员等级', () =>
      updateMembershipByAdmin({
        userId,
        memberLevel: parsed.data.memberLevel,
        memberExpiresAt: parsed.data.memberExpiresAt,
        remark: parsed.data.remark,
        operatorId: req.auth!.userId,
      }),
    );
    if (result === undefined) return;
    if (result && typeof result === 'object' && 'error' in result) {
      return fail(res, result.error as string);
    }
    success(res, result, ApiMessageKey.MEMBERSHIP_UPDATED);
  } catch (err) {
    console.error('[system/membership/users/patch]', err);
    fail(res, ApiMessageKey.MEMBERSHIP_UPDATE_FAILED, 500, 500);
  }
});

export default router;
