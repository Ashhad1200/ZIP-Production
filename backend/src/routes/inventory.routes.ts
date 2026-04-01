import { Router } from 'express';
import { Role } from '@prisma/client';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const readRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD];
const writeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];
const adminOnly = [Role.SUPER_ADMIN];

// Finished goods
router.get(
  '/finished-goods',
  authenticate,
  rbac(...readRoles),
  inventoryController.getFinishedGoods.bind(inventoryController)
);

router.put(
  '/finished-goods/:id/threshold',
  authenticate,
  rbac(...adminOnly),
  inventoryController.updateFinishedGoodsThreshold.bind(inventoryController)
);

// Raw materials
router.get(
  '/raw-materials',
  authenticate,
  rbac(...readRoles),
  inventoryController.getRawMaterials.bind(inventoryController)
);

router.get(
  '/raw-materials/purchases',
  authenticate,
  rbac(...readRoles),
  inventoryController.listPurchases.bind(inventoryController)
);

router.post(
  '/raw-materials/purchases',
  authenticate,
  rbac(...writeRoles),
  inventoryController.recordPurchase.bind(inventoryController)
);

router.put(
  '/raw-materials/:id/threshold',
  authenticate,
  rbac(...adminOnly),
  inventoryController.updateRawMaterialThreshold.bind(inventoryController)
);

// Reports
router.get(
  '/consumption-report',
  authenticate,
  rbac(...readRoles),
  inventoryController.getConsumptionReport.bind(inventoryController)
);

export default router;
