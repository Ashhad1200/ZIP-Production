import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  async getUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await authService.getActiveUsers();
      res.json({ data: users });
    } catch (error) {
      next(error);
    }
  }
  
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'userId is required' }
        });
        return;
      }
      
      const result = await authService.login(userId);
      
      // Set httpOnly cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      
      res.json({ data: result.user });
    } catch (error) {
      next(error);
    }
  }
  
  async logout(_req: Request, res: Response) {
    res.clearCookie('token');
    res.json({ data: { message: 'Logged out' } });
  }
  
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
        });
        return;
      }
      
      const user = await authService.getCurrentUser(req.user.userId);
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
