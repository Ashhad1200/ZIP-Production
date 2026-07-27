import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { runWithTenant } from '../config/tenant-context';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
      return;
    }

    const decoded = jwt.verify(token, appConfig.jwtSecret) as JwtPayload;
    // organizationId is absent on tokens issued before Phase 2 shipped —
    // treat that the same as null (legacy/default tenant, unrestricted).
    const organizationId = decoded.organizationId ?? null;
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      name: decoded.name,
      organizationId,
    };

    // Everything downstream (controller -> service -> Prisma) runs inside
    // this AsyncLocalStorage context, which config/database.ts's tenant
    // extension reads to auto-scope queries. See tenant-context.ts.
    runWithTenant({ organizationId }, next);
  } catch (error) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
    });
  }
};
