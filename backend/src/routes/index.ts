import { Router } from 'express';
import authRoutes from './auth.routes';
import productionRoutes from './production.routes';
import inventoryRoutes from './inventory.routes';
import gatePassRoutes from './gate-pass.routes';
import orderRoutes from './order.routes';
import financeRoutes from './finance.routes';
import settingsRoutes from './settings.routes';
import dashboardRoutes from './dashboard.routes';
import { authenticate } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Auth routes (some public, some protected)
router.use('/auth', authRoutes);

// Production routes (all protected via route-level middleware)
router.use('/production', productionRoutes);

// Inventory routes (all protected via route-level middleware)
router.use('/inventory', inventoryRoutes);

// Gate pass routes (verify is public, rest protected via route-level middleware)
router.use('/gate-passes', gatePassRoutes);

// Order routes (all protected via route-level middleware)
router.use('/orders', orderRoutes);

// Finance routes (all protected via route-level middleware)
router.use('/finance', financeRoutes);

// Settings routes (all protected via route-level middleware)
router.use('/settings', settingsRoutes);

// Dashboard routes (all protected via route-level middleware)
router.use('/dashboard', dashboardRoutes);

// Notification routes (all protected)
router.get('/notifications', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { unreadOnly, limit } = req.query;
    const notifications = await notificationService.getUserNotifications(
      req.user!.userId,
      req.user!.role,
      unreadOnly === 'true',
      parseInt(limit as string) || 20
    );
    res.json({ data: notifications });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/read', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const notification = await notificationService.markRead(req.params.id as string);
    res.json({ data: notification });
  } catch (error) { next(error); }
});

router.patch('/notifications/read-all', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    await notificationService.markAllRead(req.user!.userId, req.user!.role);
    res.json({ data: { message: 'All notifications marked as read' } });
  } catch (error) { next(error); }
});

router.get('/notifications/unread-count', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId, req.user!.role);
    res.json({ data: { count } });
  } catch (error) { next(error); }
});

export default router;
