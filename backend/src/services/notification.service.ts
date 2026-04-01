import prisma from '../config/database';
import { NotificationType, Role } from '@prisma/client';

export class NotificationService {
  /**
   * Create a notification for a specific user.
   */
  async notifyUser(params: {
    recipientUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    return prisma.notification.create({ data: params });
  }
  
  /**
   * Create notifications for all users with a specific role.
   */
  async notifyRole(params: {
    recipientRole: Role;
    type: NotificationType;
    title: string;
    message: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    // Find all active users with this role
    const users = await prisma.user.findMany({
      where: { role: params.recipientRole, isActive: true },
      select: { id: true },
    });
    
    // Create a notification for each user
    const notifications = users.map(user =>
      prisma.notification.create({
        data: {
          recipientUserId: user.id,
          recipientRole: params.recipientRole,
          type: params.type,
          title: params.title,
          message: params.message,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      })
    );
    
    return Promise.all(notifications);
  }
  
  /**
   * Get notifications for a user (by userId or role).
   */
  async getUserNotifications(userId: string, role: Role, unreadOnly: boolean = false, limit: number = 20) {
    return prisma.notification.findMany({
      where: {
        OR: [
          { recipientUserId: userId },
          { recipientRole: role },
        ],
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
  
  /**
   * Mark a notification as read.
   */
  async markRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }
  
  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId: string, role: Role) {
    return prisma.notification.updateMany({
      where: {
        OR: [
          { recipientUserId: userId },
          { recipientRole: role },
        ],
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }
  
  /**
   * Get unread notification count.
   */
  async getUnreadCount(userId: string, role: Role): Promise<number> {
    return prisma.notification.count({
      where: {
        OR: [
          { recipientUserId: userId },
          { recipientRole: role },
        ],
        isRead: false,
      },
    });
  }
}

export const notificationService = new NotificationService();
