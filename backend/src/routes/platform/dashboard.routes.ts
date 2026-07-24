import { Router } from 'express';
import { platformDashboardController } from '../../controllers/platform/dashboard.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

router.get('/summary', platformAuthenticate, platformDashboardController.summary.bind(platformDashboardController));

export default router;
