import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

export class SettingsController {
  // ─── User Management ───────────────────────────────────────────────────────

  async listUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      });
      res.json({ data: users });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, role } = req.body;
      if (!name || !role) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name and role are required' } });
        return;
      }
      const user = await prisma.user.create({ data: { name, role } });
      res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, role, isActive } = req.body;
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(role !== undefined && { role }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  async deactivateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ data: { message: 'User deactivated' } });
    } catch (error) {
      next(error);
    }
  }

  // ─── Client Management ─────────────────────────────────────────────────────

  async listClients(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const clients = await prisma.client.findMany({
        where: { isDeleted: false },
        include: { clientRates: { where: { effectiveTo: null } } },
      });
      res.json({ data: clients });
    } catch (error) {
      next(error);
    }
  }

  async createClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, contactPerson, phone, address, paymentCycleDays, rates, openingBalancePaisa } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }

      const userId = req.user!.userId;

      const client = await prisma.$transaction(async (tx) => {
        const created = await tx.client.create({
          data: {
            name,
            contactPerson,
            phone,
            address,
            ...(paymentCycleDays !== undefined && { paymentCycleDays }),
            ...(openingBalancePaisa !== undefined && { openingBalancePaisa: BigInt(openingBalancePaisa) }),
            createdBy: userId,
          },
        });

        if (rates && Array.isArray(rates) && rates.length > 0) {
          await tx.clientRate.createMany({
            data: rates.map((r: { variantId: string; ratePerMeterPaisa: number }) => ({
              clientId: created.id,
              variantId: r.variantId,
              ratePerMeterPaisa: r.ratePerMeterPaisa,
              effectiveFrom: new Date(),
              createdBy: userId,
            })),
          });
        }

        return tx.client.findUnique({
          where: { id: created.id },
          include: { clientRates: { where: { effectiveTo: null } } },
        });
      });

      res.status(201).json({ data: client });
    } catch (error) {
      next(error);
    }
  }

  async updateClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, contactPerson, phone, address, paymentCycleDays, openingBalancePaisa } = req.body;
      const client = await prisma.client.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(contactPerson !== undefined && { contactPerson }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
          ...(paymentCycleDays !== undefined && { paymentCycleDays }),
          ...(openingBalancePaisa !== undefined && { openingBalancePaisa: BigInt(openingBalancePaisa) }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: client });
    } catch (error) {
      next(error);
    }
  }

  // ─── Expense Category Management ───────────────────────────────────────────

  async listExpenseCategories(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.expenseCategory.findMany({
        where: { isDeleted: false, parentId: null },
        include: { children: { where: { isDeleted: false } } },
      });
      res.json({ data: categories });
    } catch (error) {
      next(error);
    }
  }

  async createExpenseCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, parentId } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }
      const category = await prisma.expenseCategory.create({
        data: { name, parentId, createdBy: req.user!.userId },
      });
      res.status(201).json({ data: category });
    } catch (error) {
      next(error);
    }
  }

  async updateExpenseCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, isActive } = req.body;
      const category = await prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(isActive !== undefined && { isActive }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: category });
    } catch (error) {
      next(error);
    }
  }

  async deleteExpenseCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const activeVouchers = await prisma.voucher.count({
        where: { categoryId: id, isDeleted: false },
      });
      if (activeVouchers > 0) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Cannot delete category with active vouchers' },
        });
        return;
      }
      await prisma.expenseCategory.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.userId },
      });
      res.json({ data: { message: 'Category deleted' } });
    } catch (error) {
      next(error);
    }
  }

  // ─── Company Management ────────────────────────────────────────────────────

  async listCompanies(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companies = await prisma.company.findMany({ where: { isActive: true } });
      res.json({ data: companies });
    } catch (error) {
      next(error);
    }
  }

  async createCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, taxStructure } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }
      const company = await prisma.company.create({
        data: { name, taxStructure, createdBy: req.user!.userId },
      });
      res.status(201).json({ data: company });
    } catch (error) {
      next(error);
    }
  }

  async updateCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, taxStructure, isActive } = req.body;
      const company = await prisma.company.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(taxStructure !== undefined && { taxStructure }),
          ...(isActive !== undefined && { isActive }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: company });
    } catch (error) {
      next(error);
    }
  }

  // ─── Variant Management ────────────────────────────────────────────────────

  async listVariants(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const variants = await prisma.zipperVariant.findMany({
        where: { isDeleted: false },
        include: {
          grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } },
          packagingMaterial: { select: { id: true, name: true, unit: true, ratePerUnitPaisa: true } },
          recipe: { select: { id: true, name: true } },
          ingredients: {
            include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
            orderBy: { ratioPercent: 'desc' },
          },
        },
      });
      res.json({
        data: variants.map((variant) => ({
          ...variant,
          packagingMaterial: variant.packagingMaterial
            ? { ...variant.packagingMaterial, ratePerUnitPaisa: Number(variant.packagingMaterial.ratePerUnitPaisa) }
            : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async createVariant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { code, name, standardGramsPerMeter, description, ingredients, recipeId, packagingMaterialId } = req.body;
      if (!code || !name || standardGramsPerMeter == null) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'code, name, and standardGramsPerMeter are required' },
        });
        return;
      }

      // If recipeId is provided, load recipe ingredients; otherwise require manual ingredients
      let resolvedIngredients: { grainTypeId: string; ratioPercent: number }[] = [];
      if (recipeId) {
        const recipe = await prisma.recipe.findUnique({
          where: { id: recipeId },
          include: { ingredients: true },
        });
        if (!recipe || recipe.isDeleted) {
          res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Recipe not found' } });
          return;
        }
        resolvedIngredients = recipe.ingredients.map((i) => ({
          grainTypeId: i.grainTypeId,
          ratioPercent: Number(i.ratioPercent),
        }));
      } else {
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
          res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: 'At least one ingredient (grain type) or a recipe is required' },
          });
          return;
        }
        resolvedIngredients = ingredients;
      }

      const totalRatio = resolvedIngredients.reduce((s, i) => s + Number(i.ratioPercent), 0);
      if (Math.abs(totalRatio - 100) > 0.01) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: `Ingredient ratios must sum to 100%. Currently: ${totalRatio.toFixed(2)}%` },
        });
        return;
      }

      const variant = await prisma.zipperVariant.create({
        data: {
          code,
          name,
          standardGramsPerMeter,
          metersPerCarton: req.body.metersPerCarton ?? null,
          packagingMaterialId: packagingMaterialId ?? null,
          recipeId: recipeId ?? null,
          description,
          createdBy: req.user!.userId,
          ingredients: {
            create: resolvedIngredients.map((i) => ({
              grainTypeId: i.grainTypeId,
              ratioPercent: i.ratioPercent,
            })),
          },
        },
        include: {
          recipe: { select: { id: true, name: true } },
          packagingMaterial: { select: { id: true, name: true, unit: true, ratePerUnitPaisa: true } },
          ingredients: {
            include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
          },
        },
      });
      res.status(201).json({
        data: {
          ...variant,
          packagingMaterial: variant.packagingMaterial
            ? { ...variant.packagingMaterial, ratePerUnitPaisa: Number(variant.packagingMaterial.ratePerUnitPaisa) }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVariant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, standardGramsPerMeter, metersPerCarton, packagingMaterialId, description, isActive, ingredients, recipeId } = req.body;

      // Resolve ingredients: if recipeId changed, re-sync from recipe
      let resolvedIngredients: { grainTypeId: string; ratioPercent: number }[] | undefined;
      let newRecipeId: string | null | undefined;

      if (recipeId !== undefined) {
        newRecipeId = recipeId;
        if (recipeId) {
          const recipe = await prisma.recipe.findUnique({
            where: { id: recipeId },
            include: { ingredients: true },
          });
          if (!recipe || recipe.isDeleted) {
            res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Recipe not found' } });
            return;
          }
          resolvedIngredients = recipe.ingredients.map((i) => ({
            grainTypeId: i.grainTypeId,
            ratioPercent: Number(i.ratioPercent),
          }));
        } else {
          // Recipe cleared — keep existing manual ingredients unless new ones provided
          if (ingredients !== undefined) {
            resolvedIngredients = ingredients;
          }
        }
      } else if (ingredients !== undefined) {
        resolvedIngredients = ingredients;
      }

      // Validate ingredient ratios if we're replacing
      if (resolvedIngredients !== undefined) {
        if (!Array.isArray(resolvedIngredients) || resolvedIngredients.length === 0) {
          res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one ingredient is required' } });
          return;
        }
        const totalRatio = resolvedIngredients.reduce((s, i) => s + Number(i.ratioPercent), 0);
        if (Math.abs(totalRatio - 100) > 0.01) {
          res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: `Ingredient ratios must sum to 100%. Currently: ${totalRatio.toFixed(2)}%` },
          });
          return;
        }
      }

      const variant = await prisma.$transaction(async (tx) => {
        if (resolvedIngredients !== undefined) {
          await tx.variantIngredient.deleteMany({ where: { variantId: id } });
          await tx.variantIngredient.createMany({
            data: resolvedIngredients.map((i) => ({
              variantId: id,
              grainTypeId: i.grainTypeId,
              ratioPercent: i.ratioPercent,
            })),
          });
        }
        return tx.zipperVariant.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(standardGramsPerMeter !== undefined && { standardGramsPerMeter }),
            ...(metersPerCarton !== undefined && { metersPerCarton }),
            ...(packagingMaterialId !== undefined && { packagingMaterialId }),
            ...(newRecipeId !== undefined && { recipeId: newRecipeId }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
            updatedBy: req.user!.userId,
          },
          include: {
            recipe: { select: { id: true, name: true } },
            packagingMaterial: { select: { id: true, name: true, unit: true, ratePerUnitPaisa: true } },
            ingredients: {
              include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
              orderBy: { ratioPercent: 'desc' },
            },
          },
        });
      });
      res.json({
        data: {
          ...variant,
          packagingMaterial: variant.packagingMaterial
            ? { ...variant.packagingMaterial, ratePerUnitPaisa: Number(variant.packagingMaterial.ratePerUnitPaisa) }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── Grain Type Management ─────────────────────────────────────────────────

  async listGrainTypes(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const grainTypes = await prisma.grainType.findMany({ where: { isDeleted: false } });
      res.json({ data: grainTypes });
    } catch (error) {
      next(error);
    }
  }

  async createGrainType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { code, name, bagWeightGrams, lowStockThresholdBags, description } = req.body;
      if (!code || !name || bagWeightGrams == null) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'code, name, and bagWeightGrams are required' },
        });
        return;
      }
      const grainType = await prisma.grainType.create({
        data: { code, name, bagWeightGrams, lowStockThresholdBags, description, createdBy: req.user!.userId },
      });
      res.status(201).json({ data: grainType });
    } catch (error) {
      next(error);
    }
  }

  async updateGrainType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, bagWeightGrams, lowStockThresholdBags, description, isActive } = req.body;
      const grainType = await prisma.grainType.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(bagWeightGrams !== undefined && { bagWeightGrams }),
          ...(lowStockThresholdBags !== undefined && { lowStockThresholdBags }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: grainType });
    } catch (error) {
      next(error);
    }
  }

  // ─── Plant & Machine Management ────────────────────────────────────────────

  async listPlants(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plants = await prisma.plant.findMany({
        include: { machines: { where: { isActive: true } } },
      });
      res.json({ data: plants });
    } catch (error) {
      next(error);
    }
  }

  async updatePlant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, location } = req.body;
      const plant = await prisma.plant.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(location !== undefined && { location }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: plant });
    } catch (error) {
      next(error);
    }
  }

  async createMachine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plantId = req.params.plantId as string;
      const { identifier, kwhRating, expectedOutputPerShift } = req.body;
      if (!identifier || kwhRating == null || expectedOutputPerShift == null) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'identifier, kwhRating, and expectedOutputPerShift are required' },
        });
        return;
      }
      const machine = await prisma.machine.create({
        data: {
          plantId,
          identifier,
          kwhRating,
          expectedOutputPerShift,
          createdBy: req.user!.userId,
        },
      });
      res.status(201).json({ data: machine });
    } catch (error) {
      next(error);
    }
  }

  async updateMachine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const machineId = req.params.machineId as string;
      const { identifier, kwhRating, expectedOutputPerShift, isActive } = req.body;
      const machine = await prisma.machine.update({
        where: { id: machineId },
        data: {
          ...(identifier !== undefined && { identifier }),
          ...(kwhRating !== undefined && { kwhRating }),
          ...(expectedOutputPerShift !== undefined && { expectedOutputPerShift }),
          ...(isActive !== undefined && { isActive }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: machine });
    } catch (error) {
      next(error);
    }
  }

  // ─── Worker Management ─────────────────────────────────────────────────────

  async listWorkers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workers = await prisma.worker.findMany({
        where: { isDeleted: false },
        include: { plant: { select: { id: true, name: true } } },
      });
      res.json({ data: workers });
    } catch (error) {
      next(error);
    }
  }

  async createWorker(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, designation, plantId, shiftCostPaisa } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }
      const worker = await prisma.worker.create({
        data: {
          name,
          designation,
          plantId,
          ...(shiftCostPaisa != null ? { shiftCostPaisa: BigInt(shiftCostPaisa) } : {}),
          createdBy: req.user!.userId,
        },
      });
      res.status(201).json({ data: { ...worker, shiftCostPaisa: worker.shiftCostPaisa?.toString() ?? null } });
    } catch (error) {
      next(error);
    }
  }

  async updateWorker(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, designation, plantId, isActive, shiftCostPaisa } = req.body;
      const worker = await prisma.worker.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(designation !== undefined && { designation }),
          ...(plantId !== undefined && { plantId }),
          ...(isActive !== undefined && { isActive }),
          ...(shiftCostPaisa !== undefined && { shiftCostPaisa: shiftCostPaisa != null ? BigInt(shiftCostPaisa) : null }),
          updatedBy: req.user!.userId,
        },
      });
      res.json({ data: { ...worker, shiftCostPaisa: worker.shiftCostPaisa?.toString() ?? null } });
    } catch (error) {
      next(error);
    }
  }

  // ─── System Settings ───────────────────────────────────────────────────────

  async listSystemSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.systemSetting.findMany();
      res.json({ data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSystemSetting(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const key = req.params.key as string;
      const { value } = req.body;
      if (value === undefined) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'value is required' } });
        return;
      }
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      res.json({ data: setting });
    } catch (error) {
      next(error);
    }
  }

  // ─── Recipe Management ──────────────────────────────────────────────────────

  async listRecipes(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const recipes = await prisma.recipe.findMany({
        where: { isDeleted: false },
        include: {
          ingredients: {
            include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
            orderBy: { ratioPercent: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ data: recipes });
    } catch (error) {
      next(error);
    }
  }

  async createRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, ingredients } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Recipe name is required' } });
        return;
      }
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one ingredient is required' } });
        return;
      }
      const totalRatio = ingredients.reduce((s: number, i: { ratioPercent: number }) => s + Number(i.ratioPercent), 0);
      if (Math.abs(totalRatio - 100) > 0.01) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: `Ingredient ratios must sum to 100%. Currently: ${totalRatio.toFixed(2)}%` },
        });
        return;
      }

      const recipe = await prisma.recipe.create({
        data: {
          name,
          description: description ?? null,
          createdBy: req.user!.userId,
          ingredients: {
            create: ingredients.map((i: { grainTypeId: string; ratioPercent: number }) => ({
              grainTypeId: i.grainTypeId,
              ratioPercent: i.ratioPercent,
            })),
          },
        },
        include: {
          ingredients: {
            include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
          },
        },
      });
      res.status(201).json({ data: recipe });
    } catch (error) {
      next(error);
    }
  }

  async updateRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, description, isActive, ingredients } = req.body;

      if (ingredients !== undefined) {
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
          res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one ingredient is required' } });
          return;
        }
        const totalRatio = ingredients.reduce((s: number, i: { ratioPercent: number }) => s + Number(i.ratioPercent), 0);
        if (Math.abs(totalRatio - 100) > 0.01) {
          res.status(422).json({
            error: { code: 'VALIDATION_ERROR', message: `Ingredient ratios must sum to 100%. Currently: ${totalRatio.toFixed(2)}%` },
          });
          return;
        }
      }

      const recipe = await prisma.$transaction(async (tx) => {
        if (ingredients !== undefined) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((i: { grainTypeId: string; ratioPercent: number }) => ({
              recipeId: id,
              grainTypeId: i.grainTypeId,
              ratioPercent: i.ratioPercent,
            })),
          });
        }
        return tx.recipe.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
            updatedBy: req.user!.userId,
          },
          include: {
            ingredients: {
              include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
              orderBy: { ratioPercent: 'desc' },
            },
          },
        });
      });
      res.json({ data: recipe });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      // Check if any variant uses this recipe
      const usageCount = await prisma.zipperVariant.count({ where: { recipeId: id, isDeleted: false } });
      if (usageCount > 0) {
        res.status(422).json({
          error: { code: 'IN_USE', message: `Cannot delete recipe — it is used by ${usageCount} variant(s). Unlink them first.` },
        });
        return;
      }
      await prisma.recipe.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.userId },
      });
      res.json({ data: { message: 'Recipe deleted' } });
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
