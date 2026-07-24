import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { appConfig } from '../../config/app';
import { PlatformJwtPayload } from '../../types';
import { verifyPassword } from '../../utils/password';

export class PlatformAuthService {
  async login(email: string, password: string) {
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || !admin.isActive || !verifyPassword(password, admin.passwordHash)) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
    }

    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const payload: PlatformJwtPayload = { aud: 'platform', adminId: admin.id, email: admin.email };
    const token = jwt.sign(payload, appConfig.jwtSecret, { expiresIn: appConfig.jwtExpiresIn as string } as jwt.SignOptions);

    return { token, admin: { id: admin.id, name: admin.name, email: admin.email } };
  }

  async me(adminId: string) {
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true },
    });
    if (!admin) {
      throw Object.assign(new Error('Admin not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    return admin;
  }
}

export const platformAuthService = new PlatformAuthService();
