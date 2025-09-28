import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_SECRET_KEY || 'your-refresh-secret-key';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserTokenData {
  id: string;
  email: string;
  role: string;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateAccessToken(user: UserTokenData): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  }

  static generateRefreshToken(user: UserTokenData): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  }

  static generateTokenPair(user: UserTokenData): TokenPair {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  static verifyRefreshToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  static isTokenExpired(token: string): boolean {
    try {
      jwt.verify(token, JWT_SECRET);
      return false;
    } catch (error) {
      return true;
    }
  }
}