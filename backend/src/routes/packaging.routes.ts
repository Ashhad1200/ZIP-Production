import { Router } from 'express';
import { Role } from '@prisma/client';
import { packagingController } from '../controllers/packaging.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const readRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD];
const writeRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD, Role.FINANCE_HEAD];

router.get('/', authenticate, rbac(...readRoles), packagingController.listMaterials.bind(packagingController));
router.get('/purchases', authenticate, rbac(...readRoles), packagingController.listAllPurchases.bind(packagingController));
router.post('/', authenticate, rbac(...writeRoles), packagingController.createMaterial.bind(packagingController));
router.put('/:id', authenticate, rbac(...writeRoles), packagingController.updateMaterial.bind(packagingController));
router.get('/:id/adjustments', authenticate, rbac(...readRoles), packagingController.listAdjustments.bind(packagingController));
router.post('/:id/adjustments', authenticate, rbac(...writeRoles), packagingController.recordAdjustment.bind(packagingController));

export default router;
