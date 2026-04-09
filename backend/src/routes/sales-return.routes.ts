import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';
import { salesReturnController } from '../controllers/sales-return.controller';
import { Role } from '@prisma/client';

const router = Router();

const allowed = [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD];

router.get('/', authenticate, rbac(...allowed), (req, res, next) =>
  salesReturnController.list(req as never, res, next),
);

router.get('/:id', authenticate, rbac(...allowed), (req, res, next) =>
  salesReturnController.getById(req as never, res, next),
);

router.post('/', authenticate, rbac(...allowed), (req, res, next) =>
  salesReturnController.create(req as never, res, next),
);

export default router;
