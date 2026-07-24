import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app';
import { PlatformAuthenticatedRequest, PlatformJwtPayload } from '../types';

/**
 * Authenticates a PlatformAdmin (BD Matrix backoffice user) via a separate
 * cookie from the tenant `token` cookie, and requires aud === 'platform' so a
 * tenant session token can never be replayed against platform routes.
 */
export const platformAuthenticate = (
  req: PlatformAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.cookies?.platform_token;

    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const decoded = jwt.verify(token, appConfig.jwtSecret) as PlatformJwtPayload;

    if (decoded.aud !== 'platform') {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      return;
    }

    req.platformAdmin = { adminId: decoded.adminId, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
};
