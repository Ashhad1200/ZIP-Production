import { Router } from 'express';
import { Role } from '@prisma/client';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const readRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.PRODUCTION_HEAD, Role.MARKETING_HEAD];
const writeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

// Specific routes before /:id to avoid conflicts
router.get('/fulfillment-report', authenticate, rbac(...readRoles), orderController.getFulfillmentReport.bind(orderController));
router.get('/by-client/:clientId', authenticate, rbac(...readRoles), orderController.getOrdersByClient.bind(orderController));

// CRUD
router.get('/', authenticate, rbac(...readRoles), orderController.listOrders.bind(orderController));
router.post('/', authenticate, rbac(...writeRoles), orderController.createOrder.bind(orderController));
router.get('/:id', authenticate, rbac(...readRoles), orderController.getOrderById.bind(orderController));

export default router;
