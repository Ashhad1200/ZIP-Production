import { Router } from 'express';
import { Role } from '@prisma/client';
import { hrController } from '../controllers/hr.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();

const hrRoles = [Role.SUPER_ADMIN, Role.HR_HEAD, Role.FINANCE_HEAD];
const readRoles = [Role.SUPER_ADMIN, Role.HR_HEAD, Role.FINANCE_HEAD];

// Workers & salary rates
router.get('/workers', authenticate, rbac(...readRoles), hrController.listWorkersWithSalary.bind(hrController));
router.get('/workers/:workerId', authenticate, rbac(...readRoles), hrController.getWorkerWithSalary.bind(hrController));
router.post('/workers/:workerId/salary-rate', authenticate, rbac(...hrRoles), hrController.setSalaryRate.bind(hrController));

// Advances
router.get('/advances', authenticate, rbac(...readRoles), hrController.listAdvances.bind(hrController));
router.post('/workers/:workerId/advances', authenticate, rbac(...hrRoles), hrController.createAdvance.bind(hrController));
router.post('/advances/:advanceId/recover', authenticate, rbac(...hrRoles), hrController.markAdvanceRecovered.bind(hrController));

// Payroll
router.get('/payroll', authenticate, rbac(...readRoles), hrController.listPayroll.bind(hrController));
router.get('/payroll/:year/:month/summary', authenticate, rbac(...readRoles), hrController.getMonthlyPayrollSummary.bind(hrController));
router.post('/payroll', authenticate, rbac(...hrRoles), hrController.createPayroll.bind(hrController));

export default router;
