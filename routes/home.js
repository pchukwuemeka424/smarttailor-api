import express from 'express';

const router = express.Router();

// Home route
router.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to SmartTailor API',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      customers: '/api/customers',
      measurements: '/api/measurements',
      orders: '/api/orders',
      notifications: '/api/notifications',
      subscription: '/api/subscription',
      payment: '/api/payment',
      settings: '/api/settings',
      admin: '/api/admin',
      health: '/api/health',
      home: '/api/home'
    }
  });
});

// Privacy Policy route
router.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy');
});

export default router;

