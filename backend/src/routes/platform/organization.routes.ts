import { Router } from 'express';
import { organizationController } from '../../controllers/platform/organization.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

// Public — self-serve signup from the marketing site
router.post('/signup', organizationController.signup.bind(organizationController));

// Backoffice — requires PlatformAdmin session
router.get('/', platformAuthenticate, organizationController.list.bind(organizationController));
router.get('/:id', platformAuthenticate, organizationController.getById.bind(organizationController));
router.patch('/:id/status', platformAuthenticate, organizationController.setStatus.bind(organizationController));

export default router;
