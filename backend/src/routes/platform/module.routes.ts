import { Router } from 'express';
import { moduleController } from '../../controllers/platform/module.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

router.get('/', platformAuthenticate, moduleController.list.bind(moduleController));

export default router;
