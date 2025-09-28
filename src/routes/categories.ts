import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /categories - Get all active categories
router.get('/', async (_, res: Response) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: {
        is_active: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: 'Internal server error'
    });
  }
});

export default router;