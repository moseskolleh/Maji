import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { Errors, sendError } from '../utils/errors.js';

// JWT payload type
interface JwtPayload {
  id: string;
  phone: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw Errors.unauthorized();
    }

    // Verify JWT using Fastify's jwt plugin
    const decoded = await request.jwtVerify<JwtPayload>();

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, phone: true, role: true, isActive: true },
    });

    if (!user) {
      throw Errors.userNotFound();
    }

    if (!user.isActive) {
      throw Errors.userInactive();
    }

    // Attach user to request
    request.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('expired')) {
      sendError(reply, Errors.tokenExpired());
    } else if (error instanceof Error && error.message.includes('invalid')) {
      sendError(reply, Errors.invalidToken());
    } else {
      sendError(reply, error as Error);
    }
  }
}

/**
 * Authorization middleware factory - checks user role
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      sendError(reply, Errors.unauthorized());
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      sendError(
        reply,
        Errors.forbidden(`This action requires one of these roles: ${allowedRoles.join(', ')}`)
      );
    }
  };
}

/**
 * Optional authentication - doesn't fail if no token, but extracts user if present
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return; // No token is fine for optional auth
    }

    const decoded = await request.jwtVerify<JwtPayload>();

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, phone: true, role: true, isActive: true },
    });

    if (user && user.isActive) {
      request.user = {
        id: user.id,
        phone: user.phone,
        role: user.role,
      };
    }
  } catch {
    // Ignore errors for optional auth
  }
}

/**
 * Register auth plugin with Fastify
 */
export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  await app.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
  });

  // Add decorators for easy use in routes
  app.decorate('authenticate', authenticate);
  app.decorate('authorize', authorize);
  app.decorate('optionalAuth', optionalAuth);
}
