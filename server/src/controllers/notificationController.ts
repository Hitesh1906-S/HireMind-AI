import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { NotificationService } from '../services/notificationService.js';
import { ApiError } from '../utils/apiError.js';

export class NotificationController {
  static getNotifications = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const unreadOnly = req.query.unread === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : 30;

    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getNotifications(req.user.id, unreadOnly, limit),
      NotificationService.getUnreadCount(req.user.id),
    ]);

    return ApiResponse.success({
      res,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        unreadCount,
      },
    });
  });

  static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const unreadCount = await NotificationService.getUnreadCount(req.user.id);
    return ApiResponse.success({
      res,
      message: 'Unread notification count retrieved',
      data: { unreadCount },
    });
  });

  static markRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    await NotificationService.markRead(id, req.user.id);
    return ApiResponse.success({
      res,
      message: 'Notification marked as read',
    });
  });

  static markAllRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    await NotificationService.markAllRead(req.user.id);
    return ApiResponse.success({
      res,
      message: 'All notifications marked as read',
    });
  });

  static deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    await NotificationService.deleteNotification(id, req.user.id);
    return ApiResponse.success({
      res,
      message: 'Notification deleted successfully',
    });
  });
}
