import prisma from '../config/database';
import { AuditAction, Prisma } from '@prisma/client';

export class AuditService {
  /**
   * Record an audit log entry.
   */
  async log(params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    previousValue?: Record<string, unknown> | null;
    newValue: Record<string, unknown>;
    changedFields?: string[];
    userId: string;
    reason?: string;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        previousValue: (params.previousValue as Prisma.InputJsonValue) ?? undefined,
        newValue: params.newValue as Prisma.InputJsonValue,
        changedFields: params.changedFields || [],
        userId: params.userId,
        reason: params.reason,
        ipAddress: params.ipAddress,
      },
    });
  }
  
  /**
   * Get audit log for a specific entity.
   */
  async getEntityAuditLog(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
    });
  }
}

export const auditService = new AuditService();
