import { Router } from 'express';
import { success } from '../../utils/response.js';
import { listServiceCategories } from '../../services/marketplace/marketplace-category.service.js';

const router = Router();

router.get('/', (_req, res) => {
  success(res, {
    categories: listServiceCategories(),
  });
});

export default router;
