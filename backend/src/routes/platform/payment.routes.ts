import { Router } from 'express';
import { paymentController } from '../../controllers/platform/payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

// Tenant-authenticated — submit proof of manual bank transfer
router.post('/', authenticate, paymentController.submit.bind(paymentController));

// Backoffice
router.get('/', platformAuthenticate, paymentController.list.bind(paymentController));
router.post('/:id/verify', platformAuthenticate, paymentController.verify.bind(paymentController));
router.post('/:id/reject', platformAuthenticate, paymentController.reject.bind(paymentController));

export default router;
