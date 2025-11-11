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
import homeRoutes from './routes/home.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to database
let dbConnectionReady = false;
connectDB().then(() => {
  mongoose.connection.once('open', () => {
    console.log('Database connection established. Starting scheduled jobs...');
    dbConnectionReady = true;
    startScheduledJobs();
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});

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

// Middleware to ensure database connection is ready
app.use(async (req, res, next) => {
  // Check if connection is ready
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  
  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout'));
        }, 30000); // 30 second timeout
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return next();
    } catch (error) {
      console.error('Database connection error in middleware:', error);
      return res.status(503).json({ 
        message: 'Database connection not available',
        error: 'Service temporarily unavailable'
      });
    }
  }
  
  // If not connected, try to connect
  try {
    await connectDB();
    // Wait for connection to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout'));
        }, 30000);
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
    return next();
  } catch (error) {
    console.error('Database connection error in middleware:', error);
    return res.status(503).json({ 
      message: 'Database connection failed',
      error: 'Service temporarily unavailable'
    });
  }
});

// Routes
app.use('/api/home', homeRoutes);
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
console.log('Home route registered:');
console.log('  - GET /api/home');
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

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all interfaces to allow IP access

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
  console.log(`To access from other devices, use your machine's IP address: http://<YOUR_IP>:${PORT}`);
});

