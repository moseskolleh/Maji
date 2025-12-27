import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate, paginationSchema, geoPointSchema } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';
import { calculateDistance, extractCoordinates } from '../utils/helpers.js';
import { GeoJSONPoint } from '../types/index.js';

// Query schema
const vendorsQuerySchema = paginationSchema.extend({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(50000).default(5000), // Default 5km
  zoneId: z.string().optional(),
  isOpen: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['distance', 'rating', 'price']).default('rating'),
});

// Create vendor schema
const createVendorSchema = z.object({
  businessName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  phone: z.string().min(8),
  location: geoPointSchema,
  address: z.string().max(500).optional(),
  deliveryZones: z.array(z.string()).min(1),
  deliveryFee: z.number().min(0).default(0),
  minOrder: z.number().min(0).default(0),
  openingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
  })).optional(),
});

// Update vendor schema
const updateVendorSchema = createVendorSchema.partial();

// Product schemas
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  unit: z.string().min(1).max(50),
  price: z.number().min(1),
  isAvailable: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial();

export async function vendorRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /vendors
   * List vendors
   */
  app.get(
    '/',
    {
      preHandler: [optionalAuth, validate(vendorsQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page, limit, lat, lng, radius, zoneId, isOpen, minRating, sort } =
          request.query as z.infer<typeof vendorsQuerySchema>;

        const where: any = {
          isActive: true,
          isVerified: true,
          ...(zoneId && { deliveryZones: { has: zoneId } }),
          ...(minRating && { rating: { gte: minRating } }),
        };

        let vendors = await prisma.vendor.findMany({
          where,
          include: {
            products: {
              where: { isAvailable: true },
            },
          },
        });

        // Calculate distance if coordinates provided
        if (lat !== undefined && lng !== undefined) {
          vendors = vendors.map((v) => {
            const vendorLocation = extractCoordinates(v.location as GeoJSONPoint);
            const distance = calculateDistance(
              { lat, lng },
              { lat: vendorLocation.lat, lng: vendorLocation.lng }
            );
            return { ...v, distance: Math.round(distance) };
          });

          // Filter by radius
          vendors = vendors.filter((v) => (v as any).distance <= radius);
        }

        // Filter by open status if requested
        if (isOpen !== undefined) {
          const now = new Date();
          const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          vendors = vendors.filter((v) => {
            if (!v.openingHours) return !isOpen; // No hours = closed
            const hours = (v.openingHours as any)[dayOfWeek];
            if (!hours) return !isOpen;
            const isCurrentlyOpen = currentTime >= hours.open && currentTime <= hours.close;
            return isOpen ? isCurrentlyOpen : !isCurrentlyOpen;
          });
        }

        // Sort
        if (sort === 'distance' && lat !== undefined) {
          vendors.sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0));
        } else if (sort === 'rating') {
          vendors.sort((a, b) => b.rating - a.rating);
        } else if (sort === 'price') {
          vendors.sort((a, b) => {
            const aMinPrice = Math.min(...a.products.map((p) => p.price), Infinity);
            const bMinPrice = Math.min(...b.products.map((p) => p.price), Infinity);
            return aMinPrice - bMinPrice;
          });
        }

        // Paginate
        const total = vendors.length;
        const paginatedVendors = vendors.slice((page - 1) * limit, page * limit);

        return reply.status(200).send({
          success: true,
          data: paginatedVendors.map((v) => ({
            id: v.id,
            businessName: v.businessName,
            description: v.description,
            phone: v.phone,
            location: v.location,
            address: v.address,
            distance: (v as any).distance,
            rating: v.rating,
            ratingCount: v.ratingCount,
            isVerified: v.isVerified,
            deliveryFee: v.deliveryFee,
            minOrder: v.minOrder,
            openingHours: v.openingHours,
            products: v.products.map((p) => ({
              id: p.id,
              name: p.name,
              unit: p.unit,
              price: p.price,
              isAvailable: p.isAvailable,
            })),
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
   * GET /vendors/:id
   * Get vendor details
   */
  app.get(
    '/:id',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const vendor = await prisma.vendor.findUnique({
          where: { id },
          include: {
            products: true,
            ratings: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        // Get rating distribution
        const ratingDistribution = await prisma.rating.groupBy({
          by: ['score'],
          where: { vendorId: id },
          _count: true,
        });

        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingDistribution.forEach((r) => {
          distribution[r.score as keyof typeof distribution] = r._count;
        });

        return reply.status(200).send({
          success: true,
          data: {
            id: vendor.id,
            businessName: vendor.businessName,
            description: vendor.description,
            phone: vendor.phone,
            location: vendor.location,
            address: vendor.address,
            deliveryZones: vendor.deliveryZones,
            deliveryFee: vendor.deliveryFee,
            minOrder: vendor.minOrder,
            rating: vendor.rating,
            ratingCount: vendor.ratingCount,
            isVerified: vendor.isVerified,
            isActive: vendor.isActive,
            openingHours: vendor.openingHours,
            products: vendor.products,
            reviews: {
              average: vendor.rating,
              count: vendor.ratingCount,
              distribution,
              recent: vendor.ratings.map((r) => ({
                id: r.id,
                score: r.score,
                comment: r.comment,
                user: { name: r.user.name },
                createdAt: r.createdAt,
              })),
            },
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /vendors
   * Register as vendor
   */
  app.post(
    '/',
    {
      preHandler: [authenticate, validate(createVendorSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const data = request.body as z.infer<typeof createVendorSchema>;

        // Check if user already has a vendor profile
        const existingVendor = await prisma.vendor.findUnique({
          where: { userId },
        });

        if (existingVendor) {
          throw Errors.validation([{ field: 'userId', message: 'User already has a vendor profile' }]);
        }

        // Verify all zones exist
        const zones = await prisma.zone.findMany({
          where: { id: { in: data.deliveryZones } },
        });

        if (zones.length !== data.deliveryZones.length) {
          throw Errors.zoneNotFound();
        }

        // Create vendor and update user role
        const [vendor] = await prisma.$transaction([
          prisma.vendor.create({
            data: {
              userId,
              businessName: data.businessName,
              description: data.description,
              phone: data.phone,
              location: data.location,
              address: data.address,
              deliveryZones: data.deliveryZones,
              deliveryFee: data.deliveryFee,
              minOrder: data.minOrder,
              openingHours: data.openingHours,
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { role: 'VENDOR' },
          }),
        ]);

        return reply.status(201).send({
          success: true,
          data: vendor,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * PATCH /vendors/:id
   * Update vendor profile
   */
  app.patch(
    '/:id',
    {
      preHandler: [authenticate, authorize('VENDOR', 'ADMIN'), validate(updateVendorSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { id } = request.params as { id: string };
        const data = request.body as z.infer<typeof updateVendorSchema>;

        const vendor = await prisma.vendor.findUnique({ where: { id } });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        // Only the vendor owner or admin can update
        if (vendor.userId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('You can only update your own vendor profile');
        }

        const updated = await prisma.vendor.update({
          where: { id },
          data,
        });

        return reply.status(200).send({
          success: true,
          data: updated,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /vendors/:id/products
   * Add product to vendor
   */
  app.post(
    '/:id/products',
    {
      preHandler: [authenticate, authorize('VENDOR', 'ADMIN'), validate(createProductSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { id } = request.params as { id: string };
        const data = request.body as z.infer<typeof createProductSchema>;

        const vendor = await prisma.vendor.findUnique({ where: { id } });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        if (vendor.userId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('You can only add products to your own vendor profile');
        }

        const product = await prisma.product.create({
          data: {
            vendorId: id,
            ...data,
          },
        });

        return reply.status(201).send({
          success: true,
          data: product,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * PATCH /vendors/:vendorId/products/:productId
   * Update product
   */
  app.patch(
    '/:vendorId/products/:productId',
    {
      preHandler: [authenticate, authorize('VENDOR', 'ADMIN'), validate(updateProductSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { vendorId, productId } = request.params as { vendorId: string; productId: string };
        const data = request.body as z.infer<typeof updateProductSchema>;

        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        if (vendor.userId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('You can only update products for your own vendor profile');
        }

        const product = await prisma.product.findFirst({
          where: { id: productId, vendorId },
        });

        if (!product) {
          throw Errors.productNotFound();
        }

        const updated = await prisma.product.update({
          where: { id: productId },
          data,
        });

        return reply.status(200).send({
          success: true,
          data: updated,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * DELETE /vendors/:vendorId/products/:productId
   * Delete product
   */
  app.delete(
    '/:vendorId/products/:productId',
    {
      preHandler: [authenticate, authorize('VENDOR', 'ADMIN')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { vendorId, productId } = request.params as { vendorId: string; productId: string };

        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        if (vendor.userId !== userId && userRole !== 'ADMIN') {
          throw Errors.forbidden('You can only delete products from your own vendor profile');
        }

        await prisma.product.delete({
          where: { id: productId },
        });

        return reply.status(200).send({
          success: true,
          message: 'Product deleted',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
