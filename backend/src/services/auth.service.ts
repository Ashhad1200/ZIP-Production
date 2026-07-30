import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { appConfig } from '../config/app';
import { JwtPayload } from '../types';
import { verifyPassword } from '../utils/password';

export class AuthService {
  /**
   * Login by email + password. Same shape as platform-auth.service.ts's
   * login — a generic "Invalid email or password" on any failure avoids
   * leaking which part (email vs password) was wrong, and whether an
   * account is deactivated.
   */
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    };

    const token = jwt.sign(payload, appConfig.jwtSecret, {
      expiresIn: appConfig.jwtExpiresIn as string,
    } as jwt.SignOptions);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  /**
   * Get current user from JWT payload.
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }

    return user;
  }
}

export const authService = new AuthService();
