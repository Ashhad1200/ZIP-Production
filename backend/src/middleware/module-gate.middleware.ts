import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';

/**
 * Gates a tenant route group behind the requesting user's organization's
 * active Plan modules, in addition to (not instead of) the existing rbac()
 * role check.
 *
 * Phase 1 note: User.organizationId is nullable — rows created before
 * multi-tenancy (i.e. the original single-tenant zipper deployment) have no
 * organization and are treated as unrestricted ("legacy" tenant with every
 * module). Once Phase 2 backfills organizationId for every user, this
 * fallback can be removed.
 */
export const requireModule = (moduleKey: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        next();
        return;
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          organizationId: user.organizationId,
          status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { plan: { include: { planModules: { include: { module: true } } } } },
      });

      const hasModule = subscription?.plan.planModules.some((pm) => pm.module.key === moduleKey);

      if (!hasModule) {
        res.status(403).json({
          error: { code: 'MODULE_NOT_INCLUDED', message: `Your plan does not include the "${moduleKey}" module` },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
