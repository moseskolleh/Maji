import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';
import { Language } from '@prisma/client';

// Update profile schema
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  language: z.enum(['EN', 'KRI']).optional(),
  primaryZoneId: z.string().optional(),
});

// FCM token schema
const fcmTokenSchema = z.object({
  token: z.string().min(1),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /users/me
   * Get current user profile
   */
  app.get(
    '/me',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            primaryZone: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                orders: true,
                reports: true,
                alerts: true,
              },
            },
          },
        });

        if (!user) {
          throw Errors.userNotFound();
        }

        return reply.status(200).send({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            language: user.language,
            avatarUrl: user.avatarUrl,
            reputation: user.reputation,
            isVerified: user.isVerified,
            primaryZone: user.primaryZone,
            stats: {
              ordersCount: user._count.orders,
              reportsCount: user._count.reports,
              alertsCount: user._count.alerts,
            },
            createdAt: user.createdAt,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * PATCH /users/me
   * Update current user profile
   */
  app.patch(
    '/me',
    {
      preHandler: [authenticate, validate(updateProfileSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { name, language, primaryZoneId } = request.body as z.infer<typeof updateProfileSchema>;

        // Verify zone exists if provided
        if (primaryZoneId) {
          const zone = await prisma.zone.findUnique({
            where: { id: primaryZoneId },
          });
          if (!zone) {
            throw Errors.zoneNotFound();
          }
        }

        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(name && { name }),
            ...(language && { language: language as Language }),
            ...(primaryZoneId && { primaryZoneId }),
          },
          include: {
            primaryZone: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        return reply.status(200).send({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            language: user.language,
            avatarUrl: user.avatarUrl,
            reputation: user.reputation,
            isVerified: user.isVerified,
            primaryZone: user.primaryZone,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /users/me/fcm-token
   * Register FCM token for push notifications
   */
  app.post(
    '/me/fcm-token',
    {
      preHandler: [authenticate, validate(fcmTokenSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { token } = request.body as z.infer<typeof fcmTokenSchema>;

        // Get current tokens
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fcmTokens: true },
        });

        // Add token if not already present
        const tokens = user?.fcmTokens || [];
        if (!tokens.includes(token)) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              fcmTokens: [...tokens, token],
            },
          });
        }

        return reply.status(200).send({
          success: true,
          message: 'FCM token registered',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * DELETE /users/me/fcm-token
   * Remove FCM token
   */
  app.delete(
    '/me/fcm-token',
    {
      preHandler: [authenticate, validate(fcmTokenSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { token } = request.body as z.infer<typeof fcmTokenSchema>;

        // Get current tokens
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fcmTokens: true },
        });

        // Remove token
        const tokens = (user?.fcmTokens || []).filter((t) => t !== token);
        await prisma.user.update({
          where: { id: userId },
          data: { fcmTokens: tokens },
        });

        return reply.status(200).send({
          success: true,
          message: 'FCM token removed',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /users/me/notifications
   * Get user notifications
   */
  app.get(
    '/me/notifications',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

        const [notifications, total] = await Promise.all([
          prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.notification.count({ where: { userId } }),
        ]);

        return reply.status(200).send({
          success: true,
          data: notifications,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /users/me/notifications/:id/read
   * Mark notification as read
   */
  app.post(
    '/me/notifications/:id/read',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };

        await prisma.notification.updateMany({
          where: { id, userId },
          data: { isRead: true, readAt: new Date() },
        });

        return reply.status(200).send({
          success: true,
          message: 'Notification marked as read',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
