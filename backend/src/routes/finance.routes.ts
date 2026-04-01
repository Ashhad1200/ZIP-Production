import { Router } from 'express';
import { Role } from '@prisma/client';
import { financeController } from '../controllers/finance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const financeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];
const adminOnly = [Role.SUPER_ADMIN];

// Client ledger
router.get('/clients', authenticate, rbac(...financeRoles), financeController.listClients.bind(financeController));
router.get('/clients/:clientId/ledger', authenticate, rbac(...financeRoles), financeController.getClientLedger.bind(financeController));
router.get('/clients/:clientId/ledger/download', authenticate, rbac(...financeRoles), financeController.getLedgerDownload.bind(financeController));
router.post('/clients/:clientId/payments', authenticate, rbac(...financeRoles), financeController.recordPayment.bind(financeController));
router.get('/clients/:clientId/rates', authenticate, rbac(...financeRoles), financeController.getClientRates.bind(financeController));
router.put('/clients/:clientId/rates', authenticate, rbac(...financeRoles), financeController.updateClientRate.bind(financeController));

// Overdue
router.get('/overdue', authenticate, rbac(...financeRoles), financeController.getOverduePayments.bind(financeController));

// Vouchers
router.get('/vouchers', authenticate, rbac(...financeRoles), financeController.listVouchers.bind(financeController));
router.post('/vouchers', authenticate, rbac(...financeRoles), financeController.createVoucher.bind(financeController));
router.patch('/vouchers/:id/approve', authenticate, rbac(...adminOnly), financeController.approveOrRejectVoucher.bind(financeController));

// Reports
router.get('/reports/monthly', authenticate, rbac(...financeRoles), financeController.getMonthlyReport.bind(financeController));

export default router;
