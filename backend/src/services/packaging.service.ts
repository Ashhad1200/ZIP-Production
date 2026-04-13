import prisma from '../config/database';

export class PackagingService {
  private serializeMaterial(m: {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    ratePerUnitPaisa: bigint;
    lowStockThreshold: number | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...m,
      ratePerUnitPaisa: Number(m.ratePerUnitPaisa),
      isBelowThreshold:
        m.lowStockThreshold != null && m.currentStock <= m.lowStockThreshold,
    };
  }

  private serializeAdjustment(a: {
    id: string;
    materialId: string;
    quantity: number;
    type: string;
    unitRatePaisa: bigint | null;
    totalCostPaisa: bigint | null;
    vendorId: string | null;
    purchaseDate: Date | null;
    referenceType: string | null;
    referenceId: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: Date;
    vendor?: { id: string; name: string } | null;
  }) {
    return {
      ...a,
      unitRatePaisa: a.unitRatePaisa != null ? Number(a.unitRatePaisa) : null,
      totalCostPaisa: a.totalCostPaisa != null ? Number(a.totalCostPaisa) : null,
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString() : null,
      vendor: a.vendor ?? null,
    };
  }

  async listMaterials() {
    const materials = await prisma.packagingMaterial.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return materials.map((m) => this.serializeMaterial(m));
  }

  async getMaterial(id: string) {
    const m = await prisma.packagingMaterial.findFirst({ where: { id, isActive: true } });
    if (!m) throw Object.assign(new Error('Packaging material not found'), { statusCode: 404, code: 'NOT_FOUND' });
    return this.serializeMaterial(m);
  }

  async createMaterial(data: {
    name: string;
    unit?: string;
    ratePerUnitPaisa?: number;
    lowStockThreshold?: number;
    notes?: string;
  }) {
    const created = await prisma.packagingMaterial.create({
      data: {
        name: data.name,
        unit: data.unit,
        ratePerUnitPaisa: BigInt(data.ratePerUnitPaisa ?? 0),
        lowStockThreshold: data.lowStockThreshold,
        notes: data.notes,
      },
    });
    return this.serializeMaterial(created);
  }

  async updateMaterial(id: string, data: {
    name?: string;
    unit?: string;
    ratePerUnitPaisa?: number;
    lowStockThreshold?: number | null;
    notes?: string | null;
    isActive?: boolean;
  }) {
    await this.getMaterial(id);
    const updated = await prisma.packagingMaterial.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.ratePerUnitPaisa !== undefined && { ratePerUnitPaisa: BigInt(data.ratePerUnitPaisa) }),
        ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return this.serializeMaterial(updated);
  }

  async recordAdjustment(data: {
    materialId: string;
    quantity: number;
    type: string;
    vendorId?: string;
    purchaseDate?: string;
    ratePerUnitPaisa?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    createdBy: string;
  }) {
    const material = await prisma.packagingMaterial.findFirst({
      where: { id: data.materialId, isActive: true },
    });
    if (!material) throw Object.assign(new Error('Material not found'), { statusCode: 404, code: 'NOT_FOUND' });
    if (!Number.isFinite(data.quantity) || data.quantity === 0) {
      throw Object.assign(new Error('Adjustment quantity must be a non-zero number'), {
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      });
    }
    if (material.currentStock + data.quantity < 0) {
      throw Object.assign(new Error('Insufficient packaging stock for this adjustment'), {
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
      });
    }
    const unitRatePaisa = data.ratePerUnitPaisa != null
      ? BigInt(data.ratePerUnitPaisa)
      : material.ratePerUnitPaisa;
    const totalCostPaisa = unitRatePaisa * BigInt(Math.abs(data.quantity));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.packagingStockAdjustment.create({
        data: {
          materialId: data.materialId,
          quantity: data.quantity,
          type: data.type,
          unitRatePaisa,
          totalCostPaisa,
          vendorId: data.vendorId || null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          notes: data.notes,
          createdBy: data.createdBy,
        },
      });
      // If a specific rate was provided for a purchase, also update the material's rate
      if (data.type === 'PURCHASE' && data.ratePerUnitPaisa != null) {
        return tx.packagingMaterial.update({
          where: { id: data.materialId },
          data: {
            currentStock: { increment: data.quantity },
            ratePerUnitPaisa: BigInt(data.ratePerUnitPaisa),
          },
        });
      }
      return tx.packagingMaterial.update({
        where: { id: data.materialId },
        data: { currentStock: { increment: data.quantity } },
      });
    });
    return this.serializeMaterial(updated);
  }

  async listAdjustments(materialId: string) {
    const adjustments = await prisma.packagingStockAdjustment.findMany({
      where: { materialId },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return adjustments.map((a) => this.serializeAdjustment(a));
  }

  async listAllPurchases() {
    const adjustments = await prisma.packagingStockAdjustment.findMany({
      where: { type: 'PURCHASE' },
      include: {
        vendor: { select: { id: true, name: true } },
        material: { select: { id: true, name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return adjustments.map((a) => ({
      ...this.serializeAdjustment(a),
      material: (a as any).material ?? null,
    }));
  }
}

export const packagingService = new PackagingService();
