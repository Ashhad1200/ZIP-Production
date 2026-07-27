import prisma from '../config/database';
import { NotificationType, OrderStatus, Prisma, Role } from '@prisma/client';
import { AuditAction } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { formatDatePKT } from '../utils/date';
import { generateSequenceNumber } from '../utils/sequence';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { stripFinancialFields, stripFinancialFieldsFromList } from '../utils/serializer';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface LineItemInput {
  variantId: string;
  metersOrdered: number;
  ratePerMeterPaisa: number;
}

interface CreateOrderInput {
  clientId: string;
  lineItems: LineItemInput[];
  deliveryDeadline: string; // YYYY-MM-DD
}

interface ListOrdersParams {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: OrderStatus;
  variantId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class OrderService {
  /**
   * Create a new order:
   * - Validate client and variant exist
   * - Validate rate and deadline
   * - Calculate total amount
   * - Generate sequential order number (ORD-YYYY-NNNNN)
   * - Send notification to PRODUCTION_HEAD (no financial details)
   * - Create audit log entry
   */
  async createOrder(input: CreateOrderInput, userId: string) {
    // 1. Validate client exists
    const client = await prisma.client.findUnique({
      where: { id: input.clientId, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!client) {
      throw Object.assign(new Error('Client not found'), {
        statusCode: 404,
        code: 'CLIENT_NOT_FOUND',
      });
    }

    // 2. Validate line items
    if (!input.lineItems || input.lineItems.length === 0) {
      throw Object.assign(new Error('At least one line item is required'), {
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      });
    }

    // 3. Validate each line item's variant, rate, and meters
    const resolvedItems: Array<{ variantId: string; variantName: string; metersOrdered: number; ratePerMeterPaisa: bigint; lineAmountPaisa: bigint }> = [];

    for (const item of input.lineItems) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId, isDeleted: false },
        select: { id: true, code: true, name: true },
      });
      if (!variant) {
        throw Object.assign(new Error(`Variant not found: ${item.variantId}`), {
          statusCode: 404,
          code: 'VARIANT_NOT_FOUND',
        });
      }
      if (item.ratePerMeterPaisa <= 0) {
        throw Object.assign(new Error(`Rate for variant ${variant.code} must be greater than zero`), {
          statusCode: 422,
          code: 'INVALID_RATE',
        });
      }
      if (item.metersOrdered <= 0) {
        throw Object.assign(new Error(`Meters for variant ${variant.code} must be greater than zero`), {
          statusCode: 422,
          code: 'INVALID_METERS',
        });
      }
      const lineAmountPaisa = BigInt(item.metersOrdered) * BigInt(item.ratePerMeterPaisa);
      resolvedItems.push({
        variantId: item.variantId,
        variantName: variant.name,
        metersOrdered: item.metersOrdered,
        ratePerMeterPaisa: BigInt(item.ratePerMeterPaisa),
        lineAmountPaisa,
      });
    }

    // 4. Validate deadline is in the future
    const deadline = new Date(input.deliveryDeadline + 'T00:00:00.000Z');
    if (deadline <= new Date()) {
      throw Object.assign(new Error('Delivery deadline must be in the future'), {
        statusCode: 422,
        code: 'INVALID_DEADLINE',
      });
    }

    // 5. Compute aggregates
    const totalMetersOrdered = resolvedItems.reduce((sum, li) => sum + li.metersOrdered, 0);
    const totalAmountPaisa = resolvedItems.reduce((sum, li) => sum + li.lineAmountPaisa, BigInt(0));

    // 6. Generate order number
    const orderNumber = await generateSequenceNumber('ORD', 'order');

    // 7. Create order + line items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          clientId: input.clientId,
          metersOrdered: totalMetersOrdered,
          totalAmountPaisa,
          deliveryDeadline: deadline,
          status: OrderStatus.PENDING_APPROVAL,
          createdBy: userId,
        },
      });

      for (const li of resolvedItems) {
        await tx.orderLineItem.create({
          data: {
            orderId: created.id,
            variantId: li.variantId,
            metersOrdered: li.metersOrdered,
            ratePerMeterPaisa: li.ratePerMeterPaisa,
          },
        });
      }

      return created;
    });

    // 8. Calculate client outstanding
    const clientOutstandingPaisa = await this.getClientOutstanding(input.clientId);

    // 9. Notify FINANCE_HEAD to approve
    const variantNames = resolvedItems.map((li) => li.variantName).join(', ');
    await notificationService.notifyRole({
      recipientRole: Role.FINANCE_HEAD,
      type: NotificationType.ORDER_CREATED,
      title: 'New Order Awaiting Approval',
      message: `Order ${orderNumber}: ${client.name} ordered ${totalMetersOrdered}m of ${variantNames}. Deadline: ${formatDatePKT(deadline)}. Please review and approve.`,
      referenceType: 'Order',
      referenceId: order.id,
    });

    // 10. Audit log
    await auditService.log({
      entityType: 'Order',
      entityId: order.id,
      action: AuditAction.CREATE,
      newValue: {
        orderNumber,
        clientId: input.clientId,
        lineItems: resolvedItems.map((li) => ({
          variantId: li.variantId,
          metersOrdered: li.metersOrdered,
          ratePerMeterPaisa: li.ratePerMeterPaisa.toString(),
        })),
        totalAmountPaisa: totalAmountPaisa.toString(),
        deliveryDeadline: input.deliveryDeadline,
      },
      userId,
    });

    return {
      id: order.id,
      orderNumber,
      status: order.status,
      totalAmountPaisa: totalAmountPaisa.toString(),
      totalAmountDisplay: formatPaisaToRupees(totalAmountPaisa),
      clientOutstandingPaisa: clientOutstandingPaisa.toString(),
      clientOutstandingDisplay: formatPaisaToRupees(clientOutstandingPaisa),
      notificationSent: true,
      version: 1,
    };
  }

  /**
   * List orders with pagination and filters.
   * Role-based: strips financial fields for restricted roles.
   */
  async listOrders(params: ListOrdersParams, userRole: Role) {
    const page = params.page || 1;
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { isDeleted: false };

    // Role-based filter: PRODUCTION_HEAD cannot see PENDING_APPROVAL orders
    if (userRole === Role.PRODUCTION_HEAD) {
      if (params.status === OrderStatus.PENDING_APPROVAL) {
        // Return empty for production trying to view approval queue
        return { data: [], meta: { page: 1, limit, total: 0, totalPages: 0 } };
      }
      where.status = params.status
        ? params.status
        : { not: OrderStatus.PENDING_APPROVAL };
    } else if (params.status) {
      where.status = params.status;
    }

    if (params.clientId) where.clientId = params.clientId;
    if (params.variantId) where.lineItems = { some: { variantId: params.variantId } };

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom + 'T00:00:00.000Z');
      if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + 'T23:59:59.999Z');
    }

    if (params.overdue) {
      where.status = { not: OrderStatus.COMPLETED };
      where.deliveryDeadline = { lt: new Date() };
    }

    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      sortBy === 'client'
        ? { client: { name: sortOrder } }
        : { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          client: { select: { id: true, name: true } },
          lineItems: {
            select: {
              id: true,
              variantId: true,
              variant: { select: { id: true, code: true, name: true } },
              metersOrdered: true,
              metersDelivered: true,
              ratePerMeterPaisa: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const now = new Date();
    const serialized = data.map((order) => {
      const mapped: Record<string, unknown> = {
        id: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        lineItems: order.lineItems.map((li) => ({
          id: li.id,
          variantId: li.variantId,
          variant: li.variant,
          metersOrdered: li.metersOrdered,
          metersDelivered: li.metersDelivered,
          ratePerMeterPaisa: li.ratePerMeterPaisa.toString(),
          ratePerMeterDisplay: formatPaisaToRupees(li.ratePerMeterPaisa),
        })),
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: order.metersOrdered > 0
          ? Math.round((order.metersDelivered / order.metersOrdered) * 100)
          : 0,
        isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
        deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
        status: order.status,
        totalAmountPaisa: order.totalAmountPaisa.toString(),
        totalAmountDisplay: formatPaisaToRupees(order.totalAmountPaisa),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        version: order.version,
      };
      return stripFinancialFields(mapped, userRole);
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
   * Get a single order by ID with full details.
   * Role-based: strips financial fields for restricted roles.
   */
  async getOrderById(id: string, userRole: Role) {
    const order = await prisma.order.findUnique({
      where: { id, isDeleted: false },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: {
          select: {
            id: true,
            variantId: true,
            variant: { select: { id: true, code: true, name: true } },
            metersOrdered: true,
            metersDelivered: true,
            ratePerMeterPaisa: true,
          },
        },
        gatePasses: {
          where: { isDeleted: false },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            gatePassNumber: true,
            date: true,
            status: true,
            totalAmountPaisa: true,
            lineItems: {
              select: {
                id: true,
                meters: true,
                variant: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw Object.assign(new Error('Order not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    const now = new Date();
    const clientOutstandingPaisa = await this.getClientOutstanding(order.clientId);

    const result: Record<string, unknown> = {
      id: order.id,
      orderNumber: order.orderNumber,
      client: order.client,
      lineItems: order.lineItems.map((li) => ({
        id: li.id,
        variantId: li.variantId,
        variant: li.variant,
        metersOrdered: li.metersOrdered,
        metersDelivered: li.metersDelivered,
        ratePerMeterPaisa: li.ratePerMeterPaisa.toString(),
        ratePerMeterDisplay: formatPaisaToRupees(li.ratePerMeterPaisa),
      })),
      deliveries: order.gatePasses.map((gp) => ({
        id: gp.id,
        gatePassNumber: gp.gatePassNumber,
        date: gp.date.toISOString().split('T')[0],
        status: gp.status,
        totalAmountPaisa: gp.totalAmountPaisa.toString(),
        totalAmountDisplay: formatPaisaToRupees(gp.totalAmountPaisa),
        lineItems: gp.lineItems.map((li) => ({
          id: li.id,
          meters: li.meters,
          variant: li.variant,
        })),
      })),
      metersOrdered: order.metersOrdered,
      metersDelivered: order.metersDelivered,
      fulfillmentPercent: order.metersOrdered > 0
        ? Math.round((order.metersDelivered / order.metersOrdered) * 100)
        : 0,
      isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
      deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
      status: order.status,
      totalAmountPaisa: order.totalAmountPaisa.toString(),
      totalAmountDisplay: formatPaisaToRupees(order.totalAmountPaisa),
      clientOutstandingPaisa: clientOutstandingPaisa.toString(),
      clientOutstandingDisplay: formatPaisaToRupees(clientOutstandingPaisa),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      version: order.version,
    };

    return stripFinancialFields(result, userRole);
  }

  /**
   * Get all orders for a specific client.
   * Role-based: strips financial fields for restricted roles.
   */
  async getOrdersByClient(clientId: string, userRole: Role) {
    const orders = await prisma.order.findMany({
      where: { clientId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: {
          select: {
            id: true,
            variantId: true,
            variant: { select: { id: true, code: true, name: true } },
            metersOrdered: true,
            metersDelivered: true,
            ratePerMeterPaisa: true,
          },
        },
      },
    });

    const now = new Date();
    const serialized = orders.map((order) => {
      const mapped: Record<string, unknown> = {
        id: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        lineItems: order.lineItems.map((li) => ({
          id: li.id,
          variantId: li.variantId,
          variant: li.variant,
          metersOrdered: li.metersOrdered,
          metersDelivered: li.metersDelivered,
          ratePerMeterPaisa: li.ratePerMeterPaisa.toString(),
          ratePerMeterDisplay: formatPaisaToRupees(li.ratePerMeterPaisa),
        })),
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: order.metersOrdered > 0
          ? Math.round((order.metersDelivered / order.metersOrdered) * 100)
          : 0,
        isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
        deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
        status: order.status,
        totalAmountPaisa: order.totalAmountPaisa.toString(),
        totalAmountDisplay: formatPaisaToRupees(order.totalAmountPaisa),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        version: order.version,
      };
      return mapped;
    });

    return stripFinancialFieldsFromList(serialized, userRole);
  }

  /**
   * Get fulfillment report across all orders.
   * Returns summary counts and per-order details.
   */
  async getFulfillmentReport() {
    const orders = await prisma.order.findMany({
      where: { isDeleted: false },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: {
          select: {
            variant: { select: { code: true } },
          },
        },
      },
      orderBy: { deliveryDeadline: 'asc' },
    });

    const now = new Date();
    let pending = 0;
    let ongoing = 0;
    let completed = 0;
    let overdue = 0;

    const mapped = orders.map((order) => {
      if (order.status === OrderStatus.PENDING) pending++;
      else if (order.status === OrderStatus.ONGOING) ongoing++;
      else if (order.status === OrderStatus.COMPLETED) completed++;

      const isOverdue = order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now;
      if (isOverdue) overdue++;

      const diffMs = order.deliveryDeadline.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        orderNumber: order.orderNumber,
        clientName: order.client.name,
        variantCode: order.lineItems.map((li) => li.variant.code).join(', '),
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: order.metersOrdered > 0
          ? Math.round((order.metersDelivered / order.metersOrdered) * 100)
          : 0,
        deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
        status: order.status,
        daysRemaining,
      };
    });

    return {
      summary: {
        totalOrders: orders.length,
        pending,
        ongoing,
        completed,
        overdue,
      },
      orders: mapped,
    };
  }

  /**
   * Approve a PENDING_APPROVAL order — moves it to PENDING and notifies production.
   */
  async approveOrder(id: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id, isDeleted: false },
      include: {
        client: true,
        lineItems: { include: { variant: { select: { name: true } } } },
      },
    });
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (order.status !== OrderStatus.PENDING_APPROVAL) {
      throw Object.assign(new Error('Only PENDING_APPROVAL orders can be approved'), { statusCode: 422 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.PENDING, updatedBy: userId, version: { increment: 1 } },
    });

    const variantNames = order.lineItems.map((li) => li.variant.name).join(', ');
    await notificationService.notifyRole({
      recipientRole: Role.PRODUCTION_HEAD,
      type: NotificationType.ORDER_CREATED,
      title: 'Order Approved — Ready for Production',
      message: `Order ${order.orderNumber}: ${order.client.name} ordered ${order.metersOrdered}m of ${variantNames}. Deadline: ${formatDatePKT(order.deliveryDeadline)}.`,
      referenceType: 'Order',
      referenceId: order.id,
    });

    await auditService.log({ entityType: 'Order', entityId: id, action: AuditAction.UPDATE, newValue: { status: 'PENDING' }, userId });
    return { id: updated.id, status: updated.status, version: updated.version };
  }

  /**
   * Reject a PENDING_APPROVAL order — marks it COMPLETED (as cancelled equivalent).
   */
  async rejectOrder(id: string, reason: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id, isDeleted: false } });
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (order.status !== OrderStatus.PENDING_APPROVAL) {
      throw Object.assign(new Error('Only PENDING_APPROVAL orders can be rejected'), { statusCode: 422 });
    }

    await prisma.order.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    });

    await auditService.log({ entityType: 'Order', entityId: id, action: AuditAction.SOFT_DELETE, newValue: { reason }, userId });
    return { id, status: 'REJECTED', reason };
  }

  // ─── Helper ──────────────────────────────────────────────────────────────────

  /**
   * Calculate client outstanding balance from journal entry lines.
   * Outstanding = sum(debitAmountPaisa) - sum(creditAmountPaisa)
   */
  private async getClientOutstanding(clientId: string): Promise<bigint> {
    const result = await prisma.journalEntryLine.aggregate({
      where: { clientId },
      _sum: {
        debitAmountPaisa: true,
        creditAmountPaisa: true,
      },
    });

    const totalDebit = result._sum.debitAmountPaisa ?? BigInt(0);
    const totalCredit = result._sum.creditAmountPaisa ?? BigInt(0);
    return totalDebit - totalCredit;
  }
}

export const orderService = new OrderService();
