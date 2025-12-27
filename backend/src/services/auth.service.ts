import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { generateOtp, normalizePhone } from '../utils/helpers.js';
import { Errors } from '../utils/errors.js';
import { User, UserRole } from '@prisma/client';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResult {
  tokens: TokenPair;
  user: {
    id: string;
    phone: string;
    name: string | null;
    role: UserRole;
    isNewUser: boolean;
  };
}

export class AuthService {
  constructor(private app: FastifyInstance) {}

  /**
   * Request OTP for phone number
   */
  async requestOtp(phone: string): Promise<{ expiresIn: number }> {
    const normalizedPhone = normalizePhone(phone);

    // Generate OTP
    const code = generateOtp(config.otp.length);
    const expiresAt = new Date(Date.now() + config.otp.expiresIn * 1000);

    // Delete any existing OTPs for this phone
    await prisma.otpCode.deleteMany({
      where: { phone: normalizedPhone },
    });

    // Create new OTP
    await prisma.otpCode.create({
      data: {
        phone: normalizedPhone,
        code,
        expiresAt,
      },
    });

    // In production, send SMS here
    // For now, log the OTP (development only)
    if (config.env === 'development') {
      console.log(`[DEV] OTP for ${normalizedPhone}: ${code}`);
    } else {
      // TODO: Integrate Africa's Talking SMS
      // await this.sendSms(normalizedPhone, `Your Maji verification code is: ${code}`);
    }

    return { expiresIn: config.otp.expiresIn };
  }

  /**
   * Verify OTP and authenticate user
   */
  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    const normalizedPhone = normalizePhone(phone);

    // Find OTP
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        code,
        verified: false,
      },
    });

    if (!otpRecord) {
      throw Errors.invalidOtp();
    }

    // Check expiry
    if (otpRecord.expiresAt < new Date()) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      throw Errors.otpExpired();
    }

    // Check max attempts
    if (otpRecord.attempts >= config.otp.maxAttempts) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      throw Errors.otpMaxAttempts();
    }

    // Update attempts
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    // Verify OTP
    if (otpRecord.code !== code) {
      throw Errors.invalidOtp();
    }

    // Mark OTP as verified and delete
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          role: 'CITIZEN',
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isNewUser,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    // Find refresh token
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw Errors.invalidToken();
    }

    // Check expiry
    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw Errors.tokenExpired();
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user || !user.isActive) {
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw Errors.userNotFound();
    }

    // Generate new access token
    const accessToken = this.app.jwt.sign({
      id: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      accessToken,
      expiresIn: 86400, // 1 day in seconds
    };
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User): Promise<TokenPair> {
    const accessToken = this.app.jwt.sign({
      id: user.id,
      phone: user.phone,
      role: user.role,
    });

    // Generate refresh token
    const refreshToken = this.app.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 1 day in seconds
    };
  }
}
