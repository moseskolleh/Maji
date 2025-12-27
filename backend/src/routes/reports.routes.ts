import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, paginationSchema, geoPointSchema } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { calculateDistance, extractCoordinates } from '../utils/helpers.js';
import { ReportType, ReportStatus } from '@prisma/client';
import { GeoJSONPoint } from '../types/index.js';

// Create report schema
const createReportSchema = z.object({
  type: z.enum(['LEAK', 'BURST_PIPE', 'CONTAMINATION', 'BLOCKED_DRAIN', 'FLOOD', 'BROKEN_TAP', 'OTHER']),
  description: z.string().max(1000).optional(),
  location: geoPointSchema,
  address: z.string().max(500).optional(),
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

// Query schema
const reportsQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
});

// Update status schema (admin only)
const updateReportStatusSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'FORWARDED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
  resolution: z.string().max(500).optional(),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /reports
   * Submit a report
   */
  app.post(
    '/',
    {
      preHandler: [authenticate, validate(createReportSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { type, description, location, address, photoUrls } =
          request.body as z.infer<typeof createReportSchema>;

        // Check for duplicate reports nearby (within 100m in last 24h)
        const recentReports = await prisma.report.findMany({
          where: {
            type: type as ReportType,
            status: { in: ['PENDING', 'VERIFIED', 'FORWARDED', 'IN_PROGRESS'] },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        const locationCoords = extractCoordinates(location);
        let nearbyReportCount = 0;
        let isDuplicate = false;

        for (const report of recentReports) {
          const reportCoords = extractCoordinates(report.location as GeoJSONPoint);
          const distance = calculateDistance(locationCoords, reportCoords);
          if (distance < 100) {
            nearbyReportCount++;
            if (report.userId === userId) {
              isDuplicate = true;
            }
          }
        }

        if (isDuplicate) {
          throw Errors.validation([{
            field: 'location',
            message: 'You have already submitted a similar report for this location',
          }]);
        }

        // Get bounty amount based on report type
        const bountyAmount = config.bounty[type.toLowerCase() as keyof typeof config.bounty] || config.bounty.other;

        // Create report
        const report = await prisma.report.create({
          data: {
            userId,
            type: type as ReportType,
            description,
            location,
            address,
            photoUrls: photoUrls || [],
            bountyAmount,
            verifiedCount: nearbyReportCount + 1, // Include this report
          },
        });

        // If 3+ similar reports nearby, auto-verify
        if (nearbyReportCount >= 2) {
          await prisma.report.update({
            where: { id: report.id },
            data: { status: 'VERIFIED' },
          });

          // Also update other nearby reports
          for (const r of recentReports) {
            const reportCoords = extractCoordinates(r.location as GeoJSONPoint);
            const distance = calculateDistance(locationCoords, reportCoords);
            if (distance < 100 && r.status === 'PENDING') {
              await prisma.report.update({
                where: { id: r.id },
                data: {
                  status: 'VERIFIED',
                  verifiedCount: nearbyReportCount + 1,
                },
              });
            }
          }
        }

        // Award reputation points
        await prisma.user.update({
          where: { id: userId },
          data: {
            reputation: { increment: config.reputation.reportPoints },
          },
        });

        return reply.status(201).send({
          success: true,
          data: {
            ...report,
            potentialBounty: bountyAmount,
            message: `Report submitted. You may earn ${bountyAmount.toLocaleString()} Le if verified and resolved.`,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /reports/mine
   * Get user's reports
   */
  app.get(
    '/mine',
    {
      preHandler: [authenticate, validate(reportsQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { page, limit, type, status } = request.query as z.infer<typeof reportsQuerySchema>;

        const where = {
          userId,
          ...(type && { type: type as ReportType }),
          ...(status && { status: status as ReportStatus }),
        };

        const [reports, total, stats] = await Promise.all([
          prisma.report.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.report.count({ where }),
          prisma.report.aggregate({
            where: { userId },
            _count: true,
            _sum: {
              bountyAmount: true,
            },
          }),
        ]);

        const verifiedCount = await prisma.report.count({
          where: { userId, status: { in: ['VERIFIED', 'RESOLVED'] } },
        });

        const bountyEarned = await prisma.report.aggregate({
          where: { userId, bountyPaid: true },
          _sum: { bountyAmount: true },
        });

        return reply.status(200).send({
          success: true,
          data: reports,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
          stats: {
            total: stats._count,
            verified: verifiedCount,
            bountyEarned: bountyEarned._sum.bountyAmount || 0,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /reports/:id
   * Get report details
   */
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { id } = request.params as { id: string };

        const report = await prisma.report.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        });

        if (!report) {
          throw Errors.reportNotFound();
        }

        // Only owner or admin can see details
        if (report.userId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('Access denied');
        }

        return reply.status(200).send({
          success: true,
          data: report,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /reports (admin)
   * List all reports
   */
  app.get(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN'), validate(reportsQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page, limit, type, status } = request.query as z.infer<typeof reportsQuerySchema>;

        const where = {
          ...(type && { type: type as ReportType }),
          ...(status && { status: status as ReportStatus }),
        };

        const [reports, total] = await Promise.all([
          prisma.report.findMany({
            where,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.report.count({ where }),
        ]);

        return reply.status(200).send({
          success: true,
          data: reports,
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
   * PATCH /reports/:id/status (admin)
   * Update report status
   */
  app.patch(
    '/:id/status',
    {
      preHandler: [authenticate, authorize('ADMIN'), validate(updateReportStatusSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const adminId = request.user!.id;
        const { id } = request.params as { id: string };
        const { status, resolution } = request.body as z.infer<typeof updateReportStatusSchema>;

        const report = await prisma.report.findUnique({ where: { id } });

        if (!report) {
          throw Errors.reportNotFound();
        }

        const updateData: any = {
          status: status as ReportStatus,
        };

        if (status === 'RESOLVED') {
          updateData.resolvedAt = new Date();
          updateData.resolvedBy = adminId;
          updateData.resolution = resolution;

          // Pay bounty if not already paid
          if (!report.bountyPaid && report.bountyAmount) {
            updateData.bountyPaid = true;
            updateData.bountyPaidAt = new Date();

            // Award bonus reputation
            await prisma.user.update({
              where: { id: report.userId },
              data: {
                reputation: { increment: config.reputation.verifiedReportBonus },
              },
            });

            // TODO: Actually transfer bounty via mobile money
          }
        }

        const updated = await prisma.report.update({
          where: { id },
          data: updateData,
        });

        // TODO: Notify user of status update

        return reply.status(200).send({
          success: true,
          data: updated,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}

/**
 * Resources routes
 */
export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  // Query schema
  const resourcesQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(100).max(50000).default(5000),
    types: z.string().optional(), // comma-separated
    status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'UNVERIFIED']).optional(),
    bbox: z.string().optional(), // minLng,minLat,maxLng,maxLat
  });

  // Create resource schema
  const createResourceSchema = z.object({
    type: z.enum(['WATER_TAP', 'BOREHOLE', 'WELL', 'WATER_KIOSK', 'SOLAR_CHARGER', 'BATTERY_RENTAL', 'WATER_VENDOR', 'TANKER_STATION']),
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    location: geoPointSchema,
    address: z.string().max(500).optional(),
    zoneId: z.string().min(1),
    metadata: z.record(z.any()).optional(),
  });

  /**
   * GET /resources
   * Get resources for map
   */
  app.get(
    '/',
    {
      preHandler: [validate(resourcesQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { lat, lng, radius, types, status, bbox } = request.query as z.infer<typeof resourcesQuerySchema>;

        const typeFilter = types?.split(',').filter(Boolean);

        let resources = await prisma.resource.findMany({
          where: {
            ...(status ? { status: status as any } : { status: 'ACTIVE' }),
            ...(typeFilter && { type: { in: typeFilter as any } }),
          },
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                phone: true,
              },
            },
            zone: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Filter by location if provided
        if (lat !== undefined && lng !== undefined) {
          resources = resources.map((r) => {
            const coords = extractCoordinates(r.location as GeoJSONPoint);
            const distance = calculateDistance({ lat, lng }, coords);
            return { ...r, distance: Math.round(distance) };
          }).filter((r) => (r as any).distance <= radius);

          // Sort by distance
          resources.sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0));
        }

        // Filter by bounding box if provided
        if (bbox) {
          const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
          resources = resources.filter((r) => {
            const coords = extractCoordinates(r.location as GeoJSONPoint);
            return (
              coords.lng >= minLng &&
              coords.lng <= maxLng &&
              coords.lat >= minLat &&
              coords.lat <= maxLat
            );
          });
        }

        return reply.status(200).send({
          success: true,
          data: resources,
          meta: {
            total: resources.length,
            ...(bbox && { bbox: bbox.split(',').map(Number) }),
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /resources
   * Add new resource (community contribution)
   */
  app.post(
    '/',
    {
      preHandler: [authenticate, validate(createResourceSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { type, name, description, location, address, zoneId, metadata } =
          request.body as z.infer<typeof createResourceSchema>;

        // Verify zone exists
        const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
        if (!zone) {
          throw Errors.zoneNotFound();
        }

        const resource = await prisma.resource.create({
          data: {
            type: type as any,
            name,
            description,
            location,
            address,
            zoneId,
            metadata,
            status: 'UNVERIFIED',
            verifiedBy: userId,
          },
        });

        // Award reputation points
        await prisma.user.update({
          where: { id: userId },
          data: {
            reputation: { increment: 5 },
          },
        });

        return reply.status(201).send({
          success: true,
          data: {
            ...resource,
            pointsEarned: 5,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /resources/:id
   * Get resource details
   */
  app.get(
    '/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const resource = await prisma.resource.findUnique({
          where: { id },
          include: {
            zone: true,
            vendor: {
              select: {
                id: true,
                businessName: true,
                phone: true,
                rating: true,
              },
            },
          },
        });

        if (!resource) {
          throw Errors.resourceNotFound();
        }

        return reply.status(200).send({
          success: true,
          data: resource,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
