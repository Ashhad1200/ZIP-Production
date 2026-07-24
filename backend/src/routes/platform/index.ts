import { Router } from 'express';
import platformAuthRoutes from './platform-auth.routes';
import organizationRoutes from './organization.routes';
import planRoutes from './plan.routes';
import paymentRoutes from './payment.routes';
import moduleRoutes from './module.routes';
import bankAccountRoutes from './bank-account.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', platformAuthRoutes);
router.use('/organizations', organizationRoutes);
router.use('/plans', planRoutes);
router.use('/payments', paymentRoutes);
router.use('/modules', moduleRoutes);
router.use('/bank-accounts', bankAccountRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
