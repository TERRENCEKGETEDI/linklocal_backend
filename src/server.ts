import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import serviceRoutes from './routes/services';
import requestRoutes from './routes/requests';
import categoryRoutes from './routes/categories';
import feedbackRoutes from './routes/feedback';
import profileRoutes from './routes/profile';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// API routes
app.use('/auth', authRoutes);
app.use('/services', serviceRoutes);
app.use('/requests', requestRoutes);
app.use('/categories', categoryRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/profile', profileRoutes);

// Register endpoint (legacy - now handled by /auth/register)
app.post('/register', authRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.server.nodeEnv}`);
  console.log(`🔗 CORS Origin: ${config.cors.origin}`);
});

export default app;