import { mysqlTable, int, varchar, text, tinyint, timestamp, primaryKey } from 'drizzle-orm/mysql-core';
import { roles } from './roles.js';

export const sysDept = mysqlTable('sys_dept', {
  id: int('id').primaryKey().autoincrement(),
  parentId: int('parent_id').notNull().default(0),
  name: varchar('name', { length: 64 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const sysPost = mysqlTable('sys_post', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  remark: varchar('remark', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sysDictType = mysqlTable('sys_dict_type', {
  id: int('id').primaryKey().autoincrement(),
  dictType: varchar('dict_type', { length: 64 }).notNull().unique(),
  dictName: varchar('dict_name', { length: 64 }).notNull(),
  status: tinyint('status').notNull().default(1),
  remark: varchar('remark', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sysDictData = mysqlTable('sys_dict_data', {
  id: int('id').primaryKey().autoincrement(),
  dictType: varchar('dict_type', { length: 64 }).notNull(),
  dictLabel: varchar('dict_label', { length: 64 }).notNull(),
  dictValue: varchar('dict_value', { length: 64 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  remark: varchar('remark', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sysNotice = mysqlTable('sys_notice', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 128 }).notNull(),
  noticeType: tinyint('notice_type').notNull().default(1),
  status: tinyint('status').notNull().default(1),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const sysOperLog = mysqlTable('sys_oper_log', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 64 }).notNull(),
  operName: varchar('oper_name', { length: 64 }).notNull(),
  operUrl: varchar('oper_url', { length: 255 }).notNull(),
  method: varchar('method', { length: 16 }).notNull(),
  operIp: varchar('oper_ip', { length: 64 }),
  status: tinyint('status').notNull().default(1),
  errorMsg: varchar('error_msg', { length: 512 }),
  operTime: timestamp('oper_time', { mode: 'string' }).notNull().defaultNow(),
});

export const sysLoginLog = mysqlTable('sys_login_log', {
  id: int('id').primaryKey().autoincrement(),
  username: varchar('username', { length: 64 }).notNull(),
  ip: varchar('ip', { length: 64 }),
  browser: varchar('browser', { length: 64 }),
  os: varchar('os', { length: 64 }),
  status: tinyint('status').notNull().default(1),
  msg: varchar('msg', { length: 255 }),
  loginTime: timestamp('login_time', { mode: 'string' }).notNull().defaultNow(),
});

export const sysApiLog = mysqlTable('sys_api_log', {
  id: int('id').primaryKey().autoincrement(),
  traceId: varchar('trace_id', { length: 64 }),
  operName: varchar('oper_name', { length: 64 }).notNull().default('anonymous'),
  apiModule: varchar('api_module', { length: 32 }),
  requestUrl: varchar('request_url', { length: 512 }).notNull(),
  method: varchar('method', { length: 16 }).notNull(),
  requestParams: text('request_params'),
  responseBody: text('response_body'),
  statusCode: int('status_code').notNull().default(200),
  operIp: varchar('oper_ip', { length: 64 }),
  costTime: int('cost_time').notNull().default(0),
  status: tinyint('status').notNull().default(1),
  errorMsg: varchar('error_msg', { length: 512 }),
  requestTime: timestamp('request_time', { mode: 'string' }).notNull().defaultNow(),
});

/** 菜单类型：1 目录 2 菜单 3 按钮 */
export const sysMenu = mysqlTable('sys_menu', {
  id: int('id').primaryKey().autoincrement(),
  parentId: int('parent_id').notNull().default(0),
  menuKey: varchar('menu_key', { length: 64 }).notNull().unique(),
  menuName: varchar('menu_name', { length: 64 }).notNull(),
  menuType: tinyint('menu_type').notNull().default(2),
  path: varchar('path', { length: 128 }),
  component: varchar('component', { length: 128 }),
  perms: varchar('perms', { length: 128 }),
  icon: varchar('icon', { length: 64 }),
  sortOrder: int('sort_order').notNull().default(0),
  isFrame: tinyint('is_frame').notNull().default(0),
  visible: tinyint('visible').notNull().default(1),
  status: tinyint('status').notNull().default(1),
  routeParams: varchar('route_params', { length: 255 }),
  remark: varchar('remark', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

/** 角色 ↔ 菜单（S1 RBAC） */
export const roleMenu = mysqlTable(
  'role_menu',
  {
    roleId: int('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    menuId: int('menu_id')
      .notNull()
      .references(() => sysMenu.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.menuId] }),
  }),
);
