import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate, paginationSchema, geoPointSchema } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { calculateConfidence } from '../utils/helpers.js';
import { AlertType, AlertStatus } from '@prisma/client';

// Create alert schema
const createAlertSchema = z.object({
  zoneId: z.string().min(1),
  type: z.enum(['WATER_COMING', 'WATER_ACTIVE', 'WATER_ENDED', 'SHORTAGE_WARNING', 'FLOOD_WARNING', 'TANKER_AVAILABLE']),
  message: z.string().max(500).optional(),
  eta: z.string().datetime().optional(),
  duration: z.number().min(1).max(1440).optional(), // Max 24 hours in minutes
});

// Feedback schema
const feedbackSchema = z.object({
  accurate: z.boolean(),
  actualStartTime: z.string().datetime().optional(),
  actualDuration: z.number().optional(),
  comment: z.string().max(500).optional(),
});

// Query schema
const alertsQuerySchema = paginationSchema.extend({
  zoneId: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'VERIFIED']).optional(),
});

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /alerts
   * Get alerts for user's zone(s)
   */
  app.get(
    '/',
    {
      preHandler: [optionalAuth, validate(alertsQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page, limit, zoneId, type, status } = request.query as z.infer<typeof alertsQuerySchema>;

        // If user is logged in and no zone specified, use their primary zone
        let filterZoneId = zoneId;
        if (!filterZoneId && request.user) {
          const user = await prisma.user.findUnique({
            where: { id: request.user.id },
            select: { primaryZoneId: true },
          });
          filterZoneId = user?.primaryZoneId || undefined;
        }

        const where = {
          ...(filterZoneId && { zoneId: filterZoneId }),
          ...(type && { type: type as AlertType }),
          ...(status && { status: status as AlertStatus }),
          ...(!status && { status: 'ACTIVE' as AlertStatus }), // Default to active
        };

        const [alerts, total] = await Promise.all([
          prisma.alert.findMany({
            where,
            include: {
              zone: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              scout: {
                select: {
                  id: true,
                  name: true,
                  reputation: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.alert.count({ where }),
        ]);

        return reply.status(200).send({
          success: true,
          data: alerts,
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
   * GET /alerts/:id
   * Get alert details
   */
  app.get(
    '/:id',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const alert = await prisma.alert.findUnique({
          where: { id },
          include: {
            zone: {
              select: {
                id: true,
                name: true,
                slug: true,
                centroid: true,
              },
            },
            scout: {
              select: {
                id: true,
                name: true,
                reputation: true,
                avatarUrl: true,
              },
            },
          },
        });

        if (!alert) {
          throw Errors.alertNotFound();
        }

        return reply.status(200).send({
          success: true,
          data: alert,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /alerts
   * Create new alert (Scout only)
   */
  app.post(
    '/',
    {
      preHandler: [authenticate, authorize('SCOUT', 'ADMIN'), validate(createAlertSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { zoneId, type, message, eta, duration } = request.body as z.infer<typeof createAlertSchema>;

        // Verify zone exists
        const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
        if (!zone) {
          throw Errors.zoneNotFound();
        }

        // Check if user is a verified scout
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, isVerified: true, reputation: true },
        });

        if (user?.role === 'SCOUT' && !user.isVerified) {
          throw Errors.scoutNotVerified();
        }

        // Calculate confidence based on scout reputation
        const confidence = calculateConfidence(user?.reputation || 0);

        // Set expiry time
        let expiresAt: Date | undefined;
        if (eta) {
          const etaDate = new Date(eta);
          const durationMs = (duration || 120) * 60 * 1000;
          expiresAt = new Date(etaDate.getTime() + durationMs);
        } else if (duration) {
          expiresAt = new Date(Date.now() + duration * 60 * 1000);
        }

        // Create alert
        const alert = await prisma.alert.create({
          data: {
            scoutId: userId,
            zoneId,
            type: type as AlertType,
            message,
            eta: eta ? new Date(eta) : undefined,
            duration,
            confidence,
            expiresAt,
          },
          include: {
            zone: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Award reputation points
        await prisma.user.update({
          where: { id: userId },
          data: {
            reputation: { increment: config.reputation.alertPoints },
          },
        });

        // TODO: Send push notifications to users in the zone
        // This would integrate with the notification service

        return reply.status(201).send({
          success: true,
          data: {
            ...alert,
            pointsEarned: config.reputation.alertPoints,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /alerts/:id/feedback
   * Submit feedback on alert accuracy
   */
  app.post(
    '/:id/feedback',
    {
      preHandler: [authenticate, validate(feedbackSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { accurate, actualStartTime, actualDuration, comment } = request.body as z.infer<typeof feedbackSchema>;

        const alert = await prisma.alert.findUnique({
          where: { id },
          include: { scout: true },
        });

        if (!alert) {
          throw Errors.alertNotFound();
        }

        // Update feedback
        const newFeedbackCount = alert.feedbackCount + 1;
        const currentScore = alert.feedbackScore || 0;
        const feedbackValue = accurate ? 1 : 0;
        const newScore = (currentScore * alert.feedbackCount + feedbackValue) / newFeedbackCount;

        await prisma.alert.update({
          where: { id },
          data: {
            feedbackScore: newScore,
            feedbackCount: newFeedbackCount,
            isVerified: newScore >= 0.7 && newFeedbackCount >= 3,
          },
        });

        // If alert was accurate, boost scout reputation
        if (accurate) {
          await prisma.user.update({
            where: { id: alert.scoutId },
            data: {
              reputation: { increment: 2 },
            },
          });
        }

        return reply.status(200).send({
          success: true,
          data: {
            updatedConfidence: newScore,
            feedbackCount: newFeedbackCount,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * PATCH /alerts/:id/cancel
   * Cancel alert (Scout or Admin only)
   */
  app.patch(
    '/:id/cancel',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { id } = request.params as { id: string };

        const alert = await prisma.alert.findUnique({ where: { id } });

        if (!alert) {
          throw Errors.alertNotFound();
        }

        // Only the scout who created it or admin can cancel
        if (alert.scoutId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('You can only cancel your own alerts');
        }

        await prisma.alert.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        return reply.status(200).send({
          success: true,
          message: 'Alert cancelled',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
