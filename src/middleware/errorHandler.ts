import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errorDetails: any = null;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errorDetails = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
  }

  // Handle Prisma known request errors
  else if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'A record with this information already exists';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
    }
    errorDetails = { code: error.code, meta: error.meta };
  }

  // Handle Prisma validation errors
  else if (error instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  // Handle custom AppError
  else if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }

  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      statusCode,
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    error: errorDetails || error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);