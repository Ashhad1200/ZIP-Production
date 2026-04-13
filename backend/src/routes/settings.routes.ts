import { Router } from 'express';
import { Role } from '@prisma/client';
import { settingsController } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { rbac } from '../middleware/rbac.middleware';

const router = Router();
const adminOnly = [Role.SUPER_ADMIN];
const adminAndFinance = [Role.SUPER_ADMIN, Role.FINANCE_HEAD];

// Users
router.get('/users', authenticate, rbac(...adminOnly), settingsController.listUsers.bind(settingsController));
router.post('/users', authenticate, rbac(...adminOnly), settingsController.createUser.bind(settingsController));
router.put('/users/:id', authenticate, rbac(...adminOnly), settingsController.updateUser.bind(settingsController));
router.delete('/users/:id', authenticate, rbac(...adminOnly), settingsController.deactivateUser.bind(settingsController));

// Clients
router.get('/clients', authenticate, rbac(...adminAndFinance), settingsController.listClients.bind(settingsController));
router.post('/clients', authenticate, rbac(...adminAndFinance), settingsController.createClient.bind(settingsController));
router.put('/clients/:id', authenticate, rbac(...adminAndFinance), settingsController.updateClient.bind(settingsController));

// Expense categories
router.get('/expense-categories', authenticate, rbac(...adminOnly), settingsController.listExpenseCategories.bind(settingsController));
router.post('/expense-categories', authenticate, rbac(...adminOnly), settingsController.createExpenseCategory.bind(settingsController));
router.put('/expense-categories/:id', authenticate, rbac(...adminOnly), settingsController.updateExpenseCategory.bind(settingsController));
router.delete('/expense-categories/:id', authenticate, rbac(...adminOnly), settingsController.deleteExpenseCategory.bind(settingsController));

// Companies
router.get('/companies', authenticate, rbac(...adminOnly), settingsController.listCompanies.bind(settingsController));
router.post('/companies', authenticate, rbac(...adminOnly), settingsController.createCompany.bind(settingsController));
router.put('/companies/:id', authenticate, rbac(...adminOnly), settingsController.updateCompany.bind(settingsController));

// Variants
router.get('/variants', authenticate, rbac(...adminOnly), settingsController.listVariants.bind(settingsController));
router.post('/variants', authenticate, rbac(...adminOnly), settingsController.createVariant.bind(settingsController));
router.put('/variants/:id', authenticate, rbac(...adminOnly), settingsController.updateVariant.bind(settingsController));

// Recipes
router.get('/recipes', authenticate, rbac(...adminOnly), settingsController.listRecipes.bind(settingsController));
router.post('/recipes', authenticate, rbac(...adminOnly), settingsController.createRecipe.bind(settingsController));
router.put('/recipes/:id', authenticate, rbac(...adminOnly), settingsController.updateRecipe.bind(settingsController));
router.delete('/recipes/:id', authenticate, rbac(...adminOnly), settingsController.deleteRecipe.bind(settingsController));

// Grain types
router.get('/grain-types', authenticate, rbac(...adminOnly), settingsController.listGrainTypes.bind(settingsController));
router.post('/grain-types', authenticate, rbac(...adminOnly), settingsController.createGrainType.bind(settingsController));
router.put('/grain-types/:id', authenticate, rbac(...adminOnly), settingsController.updateGrainType.bind(settingsController));

// Plants & machines
router.get('/plants', authenticate, rbac(...adminOnly), settingsController.listPlants.bind(settingsController));
router.put('/plants/:id', authenticate, rbac(...adminOnly), settingsController.updatePlant.bind(settingsController));
router.post('/plants/:plantId/machines', authenticate, rbac(...adminOnly), settingsController.createMachine.bind(settingsController));
router.put('/plants/:plantId/machines/:machineId', authenticate, rbac(...adminOnly), settingsController.updateMachine.bind(settingsController));

// Workers
router.get('/workers', authenticate, rbac(...adminOnly), settingsController.listWorkers.bind(settingsController));
router.post('/workers', authenticate, rbac(...adminOnly), settingsController.createWorker.bind(settingsController));
router.put('/workers/:id', authenticate, rbac(...adminOnly), settingsController.updateWorker.bind(settingsController));

// System settings
router.get('/system', authenticate, rbac(...adminOnly), settingsController.listSystemSettings.bind(settingsController));
router.put('/system/:key', authenticate, rbac(...adminOnly), settingsController.updateSystemSetting.bind(settingsController));

export default router;
