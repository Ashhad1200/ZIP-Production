import { Router } from 'express';
import { Role } from '@prisma/client';
import { monthlyOverheadController } from '../controllers/monthly-overhead.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const allowedRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

router.get('/', authenticate, rbac(...allowedRoles), monthlyOverheadController.list.bind(monthlyOverheadController));
router.put('/', authenticate, rbac(...allowedRoles), monthlyOverheadController.upsert.bind(monthlyOverheadController));
router.get('/:year/:month', authenticate, rbac(...allowedRoles), monthlyOverheadController.getForMonth.bind(monthlyOverheadController));
router.delete('/:id', authenticate, rbac(...allowedRoles), monthlyOverheadController.remove.bind(monthlyOverheadController));

export default router;
