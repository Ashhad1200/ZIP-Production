import crypto from 'crypto';
import prisma from '../config/database';
import { AuditAction, GatePassStatus, NotificationType, Prisma, Role, Shift } from '@prisma/client';
import { generateSequenceNumber } from '../utils/sequence';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { formatPaisaToRupees } from '../utils/currency';
import { addDays, startOfDay, endOfDay } from '../utils/date';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface LineItemInput {
  variantId: string;
  meters: number;
  ratePerMeterPaisa?: number; // Optional manual override when no ClientRate exists
}

interface CreateGatePassInput {
  clientId: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  orderId?: string;
  lineItems: LineItemInput[];
}

interface GatePassListFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: GatePassStatus;
  dateFrom?: string;
  dateTo?: string;
  shift?: Shift;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface StatusUpdateInput {
  status: GatePassStatus;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GatePassService {
  /**
   * Create a gate pass atomically:
   * - Validate stock sufficiency per variant
   * - Deduct FinishedGoodsStock per line item
   * - Look up active ClientRate per client-variant pair
   * - Create journal entry (Debit AR → Credit Sales Revenue)
   * - Calculate paymentDueDate from client.paymentCycleDays
   * - Generate crypto-random verifyToken (64 chars, 48h expiry)
   * - If orderId linked, update Order.metersDelivered and auto-complete
   * - Generate sequential gate pass number (GP-YYYY-NNNNN)
   * - Create audit log entry
   */
  async create(input: CreateGatePassInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch client
      const client = await tx.client.findUnique({
        where: { id: input.clientId, isDeleted: false },
        include: { account: true },
      });
      if (!client) {
        throw Object.assign(new Error('Client not found'), {
          statusCode: 404,
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // 2. Fetch issuing manager name
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (!user) {
        throw Object.assign(new Error('User not found'), {
          statusCode: 404,
          code: 'USER_NOT_FOUND',
        });
      }

      if (input.lineItems.length === 0) {
        throw Object.assign(new Error('At least one line item is required'), {
          statusCode: 422,
          code: 'VALIDATION_ERROR',
        });
      }

      // 3. Validate stock and look up rates for each line item
      const resolvedLines: Array<{
        variantId: string;
        meters: number;
        ratePerMeterPaisa: bigint;
        lineAmountPaisa: bigint;
      }> = [];

      for (const item of input.lineItems) {
        // Check stock
        const stock = await tx.finishedGoodsStock.findUnique({
          where: { variantId: item.variantId },
        });
        if (!stock || stock.currentMeters < item.meters) {
          const available = stock?.currentMeters ?? 0;
          throw Object.assign(
            new Error(
              `Insufficient stock for variant ${item.variantId}: requested ${item.meters}m, available ${available}m`,
            ),
            { statusCode: 422, code: 'INSUFFICIENT_STOCK' },
          );
        }

        // Look up active rate: priority order:
        // 1. Manual override from request (ratePerMeterPaisa field)
        // 2. Active ClientRate record
        // 3. Rate from the linked order's line item (order already has rates per variant)
        let ratePerMeterPaisa: bigint | null = null;

        if (item.ratePerMeterPaisa != null && item.ratePerMeterPaisa > 0) {
          ratePerMeterPaisa = BigInt(item.ratePerMeterPaisa);
        } else {
          const now = new Date();
          const clientRate = await tx.clientRate.findFirst({
            where: {
              clientId: input.clientId,
              variantId: item.variantId,
              isDeleted: false,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
            },
            orderBy: { effectiveFrom: 'desc' },
          });
          if (clientRate) {
            ratePerMeterPaisa = clientRate.ratePerMeterPaisa;
          } else if (input.orderId) {
            // Fall back to the rate stored on the linked order's line item
            const orderLineItem = await tx.orderLineItem.findFirst({
              where: { orderId: input.orderId, variantId: item.variantId },
            });
            if (orderLineItem) {
              ratePerMeterPaisa = orderLineItem.ratePerMeterPaisa;
            }
          }
        }

        if (!ratePerMeterPaisa) {
          throw Object.assign(
            new Error(`No rate found for client ${client.name} and variant ${item.variantId}. Link the gate pass to an order with rates, or set up a Client Rate.`),
            { statusCode: 422, code: 'RATE_NOT_FOUND' },
          );
        }

        const lineAmountPaisa = ratePerMeterPaisa * BigInt(item.meters);
        resolvedLines.push({
          variantId: item.variantId,
          meters: item.meters,
          ratePerMeterPaisa: ratePerMeterPaisa,
          lineAmountPaisa,
        });
      }

      // 3b. If order linked, validate delivery meters do not exceed remaining per variant
      if (input.orderId) {
        const orderLineItems = await tx.orderLineItem.findMany({
          where: { orderId: input.orderId },
        });
        for (const gpLine of resolvedLines) {
          const oli = orderLineItems.find((li) => li.variantId === gpLine.variantId);
          if (oli) {
            const remaining = oli.metersOrdered - oli.metersDelivered;
            if (gpLine.meters > remaining) {
              throw Object.assign(
                new Error(
                  `Delivery for variant ${gpLine.variantId} exceeds ordered quantity. Ordered: ${oli.metersOrdered}m, Already delivered: ${oli.metersDelivered}m, Remaining: ${remaining}m, Requested: ${gpLine.meters}m`,
                ),
                { statusCode: 422, code: 'DELIVERY_EXCEEDS_ORDER' },
              );
            }
          }
        }
      }

      // 4. Deduct stock for each line
      for (const line of resolvedLines) {
        await tx.finishedGoodsStock.update({
          where: { variantId: line.variantId },
          data: {
            currentMeters: { decrement: line.meters },
            updatedBy: userId,
          },
        });
      }

      // 5. Calculate totals
      const totalAmountPaisa = resolvedLines.reduce(
        (sum, l) => sum + l.lineAmountPaisa,
        0n,
      );

      // 6. Payment due date
      const gatePassDate = new Date(`${input.date}T00:00:00.000Z`);
      const paymentDueDate = addDays(gatePassDate, client.paymentCycleDays);

      // 7. Generate verify token (64 hex chars = 32 random bytes)
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // 8. Generate sequential gate pass number
      const gatePassNumber = await generateSequenceNumber('GP', 'gatePass');

      // 9. Create journal entry (Debit AR → Credit Sales Revenue)
      const arAccount = await accountingService.getAccountByCode('1200', tx); // Accounts Receivable
      const revenueAccount = await accountingService.getAccountByCode('4100', tx); // Sales Revenue

      const journalEntry = await accountingService.createJournalEntry(
        {
          entryNumber: `JE-${gatePassNumber}`,
          entryDate: gatePassDate,
          description: `Sales via gate pass ${gatePassNumber} to ${client.name}`,
          referenceType: 'GATE_PASS',
          referenceId: '', // Will update after creation
          lines: [
            {
              accountId: arAccount.id,
              clientId: client.id,
              description: `AR - ${client.name}`,
              debitAmountPaisa: totalAmountPaisa,
              creditAmountPaisa: 0n,
            },
            {
              accountId: revenueAccount.id,
              description: `Sales Revenue - ${gatePassNumber}`,
              debitAmountPaisa: 0n,
              creditAmountPaisa: totalAmountPaisa,
            },
          ],
          userId,
          autoPost: true,
        },
        tx,
      );

      // 10. Create gate pass
      const gatePass = await tx.gatePass.create({
        data: {
          gatePassNumber,
          clientId: input.clientId,
          date: gatePassDate,
          issuingManagerName: user.name,
          shift: input.shift,
          status: GatePassStatus.CREATED,
          orderId: input.orderId || null,
          verifyToken,
          verifyTokenExpiresAt,
          totalAmountPaisa,
          paymentDueDate,
          journalEntryId: journalEntry.id,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
            },
          },
        },
      });

      // Update journal entry referenceId now that we have the gate pass id
      await tx.journalEntry.update({
        where: { id: journalEntry.id },
        data: { referenceId: gatePass.id },
      });

      // 11. Create line items
      for (const line of resolvedLines) {
        await tx.gatePassLineItem.create({
          data: {
            gatePassId: gatePass.id,
            variantId: line.variantId,
            meters: line.meters,
            ratePerMeterPaisa: line.ratePerMeterPaisa,
            lineAmountPaisa: line.lineAmountPaisa,
          },
        });
      }

      // 12. If order linked, update metersDelivered per line item and auto-complete
      if (input.orderId) {
        const order = await tx.order.findUnique({ where: { id: input.orderId } });
        if (order) {
          // Update each OrderLineItem's metersDelivered
          for (const line of resolvedLines) {
            await tx.orderLineItem.updateMany({
              where: { orderId: input.orderId, variantId: line.variantId },
              data: { metersDelivered: { increment: line.meters } },
            });
          }

          // Recompute aggregate metersDelivered on Order
          const updatedLineItems = await tx.orderLineItem.findMany({
            where: { orderId: input.orderId },
          });
          const totalDelivered = updatedLineItems.reduce((sum, li) => sum + li.metersDelivered, 0);
          const isFullyDelivered = updatedLineItems.every(li => li.metersDelivered >= li.metersOrdered);
          const newStatus = isFullyDelivered ? 'COMPLETED' : order.status;

          await tx.order.update({
            where: { id: input.orderId },
            data: {
              metersDelivered: totalDelivered,
              status: newStatus,
              updatedBy: userId,
            },
          });
        }
      }

      // 13. Audit log
      await auditService.log({
        entityType: 'GatePass',
        entityId: gatePass.id,
        action: AuditAction.CREATE,
        newValue: {
          gatePassNumber,
          clientId: input.clientId,
          date: input.date,
          shift: input.shift,
          totalAmountPaisa: totalAmountPaisa.toString(),
          lineItems: resolvedLines.map((l) => ({
            variantId: l.variantId,
            meters: l.meters,
            ratePerMeterPaisa: l.ratePerMeterPaisa.toString(),
          })),
        },
        userId,
      });

      // Re-fetch with line items included
      const result = await tx.gatePass.findUnique({
        where: { id: gatePass.id },
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
            },
          },
        },
      });

      return this.serializeGatePass(result!);
    });
  }

  /**
   * QR verification endpoint: validate token, check expiry, mark RECEIVED.
   * Idempotent for re-scans.
   */
  async verifyToken(token: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { verifyToken: token },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: {
          include: {
            variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
          },
        },
      },
    });

    if (!gatePass) {
      throw Object.assign(new Error('Invalid verification token'), {
        statusCode: 404,
        code: 'INVALID_TOKEN',
      });
    }

    // Idempotent: if already RECEIVED, return success
    if (gatePass.status === GatePassStatus.RECEIVED) {
      return {
        id: gatePass.id,
        status: 'already_received',
        gatePassNumber: gatePass.gatePassNumber,
        clientName: gatePass.client.name,
        receivedAt: gatePass.receivedAt,
        totalAmountDisplay: formatPaisaToRupees(gatePass.totalAmountPaisa),
        lineItems: gatePass.lineItems.map((li) => ({
          variant: li.variant,
          meters: li.meters,
        })),
      };
    }

    // Check token expiry
    if (new Date() > gatePass.verifyTokenExpiresAt) {
      throw Object.assign(new Error('Verification token has expired'), {
        statusCode: 410,
        code: 'TOKEN_EXPIRED',
      });
    }

    // Mark as RECEIVED
    const now = new Date();
    const updated = await prisma.gatePass.update({
      where: { id: gatePass.id },
      data: {
        status: GatePassStatus.RECEIVED,
        receivedAt: now,
        receivedBy: 'QR_SCAN',
        version: { increment: 1 },
      },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: {
          include: {
            variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
          },
        },
      },
    });

    // Notify logistics
    await notificationService.notifyRole({
      recipientRole: Role.LOGISTICS_HEAD,
      type: NotificationType.GATE_PASS_RECEIVED,
      title: 'Gate Pass Received',
      message: `Gate pass ${updated.gatePassNumber} for ${updated.client.name} has been received via QR scan`,
      referenceType: 'GatePass',
      referenceId: updated.id,
    });

    return {
      id: updated.id,
      status: 'received',
      gatePassNumber: updated.gatePassNumber,
      clientName: updated.client.name,
      receivedAt: now,
      totalAmountDisplay: formatPaisaToRupees(updated.totalAmountPaisa),
      lineItems: updated.lineItems.map((li) => ({
        variant: li.variant,
        meters: li.meters,
      })),
    };
  }

  /**
   * Update gate pass status: CREATED → DISPATCHED → RECEIVED
   * Also supports CREATED → RECEIVED shortcut.
   */
  async updateStatus(
    id: string,
    input: StatusUpdateInput,
    expectedVersion: number,
    userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const gatePass = await tx.gatePass.findUnique({
        where: { id, isDeleted: false },
      });

      if (!gatePass) {
        throw Object.assign(new Error('Gate pass not found'), {
          statusCode: 404,
          code: 'NOT_FOUND',
        });
      }

      if (gatePass.version !== expectedVersion) {
        throw Object.assign(new Error('Gate pass has been modified by another user'), {
          statusCode: 409,
          code: 'VERSION_CONFLICT',
        });
      }

      // Validate transitions
      const validTransitions: Record<string, string[]> = {
        CREATED: ['DISPATCHED', 'RECEIVED'],
        DISPATCHED: ['RECEIVED'],
        RECEIVED: [],
      };

      const allowed = validTransitions[gatePass.status] || [];
      if (!allowed.includes(input.status)) {
        throw Object.assign(
          new Error(
            `Invalid status transition: ${gatePass.status} → ${input.status}`,
          ),
          { statusCode: 422, code: 'INVALID_STATUS_TRANSITION' },
        );
      }

      const updateData: Prisma.GatePassUpdateInput = {
        status: input.status,
        updatedBy: userId,
        version: { increment: 1 },
      };

      if (input.status === GatePassStatus.RECEIVED) {
        updateData.receivedAt = new Date();
        updateData.receivedBy = userId;
      }

      const updated = await tx.gatePass.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
            },
          },
        },
      });

      await auditService.log({
        entityType: 'GatePass',
        entityId: id,
        action: AuditAction.UPDATE,
        previousValue: { status: gatePass.status },
        newValue: { status: input.status },
        changedFields: ['status'],
        userId,
      });

      return this.serializeGatePass(updated);
    });
  }

  /**
   * List gate passes with pagination and filters.
   * Role-based: strips financial fields for non-finance roles.
   */
  async list(filters: GatePassListFilters, userRole?: Role) {
    const page = filters.page || 1;
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GatePassWhereInput = { isDeleted: false };

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;
    if (filters.shift) where.shift = filters.shift;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = startOfDay(filters.dateFrom);
      if (filters.dateTo) where.date.lte = endOfDay(filters.dateTo);
    }

    const sortBy = filters.sortBy || 'date';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: Prisma.GatePassOrderByWithRelationInput =
      sortBy === 'client'
        ? { client: { name: sortOrder } }
        : { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      prisma.gatePass.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          client: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
            },
          },
        },
      }),
      prisma.gatePass.count({ where }),
    ]);

    const financeRoles: Role[] = [Role.SUPER_ADMIN, Role.FINANCE_HEAD, Role.LOGISTICS_HEAD];
    const stripFinance =
      userRole && !financeRoles.includes(userRole);

    const serialized = data.map((gp) => {
      const s = this.serializeGatePass(gp);
      if (stripFinance) {
        s.totalAmountPaisa = undefined as unknown as string;
        s.totalAmountDisplay = undefined as unknown as string;
        s.lineItems = s.lineItems.map((li: Record<string, unknown>) => ({
          ...li,
          ratePerMeterPaisa: undefined,
          lineAmountPaisa: undefined,
          lineAmountDisplay: undefined,
        }));
      }
      return s;
    });

    return {
      data: serialized,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single gate pass by ID with full details.
   */
  async getById(id: string) {
    const gatePass = await prisma.gatePass.findUnique({
      where: { id, isDeleted: false },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            phone: true,
            address: true,
            paymentCycleDays: true,
          },
        },
        order: { select: { id: true, orderNumber: true, metersOrdered: true, metersDelivered: true, status: true } },
        lineItems: {
          include: {
            variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
          },
        },
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            status: true,
          },
        },
      },
    });

    if (!gatePass) {
      throw Object.assign(new Error('Gate pass not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return this.serializeGatePass(gatePass);
  }

  /**
   * Get PDF data for a gate pass (same as getById but structured for PDF rendering).
   */
  async getPdfData(id: string) {
    return this.getById(id);
  }

  /**
   * Lookup: get clients for dropdown.
   */
  async getClients() {
    return prisma.client.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, paymentCycleDays: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lookup: get variants for dropdown.
   */
  async getVariants() {
    return prisma.zipperVariant.findMany({
      where: { isDeleted: false },
      select: { id: true, code: true, name: true, metersPerCarton: true },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Lookup: get orders for a client (pending/ongoing only).
   */
  async getClientOrders(clientId: string) {
    return prisma.order.findMany({
      where: {
        clientId,
        isDeleted: false,
        status: { in: ['PENDING', 'ONGOING'] },
      },
      select: {
        id: true,
        orderNumber: true,
        metersOrdered: true,
        metersDelivered: true,
        lineItems: {
          select: {
            variantId: true,
            variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
            metersOrdered: true,
            metersDelivered: true,
            ratePerMeterPaisa: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lookup: get active client rate for a client-variant pair.
   */
  async getClientRate(clientId: string, variantId: string) {
    const now = new Date();
    const rate = await prisma.clientRate.findFirst({
      where: {
        clientId,
        variantId,
        isDeleted: false,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rate
      ? {
          ratePerMeterPaisa: rate.ratePerMeterPaisa.toString(),
          ratePerMeterDisplay: formatPaisaToRupees(rate.ratePerMeterPaisa),
        }
      : null;
  }

  /**
   * Lookup: check stock availability for a variant.
   */
  async getStockForVariant(variantId: string) {
    const stock = await prisma.finishedGoodsStock.findUnique({
      where: { variantId },
      select: { currentMeters: true },
    });
    return { availableMeters: stock?.currentMeters ?? 0 };
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeGatePass(gp: any) {
    return {
      id: gp.id,
      gatePassNumber: gp.gatePassNumber,
      client: gp.client,
      date: gp.date instanceof Date ? gp.date.toISOString().split('T')[0] : gp.date,
      issuingManagerName: gp.issuingManagerName,
      shift: gp.shift,
      status: gp.status,
      order: gp.order ?? null,
      totalAmountPaisa: gp.totalAmountPaisa.toString(),
      totalAmountDisplay: formatPaisaToRupees(gp.totalAmountPaisa),
      paymentDueDate:
        gp.paymentDueDate instanceof Date
          ? gp.paymentDueDate.toISOString().split('T')[0]
          : gp.paymentDueDate,
      receivedAt: gp.receivedAt?.toISOString() ?? null,
      receivedBy: gp.receivedBy ?? null,
      receiptPhotoUrl: gp.receiptPhotoUrl ?? null,
      journalEntry: gp.journalEntry ?? null,
      lineItems: (gp.lineItems || []).map((li: Record<string, unknown>) => ({
        id: li.id,
        variant: li.variant,
        meters: li.meters,
        ratePerMeterPaisa: String(li.ratePerMeterPaisa),
        ratePerMeterDisplay: formatPaisaToRupees(li.ratePerMeterPaisa as bigint),
        lineAmountPaisa: String(li.lineAmountPaisa),
        lineAmountDisplay: formatPaisaToRupees(li.lineAmountPaisa as bigint),
      })),
      verifyToken: gp.verifyToken,
      createdAt: gp.createdAt?.toISOString(),
      updatedAt: gp.updatedAt?.toISOString(),
      version: gp.version,
    };
  }

  /**
   * Attach a receipt photo URL to a gate pass after RECEIVED confirmation.
   * Can be called from the public QR-verify flow (no auth — uses verifyToken) or
   * from authenticated endpoints (userId provided).
   */
  async uploadReceiptPhoto(id: string, photoUrl: string, options: { token?: string; userId?: string }) {
    const gatePass = await prisma.gatePass.findUnique({ where: { id, isDeleted: false } });

    if (!gatePass) {
      throw Object.assign(new Error('Gate pass not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    // Validate token when coming from public QR flow
    if (options.token) {
      if (gatePass.verifyToken !== options.token) {
        throw Object.assign(new Error('Invalid verify token'), { statusCode: 401, code: 'INVALID_TOKEN' });
      }
    }

    if (gatePass.status !== GatePassStatus.RECEIVED) {
      throw Object.assign(
        new Error('Receipt photo can only be uploaded after gate pass is marked RECEIVED'),
        { statusCode: 422, code: 'INVALID_STATUS' }
      );
    }

    const updated = await prisma.gatePass.update({
      where: { id },
      data: {
        receiptPhotoUrl: photoUrl,
        updatedBy: options.userId ?? 'system',
      },
    });

    // Best-effort audit — skip if no valid userId (e.g. public QR flow)
    if (options.userId) {
      try {
        await auditService.log({
          entityType: 'GatePass',
          entityId: id,
          action: AuditAction.UPDATE,
          newValue: { receiptPhotoUrl: photoUrl },
          changedFields: ['receiptPhotoUrl'],
          userId: options.userId,
        });
      } catch {
        // Audit failure must not block photo upload
      }
    }

    return { id: updated.id, receiptPhotoUrl: updated.receiptPhotoUrl };
  }
}

export const gatePassService = new GatePassService();
