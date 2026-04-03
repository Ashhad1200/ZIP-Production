import { Router } from 'express';
import { Role } from '@prisma/client';
import { productionController } from '../controllers/production.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const readRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD];
const writeRoles = [Role.SUPER_ADMIN, Role.PRODUCTION_HEAD];
const adminOnly = [Role.SUPER_ADMIN];

// Production entries
router.get(
  '/entries',
  authenticate,
  rbac(...readRoles),
  productionController.listEntries.bind(productionController)
);

router.post(
  '/entries',
  authenticate,
  rbac(...writeRoles),
  productionController.createEntry.bind(productionController)
);

router.get(
  '/entries/:id',
  authenticate,
  rbac(...readRoles),
  productionController.getEntry.bind(productionController)
);

router.put(
  '/entries/:id',
  authenticate,
  rbac(...adminOnly),
  productionController.updateEntry.bind(productionController)
);

router.post(
  '/entries/:id/complete',
  authenticate,
  rbac(...writeRoles),
  productionController.completeEntry.bind(productionController)
);

// Daily Progress Report
router.get(
  '/dpr',
  authenticate,
  rbac(...readRoles),
  productionController.getDPR.bind(productionController)
);

// Scrap sales
router.get(
  '/scrap-sales',
  authenticate,
  rbac(...readRoles),
  productionController.listScrapSales.bind(productionController)
);

router.post(
  '/scrap-sales',
  authenticate,
  rbac(...writeRoles),
  productionController.createScrapSale.bind(productionController)
);

// Discrepancies (Super Admin only)
router.get(
  '/discrepancies',
  authenticate,
  rbac(...adminOnly),
  productionController.listDiscrepancies.bind(productionController)
);

// Lookups
router.get(
  '/plants',
  authenticate,
  rbac(...readRoles),
  productionController.getPlants.bind(productionController)
);

router.get(
  '/workers',
  authenticate,
  rbac(...readRoles),
  productionController.getWorkers.bind(productionController)
);

router.get(
  '/variants',
  authenticate,
  rbac(...readRoles),
  productionController.getVariants.bind(productionController)
);

export default router;
