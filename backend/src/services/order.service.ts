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

interface CreateOrderInput {
  clientId: string;
  variantId: string;
  metersOrdered: number;
  ratePerMeterPaisa: number;
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

    // 2. Validate variant exists
    const variant = await prisma.zipperVariant.findUnique({
      where: { id: input.variantId, isDeleted: false },
      select: { id: true, code: true, name: true },
    });
    if (!variant) {
      throw Object.assign(new Error('Variant not found'), {
        statusCode: 404,
        code: 'VARIANT_NOT_FOUND',
      });
    }

    // 3. Validate rate
    if (input.ratePerMeterPaisa <= 0) {
      throw Object.assign(new Error('Rate per meter must be greater than zero'), {
        statusCode: 422,
        code: 'INVALID_RATE',
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

    // 5. Calculate total
    const totalAmountPaisa = BigInt(input.metersOrdered) * BigInt(input.ratePerMeterPaisa);

    // 6. Generate order number
    const orderNumber = await generateSequenceNumber('ORD', 'order');

    // 7. Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        clientId: input.clientId,
        variantId: input.variantId,
        metersOrdered: input.metersOrdered,
        ratePerMeterPaisa: BigInt(input.ratePerMeterPaisa),
        totalAmountPaisa,
        deliveryDeadline: deadline,
        status: OrderStatus.PENDING,
        createdBy: userId,
      },
    });

    // 8. Calculate client outstanding
    const clientOutstandingPaisa = await this.getClientOutstanding(input.clientId);

    // 9. Send notification to PRODUCTION_HEAD (no financial details)
    await notificationService.notifyRole({
      recipientRole: Role.PRODUCTION_HEAD,
      type: NotificationType.ORDER_CREATED,
      title: 'New Order Received',
      message: `Order ${orderNumber}: ${client.name} ordered ${input.metersOrdered}m of ${variant.name}. Deadline: ${formatDatePKT(deadline)}. No financial details — contact Finance Head.`,
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
        variantId: input.variantId,
        metersOrdered: input.metersOrdered,
        ratePerMeterPaisa: input.ratePerMeterPaisa,
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

    if (params.clientId) where.clientId = params.clientId;
    if (params.status) where.status = params.status;
    if (params.variantId) where.variantId = params.variantId;

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
          variant: { select: { id: true, code: true, name: true } },
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
        variant: order.variant,
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: Math.round((order.metersDelivered / order.metersOrdered) * 100),
        isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
        deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
        status: order.status,
        ratePerMeterPaisa: order.ratePerMeterPaisa.toString(),
        ratePerMeterDisplay: formatPaisaToRupees(order.ratePerMeterPaisa),
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
        variant: { select: { id: true, code: true, name: true } },
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
      variant: order.variant,
      metersOrdered: order.metersOrdered,
      metersDelivered: order.metersDelivered,
      fulfillmentPercent: Math.round((order.metersDelivered / order.metersOrdered) * 100),
      isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
      deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
      status: order.status,
      ratePerMeterPaisa: order.ratePerMeterPaisa.toString(),
      ratePerMeterDisplay: formatPaisaToRupees(order.ratePerMeterPaisa),
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
        variant: { select: { id: true, code: true, name: true } },
      },
    });

    const now = new Date();
    const serialized = orders.map((order) => {
      const mapped: Record<string, unknown> = {
        id: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        variant: order.variant,
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: Math.round((order.metersDelivered / order.metersOrdered) * 100),
        isOverdue: order.status !== OrderStatus.COMPLETED && order.deliveryDeadline < now,
        deliveryDeadline: order.deliveryDeadline.toISOString().split('T')[0],
        status: order.status,
        ratePerMeterPaisa: order.ratePerMeterPaisa.toString(),
        ratePerMeterDisplay: formatPaisaToRupees(order.ratePerMeterPaisa),
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
        variant: { select: { id: true, code: true, name: true } },
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
        variantCode: order.variant.code,
        metersOrdered: order.metersOrdered,
        metersDelivered: order.metersDelivered,
        fulfillmentPercent: Math.round((order.metersDelivered / order.metersOrdered) * 100),
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
