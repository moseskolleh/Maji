import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate, paginationSchema } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';

// Query schema
const zonesQuerySchema = paginationSchema.extend({
  parentId: z.string().optional(),
  search: z.string().optional(),
});

export async function zoneRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /zones
   * List all zones
   */
  app.get(
    '/',
    {
      preHandler: [optionalAuth, validate(zonesQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page, limit, parentId, search } = request.query as z.infer<typeof zonesQuerySchema>;

        const where = {
          ...(parentId && { parentId }),
          ...(search && {
            name: {
              contains: search,
              mode: 'insensitive' as const,
            },
          }),
        };

        const [zones, total] = await Promise.all([
          prisma.zone.findMany({
            where,
            include: {
              _count: {
                select: {
                  users: true,
                  alerts: {
                    where: { status: 'ACTIVE' },
                  },
                },
              },
            },
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.zone.count({ where }),
        ]);

        // Count vendors in each zone
        const vendorCounts = await prisma.vendor.groupBy({
          by: ['deliveryZones'],
          _count: true,
          where: { isActive: true, isVerified: true },
        });

        const zonesWithStats = zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          slug: zone.slug,
          parentId: zone.parentId,
          centroid: zone.centroid,
          waterSchedule: zone.waterSchedule,
          stats: {
            usersCount: zone._count.users,
            vendorsCount: vendorCounts.filter((v) =>
              (v.deliveryZones as string[]).includes(zone.id)
            ).length,
            activeAlerts: zone._count.alerts,
          },
        }));

        return reply.status(200).send({
          success: true,
          data: zonesWithStats,
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
   * GET /zones/:id
   * Get zone details
   */
  app.get(
    '/:id',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const zone = await prisma.zone.findUnique({
          where: { id },
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            children: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            alerts: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: {
                scout: {
                  select: {
                    id: true,
                    name: true,
                    reputation: true,
                  },
                },
              },
            },
            _count: {
              select: {
                users: true,
                resources: true,
              },
            },
          },
        });

        if (!zone) {
          throw Errors.zoneNotFound();
        }

        // Get last supply info from alerts
        const lastSupplyAlert = await prisma.alert.findFirst({
          where: {
            zoneId: id,
            type: { in: ['WATER_ACTIVE', 'WATER_ENDED'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Get next expected supply
        const upcomingAlert = await prisma.alert.findFirst({
          where: {
            zoneId: id,
            type: 'WATER_COMING',
            status: 'ACTIVE',
            eta: { gt: new Date() },
          },
          orderBy: { eta: 'asc' },
        });

        return reply.status(200).send({
          success: true,
          data: {
            id: zone.id,
            name: zone.name,
            slug: zone.slug,
            geometry: zone.geometry,
            centroid: zone.centroid,
            parent: zone.parent,
            children: zone.children,
            waterSchedule: zone.waterSchedule,
            currentStatus: {
              hasWater: lastSupplyAlert?.type === 'WATER_ACTIVE',
              lastSupply: lastSupplyAlert?.createdAt,
              nextExpected: upcomingAlert?.eta,
              activeAlerts: zone.alerts,
            },
            stats: {
              usersCount: zone._count.users,
              resourcesCount: zone._count.resources,
            },
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /zones/:id/vendors
   * Get vendors in zone
   */
  app.get(
    '/:id/vendors',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

        // Verify zone exists
        const zone = await prisma.zone.findUnique({ where: { id } });
        if (!zone) {
          throw Errors.zoneNotFound();
        }

        const vendors = await prisma.vendor.findMany({
          where: {
            isActive: true,
            isVerified: true,
            deliveryZones: { has: id },
          },
          include: {
            products: {
              where: { isAvailable: true },
            },
          },
          orderBy: { rating: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        });

        const total = await prisma.vendor.count({
          where: {
            isActive: true,
            isVerified: true,
            deliveryZones: { has: id },
          },
        });

        return reply.status(200).send({
          success: true,
          data: vendors.map((v) => ({
            id: v.id,
            businessName: v.businessName,
            description: v.description,
            phone: v.phone,
            location: v.location,
            address: v.address,
            rating: v.rating,
            ratingCount: v.ratingCount,
            deliveryFee: v.deliveryFee,
            minOrder: v.minOrder,
            isVerified: v.isVerified,
            openingHours: v.openingHours,
            products: v.products,
          })),
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
   * GET /zones/:id/resources
   * Get resources in zone
   */
  app.get(
    '/:id/resources',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { types } = request.query as { types?: string };

        // Verify zone exists
        const zone = await prisma.zone.findUnique({ where: { id } });
        if (!zone) {
          throw Errors.zoneNotFound();
        }

        const typeFilter = types?.split(',').filter(Boolean);

        const resources = await prisma.resource.findMany({
          where: {
            zoneId: id,
            status: 'ACTIVE',
            ...(typeFilter && {
              type: { in: typeFilter as any },
            }),
          },
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                phone: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        });

        return reply.status(200).send({
          success: true,
          data: resources,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
