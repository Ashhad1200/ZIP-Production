import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app';
import { AuthenticatedRequest, JwtPayload } from '../types';

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
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      name: decoded.name,
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
    });
  }
};
