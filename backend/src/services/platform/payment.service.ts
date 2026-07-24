import prisma from '../../config/database';

export interface SubmitPaymentInput {
  organizationId: string;
  amountClaimedPaisa: bigint;
  screenshotUrl: string;
  transactionRef?: string;
  bankAccountId?: string;
}

export class PaymentService {
  /**
   * Tenant submits proof of a manual bank transfer. Follows the same
   * "client uploads the file elsewhere, backend stores the resulting URL"
   * convention as GatePass.receiptPhotoUrl (see gate-pass.service.ts).
   */
  async submit(input: SubmitPaymentInput) {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw Object.assign(new Error('No subscription found for this organization'), {
        statusCode: 404,
        code: 'NO_SUBSCRIPTION',
      });
    }

    return prisma.payment.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: subscription.id,
        planId: subscription.planId,
        bankAccountId: input.bankAccountId,
        amountClaimedPaisa: input.amountClaimedPaisa,
        screenshotUrl: input.screenshotUrl,
        transactionRef: input.transactionRef,
        status: 'PENDING',
      },
    });
  }

  async list(status?: 'PENDING' | 'VERIFIED' | 'REJECTED') {
    return prisma.payment.findMany({
      where: status ? { status } : undefined,
      include: { organization: true, plan: true, bankAccount: true },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Approve a payment: activates (or renews) the subscription and rolls the
   * organization out of TRIAL/PAST_DUE into ACTIVE.
   */
  async verify(paymentId: string, adminId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });
      if (!payment) {
        throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }
      if (payment.status !== 'PENDING') {
        throw Object.assign(new Error('Payment has already been reviewed'), { statusCode: 409, code: 'ALREADY_REVIEWED' });
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + payment.plan.billingCycleDays * 24 * 60 * 60 * 1000);

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'VERIFIED', reviewedBy: adminId, reviewedAt: now, periodStart: now, periodEnd },
      });

      if (payment.subscriptionId) {
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextDueDate: periodEnd,
          },
        });
      }

      await tx.organization.update({ where: { id: payment.organizationId }, data: { status: 'ACTIVE' } });

      return updatedPayment;
    });
  }

  async reject(paymentId: string, adminId: string, reason: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (payment.status !== 'PENDING') {
      throw Object.assign(new Error('Payment has already been reviewed'), { statusCode: 409, code: 'ALREADY_REVIEWED' });
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REJECTED', reviewedBy: adminId, reviewedAt: new Date(), rejectionReason: reason },
    });
  }
}

export const paymentService = new PaymentService();
