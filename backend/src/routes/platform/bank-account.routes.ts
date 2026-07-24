import { Router } from 'express';
import { bankAccountController } from '../../controllers/platform/bank-account.controller';
import { platformAuthenticate } from '../../middleware/platform-auth.middleware';

const router = Router();

// Public — shown on the tenant "Payment Required" screen
router.get('/public', bankAccountController.listActive.bind(bankAccountController));

// Backoffice
router.get('/', platformAuthenticate, bankAccountController.listAll.bind(bankAccountController));
router.post('/', platformAuthenticate, bankAccountController.create.bind(bankAccountController));
router.patch('/:id/active', platformAuthenticate, bankAccountController.setActive.bind(bankAccountController));

export default router;
