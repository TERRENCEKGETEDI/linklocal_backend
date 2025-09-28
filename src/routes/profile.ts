import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation schema
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
});

// GET /profile - Get current user profile
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        avatar_url: true,
        rating: true,
        is_verified: true,
        created_at: true,
        updated_at: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'User does not exist'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: 'Internal server error'
    });
  }
});

// PATCH /profile - Update current user profile
router.patch('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validatedData = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        avatar_url: true,
        rating: true,
        is_verified: true,
        created_at: true,
        updated_at: true,
      }
    });

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: 'Internal server error'
    });
  }
});

export default router;