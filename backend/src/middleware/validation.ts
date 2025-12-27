import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema, ZodError } from 'zod';
import { Errors, sendError } from '../utils/errors.js';

/**
 * Validation middleware factory
 * Creates a middleware that validates request body, query, or params against a Zod schema
 */
export function validate<T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const data = source === 'body'
        ? request.body
        : source === 'query'
        ? request.query
        : request.params;

      const validated = schema.parse(data);

      // Replace request data with validated (and potentially transformed) data
      if (source === 'body') {
        (request as any).body = validated;
      } else if (source === 'query') {
        (request as any).query = validated;
      } else {
        (request as any).params = validated;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(
          reply,
          Errors.validation(
            error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            }))
          )
        );
      } else {
        throw error;
      }
    }
  };
}

// Common validation schemas
export const phoneSchema = z.string().regex(
  /^(\+232|232|0)?[0-9]{8}$/,
  'Invalid Sierra Leone phone number'
);

export const otpSchema = z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric');

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

export const bboxSchema = z.tuple([
  z.number(), // minLng
  z.number(), // minLat
  z.number(), // maxLng
  z.number(), // maxLat
]);

export const idParamSchema = z.object({
  id: z.string().min(1),
});
