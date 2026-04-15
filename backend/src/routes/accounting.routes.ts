import { Router } from 'express';
import { Role } from '@prisma/client';
import { accountingController } from '../controllers/accounting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const financeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

router.get('/accounts', authenticate, rbac(...financeRoles), accountingController.listAccounts.bind(accountingController));
router.get('/journal-entries', authenticate, rbac(...financeRoles), accountingController.listJournalEntries.bind(accountingController));
router.get('/general-ledger', authenticate, rbac(...financeRoles), accountingController.getGeneralLedger.bind(accountingController));
router.get('/trial-balance', authenticate, rbac(...financeRoles), accountingController.getTrialBalance.bind(accountingController));

export default router;
