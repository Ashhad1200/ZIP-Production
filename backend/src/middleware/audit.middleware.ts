import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Middleware to attach audit context to the request for use by services.
 */
export const auditContext = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  // Audit context is available via req.user (set by auth middleware)
  // Services use req.user.userId for createdBy/updatedBy fields
  next();
};
