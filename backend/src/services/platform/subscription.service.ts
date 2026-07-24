import prisma from '../../config/database';

/**
 * Recompute a subscription's status against the current time. Called lazily
 * (on backoffice reads and on tenant auth) rather than via a cron job —
 * correctness doesn't depend on a scheduler running.
 */
export async function recomputeSubscriptionStatus(subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return null;

  const now = new Date();
  let nextStatus = sub.status;

  if (sub.status === 'TRIAL' && now > sub.trialEndsAt) {
    nextStatus = 'PAST_DUE';
  } else if (sub.status === 'ACTIVE' && sub.nextDueDate && now > sub.nextDueDate) {
    nextStatus = 'PAST_DUE';
  }

  if (nextStatus !== sub.status) {
    return prisma.subscription.update({ where: { id: subscriptionId }, data: { status: nextStatus } });
  }
  return sub;
}

export class SubscriptionService {
  /**
   * Backoffice dashboard: counts + lists for due-today / overdue / upcoming
   * (next 7 days) subscriptions, used for the payments/renewals overview.
   */
  async dashboardSummary() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [overdue, dueSoon, activeTrials, pendingPayments] = await Promise.all([
      prisma.subscription.findMany({
        where: { status: 'PAST_DUE' },
        include: { organization: true, plan: true },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE', nextDueDate: { gte: now, lte: in7Days } },
        include: { organization: true, plan: true },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { status: 'TRIAL' },
        include: { organization: true, plan: true },
        orderBy: { trialEndsAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING' },
        include: { organization: true, plan: true },
        orderBy: { submittedAt: 'asc' },
      }),
    ]);

    return {
      counts: {
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        activeTrials: activeTrials.length,
        pendingPayments: pendingPayments.length,
      },
      overdue,
      dueSoon,
      activeTrials,
      pendingPayments,
    };
  }
}

export const subscriptionService = new SubscriptionService();
