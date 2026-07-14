import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey, DemandGroupType } from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  createDemandGroup,
  deleteDemandGroup,
  getDemandGroupDetailForUser,
  inviteGroupMember,
  listGroupMembershipsByUser,
  removeGroupMember,
  updateDemandGroup,
} from '../../services/marketplace/marketplace-group.service.js';

const router = Router();

const groupInputSchema = z.object({
  name: z.string().min(1).max(128),
  groupType: z.enum([
    DemandGroupType.COMPANY,
    DemandGroupType.SCHOOL,
    DemandGroupType.COMMUNITY,
    DemandGroupType.OTHER,
  ]),
  headcount: z.number().int().min(1).max(100_000).optional(),
});

const inviteSchema = z.object({
  userId: z.number().int().positive(),
});

/**
 * 创建发单团体（创建者自动成为 owner）。
 *
 * @route POST /api/marketplace/groups
 */
router.post('/', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_GROUP_INVALID, 400, 400);
    return;
  }

  try {
    const detail = await createDemandGroup(req.auth.userId, parsed.data);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 列出当前用户所属团体。
 *
 * @route GET /api/marketplace/groups/mine
 */
router.get('/mine', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  try {
    const items = await listGroupMembershipsByUser(req.auth.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 读取团体详情（须为成员）。
 *
 * @route GET /api/marketplace/groups/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const groupId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(groupId) || groupId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const detail = await getDemandGroupDetailForUser(groupId, req.auth.userId);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 更新团体信息（仅 owner）。
 *
 * @route PATCH /api/marketplace/groups/:id
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const groupId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(groupId) || groupId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_GROUP_INVALID, 400, 400);
    return;
  }

  try {
    const detail = await updateDemandGroup(groupId, req.auth.userId, parsed.data);
    success(res, detail);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 删除团体（仅 owner）。
 *
 * @route DELETE /api/marketplace/groups/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const groupId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(groupId) || groupId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    await deleteDemandGroup(groupId, req.auth.userId);
    success(res, { ok: true });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 邀请协作者（仅 owner）。
 *
 * @route POST /api/marketplace/groups/:id/members
 */
router.post('/:id/members', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const groupId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(groupId) || groupId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_GROUP_INVALID, 400, 400);
    return;
  }

  try {
    const member = await inviteGroupMember(groupId, req.auth.userId, parsed.data);
    success(res, member);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 移除团体成员（仅 owner；不可移除 owner）。
 *
 * @route DELETE /api/marketplace/groups/:id/members/:userId
 */
router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const groupId = parseInt(String(req.params.id), 10);
  const targetUserId = parseInt(String(req.params.userId), 10);
  if (
    Number.isNaN(groupId) ||
    groupId <= 0 ||
    Number.isNaN(targetUserId) ||
    targetUserId <= 0
  ) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    await removeGroupMember(groupId, req.auth.userId, targetUserId);
    success(res, { ok: true });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
