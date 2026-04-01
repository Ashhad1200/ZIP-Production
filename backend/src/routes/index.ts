import { Router } from 'express';
import authRoutes from './auth.routes';
import productionRoutes from './production.routes';
import { authenticate } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Auth routes (some public, some protected)
router.use('/auth', authRoutes);

// Production routes (all protected via route-level middleware)
router.use('/production', productionRoutes);

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
    const notification = await notificationService.markRead(req.params.id);
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
