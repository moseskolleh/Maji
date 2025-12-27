import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, paginationSchema, geoPointSchema } from '../middleware/validation.js';
import { Errors, sendError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { generateOrderNumber, calculatePlatformFee } from '../utils/helpers.js';
import { OrderStatus, PaymentProvider } from '@prisma/client';

// Create order schema
const createOrderSchema = z.object({
  vendorId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().min(1),
  })).min(1),
  deliveryAddress: z.string().min(1).max(500),
  deliveryLocation: geoPointSchema.optional(),
  deliveryNotes: z.string().max(500).optional(),
});

// Update status schema
const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']),
});

// Payment initiation schema
const initiatePaymentSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(['ORANGE_MONEY', 'AFRICELL_MONEY', 'CASH']),
  phone: z.string().optional(),
});

// Rating schema
const ratingSchema = z.object({
  score: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
  qualityScore: z.number().min(1).max(5).optional(),
  serviceScore: z.number().min(1).max(5).optional(),
});

// Query schema
const ordersQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /orders
   * Get user's orders
   */
  app.get(
    '/',
    {
      preHandler: [authenticate, validate(ordersQuerySchema, 'query')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const userRole = request.user!.role;
        const { page, limit, status } = request.query as z.infer<typeof ordersQuerySchema>;

        // Vendors see orders to them, others see their own orders
        const where = {
          ...(status && { status: status as OrderStatus }),
          ...(userRole === 'VENDOR'
            ? { vendor: { userId } }
            : { customerId: userId }),
        };

        const [orders, total] = await Promise.all([
          prisma.order.findMany({
            where,
            include: {
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  phone: true,
                },
              },
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      unit: true,
                    },
                  },
                },
              },
              transaction: {
                select: {
                  id: true,
                  status: true,
                  provider: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.order.count({ where }),
        ]);

        return reply.status(200).send({
          success: true,
          data: orders,
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
   * GET /orders/:id
   * Get order details
   */
  app.get(
    '/:id',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };

        const order = await prisma.order.findUnique({
          where: { id },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            vendor: {
              select: {
                id: true,
                businessName: true,
                phone: true,
                location: true,
                address: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
            transaction: true,
            rating: true,
          },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        // Check access - customer, vendor, or admin
        const vendor = await prisma.vendor.findFirst({
          where: { userId, id: order.vendorId },
        });

        if (order.customerId !== userId && !vendor && request.user!.role !== 'ADMIN') {
          throw Errors.forbidden('Access denied');
        }

        // Build timeline
        const timeline = [
          { status: 'PENDING', timestamp: order.createdAt },
          ...(order.acceptedAt ? [{ status: 'ACCEPTED', timestamp: order.acceptedAt }] : []),
          ...(order.transaction?.status === 'COMPLETED' ? [{ status: 'PAID', timestamp: order.transaction.updatedAt }] : []),
          ...(order.deliveredAt ? [{ status: 'DELIVERED', timestamp: order.deliveredAt }] : []),
          ...(order.completedAt ? [{ status: 'COMPLETED', timestamp: order.completedAt }] : []),
          ...(order.cancelledAt ? [{ status: 'CANCELLED', timestamp: order.cancelledAt }] : []),
        ];

        return reply.status(200).send({
          success: true,
          data: {
            ...order,
            timeline,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /orders
   * Create new order
   */
  app.post(
    '/',
    {
      preHandler: [authenticate, validate(createOrderSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { vendorId, items, deliveryAddress, deliveryLocation, deliveryNotes } =
          request.body as z.infer<typeof createOrderSchema>;

        // Get vendor and verify it's active
        const vendor = await prisma.vendor.findUnique({
          where: { id: vendorId },
          include: {
            products: true,
          },
        });

        if (!vendor) {
          throw Errors.vendorNotFound();
        }

        if (!vendor.isActive || !vendor.isVerified) {
          throw Errors.vendorNotActive();
        }

        // Get products and calculate prices
        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
          where: {
            id: { in: productIds },
            vendorId,
          },
        });

        if (products.length !== productIds.length) {
          throw Errors.productNotFound();
        }

        // Check all products are available
        const unavailable = products.find((p) => !p.isAvailable);
        if (unavailable) {
          throw Errors.productUnavailable();
        }

        // Calculate totals
        let subtotal = 0;
        const orderItems = items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          const totalPrice = product.price * item.quantity;
          subtotal += totalPrice;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.price,
            totalPrice,
          };
        });

        // Check minimum order
        if (subtotal < vendor.minOrder) {
          throw Errors.minOrderNotMet(vendor.minOrder);
        }

        const deliveryFee = vendor.deliveryFee;
        const platformFee = calculatePlatformFee(subtotal);
        const totalAmount = subtotal + deliveryFee + platformFee;

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            customerId: userId,
            vendorId,
            deliveryAddress,
            deliveryLocation,
            deliveryNotes,
            subtotal,
            deliveryFee,
            platformFee,
            totalAmount,
            items: {
              create: orderItems,
            },
          },
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                phone: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
        });

        // TODO: Notify vendor of new order

        return reply.status(201).send({
          success: true,
          data: order,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * PATCH /orders/:id/status
   * Update order status (Vendor only)
   */
  app.patch(
    '/:id/status',
    {
      preHandler: [authenticate, authorize('VENDOR', 'ADMIN'), validate(updateStatusSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };
        const { status } = request.body as z.infer<typeof updateStatusSchema>;

        const order = await prisma.order.findUnique({
          where: { id },
          include: { vendor: true },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        // Verify vendor ownership
        if (order.vendor.userId !== userId && request.user!.role !== 'ADMIN') {
          throw Errors.forbidden('Only the vendor can update order status');
        }

        // Validate status transition
        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
          PENDING: ['ACCEPTED', 'CANCELLED'],
          ACCEPTED: ['PREPARING', 'CANCELLED'],
          PAYMENT_PENDING: ['PAID', 'CANCELLED'],
          PAID: ['PREPARING'],
          PREPARING: ['OUT_FOR_DELIVERY'],
          OUT_FOR_DELIVERY: ['DELIVERED'],
          DELIVERED: ['COMPLETED'],
          COMPLETED: [],
          CANCELLED: [],
          REFUNDED: [],
        };

        if (!validTransitions[order.status]?.includes(status as OrderStatus)) {
          throw Errors.orderInvalidStatus(order.status, status);
        }

        const updateData: any = { status };
        if (status === 'ACCEPTED') {
          updateData.acceptedAt = new Date();
          updateData.status = 'PAYMENT_PENDING'; // Wait for payment
        } else if (status === 'DELIVERED') {
          updateData.deliveredAt = new Date();
        }

        const updated = await prisma.order.update({
          where: { id },
          data: updateData,
        });

        // TODO: Notify customer of status update

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
   * POST /orders/:id/confirm-delivery
   * Customer confirms delivery
   */
  app.post(
    '/:id/confirm-delivery',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };

        const order = await prisma.order.findUnique({
          where: { id },
          include: { transaction: true },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        if (order.customerId !== userId) {
          throw Errors.forbidden('Only the customer can confirm delivery');
        }

        if (order.status !== 'DELIVERED') {
          throw Errors.orderInvalidStatus(order.status, 'DELIVERED');
        }

        // Update order and release escrow
        await prisma.$transaction([
          prisma.order.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          }),
          ...(order.transaction
            ? [
                prisma.transaction.update({
                  where: { id: order.transaction.id },
                  data: {
                    escrowStatus: 'RELEASED',
                    escrowReleasedAt: new Date(),
                  },
                }),
              ]
            : []),
        ]);

        // TODO: Transfer funds to vendor

        return reply.status(200).send({
          success: true,
          message: 'Delivery confirmed. Payment released to vendor.',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /orders/:id/cancel
   * Cancel order
   */
  app.post(
    '/:id/cancel',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason?: string };

        const order = await prisma.order.findUnique({
          where: { id },
          include: { vendor: true, transaction: true },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        // Check if user can cancel (customer or vendor)
        const isCustomer = order.customerId === userId;
        const isVendor = order.vendor.userId === userId;

        if (!isCustomer && !isVendor && request.user!.role !== 'ADMIN') {
          throw Errors.forbidden('Access denied');
        }

        // Can only cancel if not yet delivered
        const cancellableStatuses: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'PREPARING'];
        if (!cancellableStatuses.includes(order.status)) {
          throw Errors.orderInvalidStatus(order.status, 'cancellable');
        }

        await prisma.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: reason,
          },
        });

        // Refund if payment was made
        if (order.transaction?.status === 'COMPLETED') {
          await prisma.transaction.update({
            where: { id: order.transaction.id },
            data: {
              escrowStatus: 'REFUNDED',
              status: 'REFUNDED',
            },
          });
          // TODO: Process actual refund
        }

        return reply.status(200).send({
          success: true,
          message: 'Order cancelled',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /orders/:id/rate
   * Rate completed order
   */
  app.post(
    '/:id/rate',
    {
      preHandler: [authenticate, validate(ratingSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params as { id: string };
        const { score, comment, qualityScore, serviceScore } = request.body as z.infer<typeof ratingSchema>;

        const order = await prisma.order.findUnique({
          where: { id },
          include: { vendor: true, rating: true },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        if (order.customerId !== userId) {
          throw Errors.forbidden('Only the customer can rate the order');
        }

        if (order.status !== 'COMPLETED') {
          throw Errors.orderInvalidStatus(order.status, 'COMPLETED');
        }

        if (order.rating) {
          throw Errors.validation([{ field: 'orderId', message: 'Order already rated' }]);
        }

        // Create rating
        const rating = await prisma.rating.create({
          data: {
            userId,
            vendorId: order.vendorId,
            orderId: id,
            score,
            comment,
            qualityScore,
            serviceScore,
          },
        });

        // Update vendor rating
        const vendorRatings = await prisma.rating.aggregate({
          where: { vendorId: order.vendorId },
          _avg: { score: true },
          _count: true,
        });

        await prisma.vendor.update({
          where: { id: order.vendorId },
          data: {
            rating: vendorRatings._avg.score || 0,
            ratingCount: vendorRatings._count,
          },
        });

        // Award reputation points
        await prisma.user.update({
          where: { id: userId },
          data: {
            reputation: { increment: config.reputation.ratingPoints },
          },
        });

        return reply.status(201).send({
          success: true,
          data: rating,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}

/**
 * Payment routes - separate for clarity
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /payments/initiate
   * Initiate payment for order
   */
  app.post(
    '/initiate',
    {
      preHandler: [authenticate, validate(initiatePaymentSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { orderId, provider, phone } = request.body as z.infer<typeof initiatePaymentSchema>;

        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { transaction: true },
        });

        if (!order) {
          throw Errors.orderNotFound();
        }

        if (order.customerId !== userId) {
          throw Errors.forbidden('Only the customer can pay for the order');
        }

        if (order.status !== 'PAYMENT_PENDING') {
          throw Errors.orderInvalidStatus(order.status, 'PAYMENT_PENDING');
        }

        if (order.transaction) {
          throw Errors.validation([{ field: 'orderId', message: 'Payment already initiated' }]);
        }

        // Create transaction record
        const transaction = await prisma.transaction.create({
          data: {
            orderId,
            amount: order.totalAmount,
            provider: provider as PaymentProvider,
            status: 'PENDING',
            escrowStatus: 'NONE',
          },
        });

        // TODO: Integrate with actual payment provider
        // For now, return instructions
        let instructions = '';
        if (provider === 'ORANGE_MONEY') {
          instructions = 'Dial *144*4*6# to approve payment';
        } else if (provider === 'AFRICELL_MONEY') {
          instructions = 'Dial *134# to approve payment';
        } else {
          instructions = 'Pay cash on delivery';
        }

        return reply.status(200).send({
          success: true,
          data: {
            transactionId: transaction.id,
            status: 'PENDING',
            provider,
            amount: order.totalAmount,
            currency: 'SLL',
            instructions,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * GET /payments/:id/status
   * Check payment status
   */
  app.get(
    '/:id/status',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const transaction = await prisma.transaction.findUnique({
          where: { id },
          include: {
            order: {
              select: { customerId: true },
            },
          },
        });

        if (!transaction) {
          throw Errors.validation([{ field: 'id', message: 'Transaction not found' }]);
        }

        // Only customer or admin can check
        if (transaction.order.customerId !== request.user!.id && request.user!.role !== 'ADMIN') {
          throw Errors.forbidden('Access denied');
        }

        return reply.status(200).send({
          success: true,
          data: {
            transactionId: transaction.id,
            status: transaction.status,
            provider: transaction.provider,
            providerRef: transaction.providerRef,
            amount: transaction.amount,
            escrowStatus: transaction.escrowStatus,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
          },
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /payments/webhook/orange
   * Orange Money webhook
   */
  app.post('/webhook/orange', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // TODO: Verify webhook signature
      const { status, order_id, txnid, amount } = request.body as any;

      const transaction = await prisma.transaction.findFirst({
        where: {
          order: { orderNumber: order_id },
          provider: 'ORANGE_MONEY',
        },
      });

      if (!transaction) {
        return reply.status(404).send({ error: 'Transaction not found' });
      }

      if (status === 'SUCCESS') {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'COMPLETED',
              providerRef: txnid,
              escrowStatus: 'HELD',
            },
          }),
          prisma.order.update({
            where: { id: transaction.orderId },
            data: { status: 'PAID' },
          }),
        ]);

        // TODO: Notify vendor and customer
      } else {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
      }

      return reply.status(200).send({ status: 'received' });
    } catch (error) {
      console.error('Webhook error:', error);
      return reply.status(500).send({ error: 'Internal error' });
    }
  });
}
