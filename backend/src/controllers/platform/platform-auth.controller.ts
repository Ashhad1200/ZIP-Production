import { Request, Response, NextFunction } from 'express';
import { platformAuthService } from '../../services/platform/platform-auth.service';
import { PlatformAuthenticatedRequest } from '../../types';

export class PlatformAuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'email and password are required' } });
        return;
      }

      const result = await platformAuthService.login(email, password);

      res.cookie('platform_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({ data: result.admin });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie('platform_token');
    res.json({ data: { message: 'Logged out' } });
  }

  async me(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.platformAdmin) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }
      const admin = await platformAuthService.me(req.platformAdmin.adminId);
      res.json({ data: admin });
    } catch (error) {
      next(error);
    }
  }
}

export const platformAuthController = new PlatformAuthController();
