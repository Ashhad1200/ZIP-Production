import { Router } from 'express';
import { Role } from '@prisma/client';
import { vendorController } from '../controllers/vendor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const readRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD];
const writeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

router.get('/', authenticate, rbac(...readRoles), vendorController.list.bind(vendorController));
router.get('/:id', authenticate, rbac(...readRoles), vendorController.getById.bind(vendorController));
router.post('/', authenticate, rbac(...writeRoles), vendorController.create.bind(vendorController));
router.put('/:id', authenticate, rbac(...writeRoles), vendorController.update.bind(vendorController));
router.delete('/:id', authenticate, rbac(Role.SUPER_ADMIN), vendorController.remove.bind(vendorController));

export default router;
