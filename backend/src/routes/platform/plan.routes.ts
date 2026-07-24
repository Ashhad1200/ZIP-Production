import { Router } from 'express';
import { planController } from '../../controllers/platform/plan.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

// Public — plan comparison for the marketing/signup page
router.get('/public', planController.listPublic.bind(planController));

// Backoffice
router.get('/', platformAuthenticate, planController.list.bind(planController));
router.get('/:id', platformAuthenticate, planController.getById.bind(planController));
router.post('/', platformAuthenticate, planController.create.bind(planController));
router.patch('/:id', platformAuthenticate, planController.update.bind(planController));
router.patch('/:id/active', platformAuthenticate, planController.setActive.bind(planController));

export default router;
