import { Request, Response, NextFunction } from 'express';
import { AuthUtils, JWTPayload } from '../utils/auth';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'No token provided'
      });
      return;
    }

    const payload = AuthUtils.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'Token verification failed'
      });
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, is_active: true }
    });

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        message: 'User account is inactive or does not exist',
        error: 'Invalid user'
      });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: 'Internal server error'
    });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'No user context'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'Role not authorized'
      });
      return;
    }

    next();
  };
};