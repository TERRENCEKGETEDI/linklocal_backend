import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const createServiceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  price: z.number().positive('Price must be positive'),
  price_type: z.enum(['hourly', 'fixed', 'negotiable']),
  images: z.array(z.string().url()).optional().default([]),
});

const updateServiceSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  category: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  price_type: z.enum(['hourly', 'fixed', 'negotiable']).optional(),
  images: z.array(z.string().url()).optional(),
});

// GET /services - Get all services with filtering and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      location,
      search,
      min_price,
      max_price,
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      is_active: true,
    };

    if (category) {
      where.category_id = category;
    }

    if (location) {
      where.location = {
        contains: location as string,
        mode: 'insensitive'
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price.gte = parseFloat(min_price as string);
      if (max_price) where.price.lte = parseFloat(max_price as string);
    }

    // Get services with pagination
    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          category: true,
          provider: {
            select: {
              id: true,
              name: true,
              rating: true,
              is_verified: true,
            }
          },
          _count: {
            select: { requests: true }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.service.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        data: services.map(service => ({
          ...service,
          review_count: service._count.requests, // Simplified, should be based on feedback
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages,
        }
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: 'Internal server error'
    });
  }
});

// GET /services/:id - Get single service
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id, is_active: true },
      include: {
        category: true,
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            location: true,
            rating: true,
            is_verified: true,
          }
        },
        _count: {
          select: { requests: true }
        }
      }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        error: 'Service does not exist'
      });
    }

    res.json({
      success: true,
      data: {
        ...service,
        review_count: service._count.requests, // Simplified
      }
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: 'Internal server error'
    });
  }
});

// POST /services - Create new service (providers only)
router.post('/', authenticateToken, requireRole(['provider']), async (req: Request, res: Response) => {
  try {
    const validatedData = createServiceSchema.parse(req.body);
    const providerId = req.user!.userId;

    // Verify category exists
    const category = await prisma.serviceCategory.findUnique({
      where: { id: validatedData.category }
    });

    if (!category || !category.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        error: 'Category does not exist or is inactive'
      });
    }

    const service = await prisma.service.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category_id: validatedData.category,
        provider_id: providerId,
        location: validatedData.location,
        price: validatedData.price,
        price_type: validatedData.price_type,
        images: validatedData.images,
      },
      include: {
        category: true,
        provider: {
          select: {
            id: true,
            name: true,
            rating: true,
            is_verified: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: service,
      message: 'Service created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service',
      error: 'Internal server error'
    });
  }
});

// PATCH /services/:id - Update service (owner only)
router.patch('/:id', authenticateToken, requireRole(['provider']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const providerId = req.user!.userId;
    const validatedData = updateServiceSchema.parse(req.body);

    // Check if service exists and belongs to user
    const existingService = await prisma.service.findFirst({
      where: {
        id,
        provider_id: providerId,
        is_active: true
      }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or access denied',
        error: 'Service does not exist or you do not have permission'
      });
    }

    // Verify category if provided
    if (validatedData.category) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: validatedData.category }
      });

      if (!category || !category.is_active) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category',
          error: 'Category does not exist or is inactive'
        });
      }
    }

    const updateData: any = { ...validatedData };
    if (validatedData.category) {
      updateData.category_id = validatedData.category;
      delete updateData.category;
    }

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        provider: {
          select: {
            id: true,
            name: true,
            rating: true,
            is_verified: true,
          }
        }
      }
    });

    res.json({
      success: true,
      data: service,
      message: 'Service updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service',
      error: 'Internal server error'
    });
  }
});

// DELETE /services/:id - Delete service (owner only)
router.delete('/:id', authenticateToken, requireRole(['provider']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const providerId = req.user!.userId;

    // Check if service exists and belongs to user
    const existingService = await prisma.service.findFirst({
      where: {
        id,
        provider_id: providerId,
        is_active: true
      }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or access denied',
        error: 'Service does not exist or you do not have permission'
      });
    }

    // Soft delete by setting is_active to false
    await prisma.service.update({
      where: { id },
      data: { is_active: false }
    });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: 'Internal server error'
    });
  }
});

export default router;