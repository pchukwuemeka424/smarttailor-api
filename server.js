import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';
import { startScheduledJobs } from './jobs/scheduledJobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import customersRoutes from './routes/customers.js';
import measurementsRoutes from './routes/measurements.js';
import ordersRoutes from './routes/orders.js';
import notificationsRoutes from './routes/notifications.js';
import subscriptionRoutes from './routes/subscription.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';

// Load environment variables
dotenv.config();

// Check if running on Vercel (serverless)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Initialize Express app
const app = express();

// Connect to database (lazy connection for serverless)
let dbConnected = false;
const ensureDBConnection = async () => {
  if (!dbConnected && mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      dbConnected = true;
      
      // Start scheduled jobs only if not on Vercel
      const isVercelEnv = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
      if (!isVercelEnv) {
        mongoose.connection.once('open', () => {
          console.log('Database connection established. Starting scheduled jobs...');
          startScheduledJobs();
        });
      }
    } catch (error) {
      console.error('Failed to connect to database:', error);
      // Don't throw - let routes handle the error
    }
  }
};

// For Vercel, connect on first request (lazy connection)
if (isVercel) {
  // Middleware to ensure DB connection on each request (for serverless)
  app.use(async (req, res, next) => {
    await ensureDBConnection();
    next();
  });
} else {
  // For local development, connect immediately
  connectDB().then(() => {
    mongoose.connection.once('open', () => {
      console.log('Database connection established. Starting scheduled jobs...');
      startScheduledJobs();
    });
  }).catch(err => {
    console.error('Database connection failed:', err);
  });
}

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for development (restrict in production)
  credentials: true,
}));
// Only parse JSON for non-multipart requests
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
console.log('Auth routes registered:');
console.log('  - POST /api/auth/signup');
console.log('  - POST /api/auth/login');
console.log('  - GET /api/auth/me');
console.log('  - PUT /api/auth/me');
console.log('  - PUT /api/auth/settings');
console.log('  - PUT /api/auth/change-password');
console.log('  - GET /api/auth/delete-account-form (form page)');
console.log('  - GET /api/auth/delete-account (confirmation page)');
console.log('  - GET /api/auth/delete-account/result (result page)');
console.log('  - POST /api/auth/delete-account-by-phone (delete account from form)');
console.log('  - POST /api/auth/delete-account (delete account)');
console.log('  - DELETE /api/auth/account (delete account)');
console.log('  - POST /api/auth/upload-profile-image');
console.log('  - POST /api/auth/avatar');
app.use('/api/customers', customersRoutes);
app.use('/api/measurements', measurementsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
console.log('Settings routes registered:');
console.log('  - GET /api/settings/test (test endpoint)');
console.log('  - GET /api/settings/public (public)');
console.log('Subscription routes registered:');
console.log('  - GET /api/subscription/test');
console.log('  - GET /api/subscription/status');
console.log('  - POST /api/subscription/upgrade');
console.log('  - GET /api/subscription/pricing');
console.log('Payment routes registered:');
console.log('  - POST /api/payment/initialize');
console.log('  - GET /api/payment/callback');
console.log('  - GET /api/payment/verify/:txRef');
console.log('Admin routes registered:');
console.log('  - GET /api/admin/users');
console.log('  - GET /api/admin/users/:id');
console.log('  - PUT /api/admin/users/:id');
console.log('  - DELETE /api/admin/users/:id');
console.log('  - PUT /api/admin/users/:id/subscription');
console.log('  - GET /api/admin/subscription/packages');
console.log('  - PUT /api/admin/subscription/packages');
console.log('  - POST /api/admin/notifications/broadcast');
console.log('  - GET /api/admin/settings (admin only)');
console.log('  - PUT /api/admin/settings');
console.log('  - POST /api/admin/settings/welcome-background');
console.log('  - POST /api/admin/settings/welcome-logo');
console.log('  - GET /api/admin/stats');

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SmartTailor API is running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to SmartTailor API',
    version: '1.0.0',
    endpoints: {
      customers: '/api/customers',
      measurements: '/api/measurements',
      orders: '/api/orders',
      notifications: '/api/notifications',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export app for Vercel serverless functions
export default app;

// Start server only if not in Vercel environment
if (!isVercel) {
  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0'; // Listen on all interfaces to allow IP access

  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Server accessible at http://localhost:${PORT}`);
    console.log(`To access from other devices, use your machine's IP address: http://<YOUR_IP>:${PORT}`);
  });
}

