import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey } from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail, failFromError } from '../utils/response.js';
import { canUseRouteSolver } from '../config/route-solver.js';
import {
  fetchRouteSolverFactors,
  fetchRouteSolverHealth,
  solveRouteWithExternalSolver,
} from '../services/route-solver-client.service.js';

const router = Router();
const LabPerm = 'data:analytics:view';

const nodeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  stayMinutes: z.number().int().min(0).max(24 * 60).optional(),
  windowStart: z.number().int().min(0).max(24 * 60).nullable().optional(),
  windowEnd: z.number().int().min(0).max(24 * 60).nullable().optional(),
});

const optionsSchema = z
  .object({
    preset: z.enum(['balanced', 'fast', 'quality', 'open_hours']).nullable().optional(),
    timeLimitSeconds: z.number().min(0.1).max(120).optional(),
    firstSolution: z.string().max(64).optional(),
    metaheuristic: z.string().max(64).optional(),
    returnToDepot: z.boolean().optional(),
    travelTimeWeight: z.number().min(0).max(10).optional(),
    distanceWeight: z.number().min(0).max(10).optional(),
    enableTimeWindows: z.boolean().optional(),
    depotStartMinutes: z.number().int().min(0).max(24 * 60).optional(),
    waitingSlackMinutes: z.number().int().min(0).max(240).optional(),
  })
  .optional();

const solveBodySchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(40),
  durationMatrix: z.array(z.array(z.number().int().nonnegative())).nullable().optional(),
  options: optionsSchema,
});

router.use(authMiddleware);

/**
 * GET /api/admin/route-solver/status
 * 外置算法服务状态（是否启用 + health）。
 */
router.get('/status', async (req, res) => {
  const staff = await requirePerm(req, res, LabPerm);
  if (!staff) return;
  try {
    const enabled = canUseRouteSolver();
    if (!enabled) {
      return success(res, {
        enabled: false,
        health: null,
      });
    }
    const health = await fetchRouteSolverHealth();
    return success(res, { enabled: true, health });
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
  }
});

/**
 * GET /api/admin/route-solver/factors
 * 推荐影响因素与预设目录（透传外置服务）。
 */
router.get('/factors', async (req, res) => {
  const staff = await requirePerm(req, res, LabPerm);
  if (!staff) return;
  try {
    const catalog = await fetchRouteSolverFactors();
    return success(res, catalog);
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.ROUTE_SOLVER_UNAVAILABLE);
  }
});

/**
 * POST /api/admin/route-solver/solve
 * 按配置的节点与因子求解最佳访问顺序。
 */
router.post('/solve', async (req, res) => {
  const staff = await requirePerm(req, res, LabPerm);
  if (!staff) return;
  const parsed = solveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, ApiMessageKey.ROUTE_SOLVER_INVALID_REQUEST);
  }
  try {
    const result = await solveRouteWithExternalSolver(parsed.data);
    return success(res, result);
  } catch (err) {
    return failFromError(res, err, ApiMessageKey.ROUTE_SOLVER_SOLVE_FAILED);
  }
});

export default router;
