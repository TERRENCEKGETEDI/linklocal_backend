import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const createRequestSchema = z.object({
  service_id: z.string().min(1, 'Service ID is required'),
  message: z.string().optional(),
  requested_date: z.string().optional(),
  estimated_duration: z.number().positive().optional(),
});

const updateRequestStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'completed', 'cancelled']),
});

// GET /requests - Get requests (different for customers and providers)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause based on role
    const where: any = {};

    if (userRole === 'customer') {
      where.customer_id = userId;
    } else if (userRole === 'provider') {
      where.provider_id = userId;
    }

    if (status) {
      where.status = status;
    }

    // Get requests with pagination
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          service: {
            select: {
              id: true,
              title: true,
              price: true,
              provider: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
            }
          },
          provider: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.serviceRequest.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        data: requests,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages,
        }
      }
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: 'Internal server error'
    });
  }
});

// POST /requests - Create new request (customers only)
router.post('/', authenticateToken, requireRole(['customer']), async (req: Request, res: Response) => {
  try {
    const validatedData = createRequestSchema.parse(req.body);
    const customerId = req.user!.userId;

    // Verify service exists and is active
    const service = await prisma.service.findUnique({
      where: {
        id: validatedData.service_id,
        is_active: true
      },
      include: {
        provider: true
      }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
        error: 'Service does not exist or is inactive'
      });
    }

    // Check if customer already has a pending/accepted request for this service
    const existingRequest = await prisma.serviceRequest.findFirst({
      where: {
        service_id: validatedData.service_id,
        customer_id: customerId,
        status: {
          in: ['pending', 'accepted']
        }
      }
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending or accepted request for this service',
        error: 'Duplicate request'
      });
    }

    const request = await prisma.serviceRequest.create({
      data: {
        service_id: validatedData.service_id,
        customer_id: customerId,
        provider_id: service.provider.id,
        status: 'pending',
        message: validatedData.message,
        requested_date: validatedData.requested_date ? new Date(validatedData.requested_date) : null,
        estimated_duration: validatedData.estimated_duration,
      },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            price: true,
            provider: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
          }
        },
        provider: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: 'Internal server error'
    });
  }
});

// PATCH /requests/:id - Update request status (providers can accept/decline, customers can cancel)
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status } = updateRequestStatusSchema.parse(req.body);

    // Find the request
    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        service: true,
        customer: true,
        provider: true,
      }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
        error: 'Request does not exist'
      });
    }

    // Check permissions
    let canUpdate = false;

    if (userRole === 'provider' && request.provider_id === userId) {
      // Provider can accept, decline, or mark as completed
      canUpdate = ['accepted', 'declined', 'completed'].includes(status);
    } else if (userRole === 'customer' && request.customer_id === userId) {
      // Customer can cancel pending requests
      canUpdate = status === 'cancelled' && request.status === 'pending';
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this request',
        error: 'Access denied'
      });
    }

    // Update the request
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: { status },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            price: true,
            provider: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
          }
        },
        provider: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Request updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Update request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request',
      error: 'Internal server error'
    });
  }
});

export default router;