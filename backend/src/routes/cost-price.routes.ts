import { Router } from 'express';
import { Role } from '@prisma/client';
import { costPriceController } from '../controllers/cost-price.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

// Only Super Admin and Finance Head can view cost prices
const allowedRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

router.get(
  '/',
  authenticate,
  rbac(...allowedRoles),
  costPriceController.listForPeriod.bind(costPriceController),
);

router.get(
  '/:id',
  authenticate,
  rbac(...allowedRoles),
  costPriceController.getForEntry.bind(costPriceController),
);

export default router;
