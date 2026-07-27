import prisma from '../config/database';
import { AuditAction } from '@prisma/client';
import { auditService } from './audit.service';

export class VendorService {
  async list(params: { includeInactive?: boolean; search?: string } = {}) {
    const { includeInactive = false, search } = params;

    const vendors = await prisma.vendor.findMany({
      where: {
        isDeleted: false,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });

    return vendors.map((v) => ({
      id: v.id,
      name: v.name,
      contactName: v.contactName,
      phone: v.phone,
      address: v.address,
      rawMaterialTypes: v.rawMaterialTypes,
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getById(id: string) {
    const vendor = await prisma.vendor.findFirst({ where: { id, isDeleted: false } });
    if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404, code: 'NOT_FOUND' });

    const purchaseCount = await prisma.rawMaterialPurchase.count({
      where: { vendorId: id, isDeleted: false },
    });

    return {
      id: vendor.id,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      address: vendor.address,
      rawMaterialTypes: vendor.rawMaterialTypes,
      isActive: vendor.isActive,
      purchaseCount,
      createdAt: vendor.createdAt.toISOString(),
    };
  }

  async create(
    input: { name: string; contactName?: string; phone?: string; address?: string; rawMaterialTypes?: string },
    userId: string
  ) {
    const existing = await prisma.vendor.findFirst({ where: { name: input.name.trim(), isDeleted: false } });
    if (existing) throw Object.assign(new Error('A vendor with this name already exists'), { statusCode: 409, code: 'DUPLICATE_NAME' });

    const vendor = await prisma.vendor.create({
      data: {
        name: input.name.trim(),
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        rawMaterialTypes: input.rawMaterialTypes?.trim() || null,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await auditService.log({
      entityType: 'Vendor',
      entityId: vendor.id,
      action: AuditAction.CREATE,
      newValue: { name: vendor.name, contactName: vendor.contactName },
      changedFields: ['name', 'contactName', 'phone', 'address', 'rawMaterialTypes'],
      userId,
    });

    return { id: vendor.id, name: vendor.name, contactName: vendor.contactName, phone: vendor.phone, isActive: vendor.isActive };
  }

  async update(
    id: string,
    input: { name?: string; contactName?: string; phone?: string; address?: string; rawMaterialTypes?: string; isActive?: boolean },
    userId: string
  ) {
    const existing = await prisma.vendor.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw Object.assign(new Error('Vendor not found'), { statusCode: 404, code: 'NOT_FOUND' });

    if (input.name && input.name.trim() !== existing.name) {
      const dup = await prisma.vendor.findFirst({ where: { name: input.name.trim(), isDeleted: false, NOT: { id } } });
      if (dup) throw Object.assign(new Error('A vendor with this name already exists'), { statusCode: 409, code: 'DUPLICATE_NAME' });
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName?.trim() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
        ...(input.rawMaterialTypes !== undefined ? { rawMaterialTypes: input.rawMaterialTypes?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    await auditService.log({
      entityType: 'Vendor',
      entityId: vendor.id,
      action: AuditAction.UPDATE,
      newValue: { name: vendor.name },
      changedFields: Object.keys(input),
      userId,
    });

    return { id: vendor.id, name: vendor.name, isActive: vendor.isActive };
  }

  async remove(id: string, userId: string) {
    const existing = await prisma.vendor.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw Object.assign(new Error('Vendor not found'), { statusCode: 404, code: 'NOT_FOUND' });

    const purchaseCount = await prisma.rawMaterialPurchase.count({ where: { vendorId: id, isDeleted: false } });
    if (purchaseCount > 0) {
      throw Object.assign(new Error(`Cannot delete vendor with ${purchaseCount} linked purchase(s)`), { statusCode: 409, code: 'HAS_PURCHASES' });
    }

    await prisma.vendor.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    });

    return { deleted: true };
  }
}

export const vendorService = new VendorService();
