import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { validate, phoneSchema, otpSchema } from '../middleware/validation.js';
import { validatePhone } from '../utils/helpers.js';
import { Errors, sendError } from '../utils/errors.js';

// Request schemas
const requestOtpSchema = z.object({
  phone: phoneSchema,
});

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app);

  /**
   * POST /auth/otp/request
   * Request OTP for phone number
   */
  app.post(
    '/otp/request',
    {
      preHandler: [validate(requestOtpSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { phone } = request.body as z.infer<typeof requestOtpSchema>;

        if (!validatePhone(phone)) {
          throw Errors.invalidPhone();
        }

        const result = await authService.requestOtp(phone);

        return reply.status(200).send({
          success: true,
          message: 'OTP sent',
          expiresIn: result.expiresIn,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /auth/otp/verify
   * Verify OTP and get access token
   */
  app.post(
    '/otp/verify',
    {
      preHandler: [validate(verifyOtpSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { phone, otp } = request.body as z.infer<typeof verifyOtpSchema>;

        const result = await authService.verifyOtp(phone, otp);

        return reply.status(200).send({
          success: true,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
          user: result.user,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  app.post(
    '/refresh',
    {
      preHandler: [validate(refreshTokenSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { refreshToken } = request.body as z.infer<typeof refreshTokenSchema>;

        const result = await authService.refreshToken(refreshToken);

        return reply.status(200).send({
          success: true,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );

  /**
   * POST /auth/logout
   * Logout and invalidate refresh token
   */
  app.post(
    '/logout',
    {
      preHandler: [validate(refreshTokenSchema, 'body')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { refreshToken } = request.body as z.infer<typeof refreshTokenSchema>;

        await authService.logout(refreshToken);

        return reply.status(200).send({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error) {
        sendError(reply, error as Error);
      }
    }
  );
}
