import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Validation schema
const submitFeedbackSchema = z.object({
  service_request_id: z.string().min(1, 'Service request ID is required'),
  rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().optional(),
});

// POST /feedback - Submit feedback (customers only, after service completion)
router.post('/', authenticateToken, requireRole(['customer']), async (req: Request, res: Response) => {
  try {
    const validatedData = submitFeedbackSchema.parse(req.body);
    const customerId = req.user!.userId;

    // Verify the service request exists and belongs to the customer
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        id: validatedData.service_request_id,
        customer_id: customerId,
        status: 'completed' // Only allow feedback on completed services
      },
      include: {
        service: true,
        provider: true,
      }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or not eligible for feedback',
        error: 'Request does not exist or is not completed'
      });
    }

    // Check if feedback already exists
    const existingFeedback = await prisma.feedback.findUnique({
      where: { service_request_id: validatedData.service_request_id }
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message: 'Feedback already submitted for this service request',
        error: 'Duplicate feedback'
      });
    }

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        service_request_id: validatedData.service_request_id,
        customer_id: customerId,
        provider_id: serviceRequest.provider_id,
        rating: validatedData.rating,
        comment: validatedData.comment,
      },
      include: {
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

    // Update provider's average rating (simplified - in production, use a more sophisticated calculation)
    const providerFeedback = await prisma.feedback.findMany({
      where: { provider_id: serviceRequest.provider_id },
      select: { rating: true }
    });

    const averageRating = providerFeedback.reduce((sum, f) => sum + f.rating, 0) / providerFeedback.length;

    await prisma.user.update({
      where: { id: serviceRequest.provider_id },
      data: { rating: Math.round(averageRating * 10) / 10 } // Round to 1 decimal
    });

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.errors.map(e => e.message).join(', ')
      });
    }

    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: 'Internal server error'
    });
  }
});

// GET /feedback/provider/:id - Get feedback for a provider
router.get('/provider/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify provider exists
    const provider = await prisma.user.findUnique({
      where: { id, role: 'provider' },
      select: { id: true, name: true }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found',
        error: 'Provider does not exist'
      });
    }

    // Get all feedback for the provider
    const feedback = await prisma.feedback.findMany({
      where: {
        provider_id: id,
        is_public: true
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          }
        },
        service_request: {
          include: {
            service: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Calculate average rating and total reviews
    const totalReviews = feedback.length;
    const averageRating = totalReviews > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / totalReviews
      : 0;

    res.json({
      success: true,
      data: {
        feedback,
        average_rating: Math.round(averageRating * 10) / 10,
        total_reviews: totalReviews,
      }
    });
  } catch (error) {
    console.error('Get provider feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: 'Internal server error'
    });
  }
});

export default router;