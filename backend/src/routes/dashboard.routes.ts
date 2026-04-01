import { Router } from 'express';
import { Role } from '@prisma/client';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const allRoles = Object.values(Role);
const financeRoles = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

router.get('/kpis', authenticate, rbac(...allRoles), dashboardController.getKPIs.bind(dashboardController));
router.get('/production-trend', authenticate, rbac(...allRoles), dashboardController.getProductionTrend.bind(dashboardController));
router.get('/shift-comparison', authenticate, rbac(...allRoles), dashboardController.getShiftComparison.bind(dashboardController));
router.get('/revenue-overview', authenticate, rbac(...financeRoles), dashboardController.getRevenueOverview.bind(dashboardController));
router.get('/stock-levels', authenticate, rbac(...allRoles), dashboardController.getStockLevels.bind(dashboardController));
router.get('/overdue-payments', authenticate, rbac(...financeRoles), dashboardController.getOverduePayments.bind(dashboardController));
router.get('/recent-activity', authenticate, rbac(...allRoles), dashboardController.getRecentActivity.bind(dashboardController));
router.get('/recent-gate-passes', authenticate, rbac(...allRoles), dashboardController.getRecentGatePasses.bind(dashboardController));

export default router;
