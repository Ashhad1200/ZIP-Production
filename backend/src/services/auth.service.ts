import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { appConfig } from '../config/app';
import { JwtPayload } from '../types';

export class AuthService {
  /**
   * Get all active users for kiosk selection, scoped to a single
   * organization by slug. Without a slug, falls back to the legacy
   * default tenant (organizationId = null) — i.e. the original
   * single-tenant zipper deployment's users, never every tenant's users
   * mixed together. This scoping exists specifically so the kiosk picker
   * (login with no password, just pick your name) can't leak one
   * organization's staff list to another now that multiple orgs share
   * this database — see docs/SAAS-PLATFORM-BLUEPRINT.md Phase 2.
   */
  async getActiveUsers(organizationSlug?: string) {
    let organizationId: string | null = null;

    if (organizationSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: organizationSlug }, select: { id: true } });
      if (!org) {
        throw Object.assign(new Error('Unknown organization'), { statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
      }
      organizationId = org.id;
    }

    return prisma.user.findMany({
      where: { isActive: true, organizationId },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
  
  /**
   * Login by userId (kiosk mode — no password).
   */
  async login(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    
    if (!user.isActive) {
      throw Object.assign(new Error('User account is deactivated'), { statusCode: 403, code: 'USER_INACTIVE' });
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    
    // Generate JWT
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
      select: { id: true, name: true, role: true },
    });
    
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    
    return user;
  }
}

export const authService = new AuthService();
