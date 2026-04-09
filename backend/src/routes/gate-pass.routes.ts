import { Router } from 'express';
import { Role } from '@prisma/client';
import { gatePassController } from '../controllers/gate-pass.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const allowedRoles = [Role.SUPER_ADMIN, Role.LOGISTICS_HEAD];

// ─── Public endpoint (no auth) ───────────────────────────────────────────────

router.post(
  '/verify',
  gatePassController.verify.bind(gatePassController),
);

// ─── Protected endpoints ─────────────────────────────────────────────────────

// Lookups (must be before /:id to avoid route conflicts)
router.get(
  '/clients',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getClients.bind(gatePassController),
);

router.get(
  '/variants',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getVariants.bind(gatePassController),
);

router.get(
  '/client-rate',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getClientRate.bind(gatePassController),
);

router.get(
  '/clients/:clientId/orders',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getClientOrders.bind(gatePassController),
);

router.get(
  '/stock/:variantId',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getStock.bind(gatePassController),
);

// CRUD
router.get(
  '/',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.list.bind(gatePassController),
);

router.post(
  '/',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.create.bind(gatePassController),
);

router.get(
  '/:id',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getById.bind(gatePassController),
);

router.patch(
  '/:id/status',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.updateStatus.bind(gatePassController),
);

// Receipt photo upload — semi-public: accepts token (from QR flow) OR authenticated user
router.patch(
  '/:id/receipt-photo',
  gatePassController.uploadReceiptPhoto.bind(gatePassController),
);

router.get(
  '/:id/pdf',
  authenticate,
  rbac(...allowedRoles),
  gatePassController.getPdfData.bind(gatePassController),
);

export default router;
