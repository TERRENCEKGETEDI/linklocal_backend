import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthUtils } from '../utils/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['customer', 'provider'], {
    errorMap: () => ({ message: 'Role must be either customer or provider' })
  }),
  phone: z.string().optional(),
  location: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        phone: validatedData.phone,
        location: validatedData.location,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        rating: true,
        is_verified: true,
        created_at: true,
      }
    });

    // Generate tokens
    const tokenPair = AuthUtils.generateTokenPair(user);

    res.status(201).json({
      success: true,
      data: {
        ...tokenPair,
        user,
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'Authentication failed'
      });
    }

    // Check password
    const isValidPassword = await AuthUtils.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'Authentication failed'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        error: 'Account inactive'
      });
    }

    // Generate tokens
    const tokenPair = AuthUtils.generateTokenPair(user);

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      rating: user.rating,
      is_verified: user.is_verified,
      created_at: user.created_at,
    };

    res.json({
      success: true,
      data: {
        ...tokenPair,
        user: userResponse,
      },
      message: 'Login successful'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: 'Internal server error'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = refreshTokenSchema.parse(req.body);

    // Verify refresh token
    const payload = AuthUtils.verifyRefreshToken(refresh_token);
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: 'Token verification failed'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        rating: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
        error: 'Invalid user'
      });
    }

    // Generate new token pair
    const tokenPair = AuthUtils.generateTokenPair(user);

    res.json({
      success: true,
      data: tokenPair,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: 'Internal server error'
    });
  }
});

export default router;