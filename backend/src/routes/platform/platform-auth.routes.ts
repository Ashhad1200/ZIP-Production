import { Router } from 'express';
import { platformAuthController } from '../../controllers/platform/platform-auth.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

router.post('/login', platformAuthController.login.bind(platformAuthController));
router.post('/logout', platformAuthenticate, platformAuthController.logout.bind(platformAuthController));
router.get('/me', platformAuthenticate, platformAuthController.me.bind(platformAuthController));

export default router;
