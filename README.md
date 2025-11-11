# SmartTailor Backend API

Backend API server for SmartTailor application built with Node.js, Express, and MongoDB.

## Features

- RESTful API endpoints for all entities
- MongoDB database with Mongoose ODM
- CORS enabled for frontend connections
- IP-based access support for mobile devices

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables:
   - The `.env` file is already configured with MongoDB connection string
   - Update `PORT` if needed (default: 3000)

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Measurements
- `GET /api/measurements` - Get all measurements
- `GET /api/measurements/customer/:customerId` - Get measurements by customer
- `GET /api/measurements/:id` - Get single measurement
- `POST /api/measurements` - Create measurement
- `PUT /api/measurements/:id` - Update measurement
- `DELETE /api/measurements/:id` - Delete measurement

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/customer/:customerId` - Get orders by customer
- `GET /api/orders/status/:status` - Get orders by status
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Payments
- `GET /api/payments` - Get all payments
- `GET /api/payments/customer/:customerId` - Get payments by customer
- `GET /api/payments/order/:orderId` - Get payments by order
- `GET /api/payments/:id` - Get single payment
- `POST /api/payments` - Create payment (automatically updates order balance)
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

### Gallery
- `GET /api/gallery` - Get all gallery items
- `GET /api/gallery/category/:category` - Get gallery by category
- `GET /api/gallery/:id` - Get single gallery item
- `POST /api/gallery` - Create gallery item
- `PUT /api/gallery/:id` - Update gallery item
- `DELETE /api/gallery/:id` - Delete gallery item

### Notifications
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/unread` - Get unread notifications
- `GET /api/notifications/:id` - Get single notification
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id` - Update notification
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

## Connecting from Frontend

The server is configured to listen on `0.0.0.0`, making it accessible via IP address.

1. Find your machine's IP address:
   - **macOS/Linux**: Run `ifconfig` or `ip addr`
   - **Windows**: Run `ipconfig`

2. In your React Native app, use the IP address instead of localhost:
   ```javascript
   const API_URL = 'http://<YOUR_IP>:3000/api';
   ```

3. Make sure your mobile device and development machine are on the same network.

## Deployment to Vercel

This backend is configured for deployment on Vercel.

### Prerequisites
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

### Deploy

1. From the backend directory, run:
   ```bash
   vercel
   ```

2. Follow the prompts to link your project or create a new one.

3. Add environment variables in Vercel dashboard:
   - Go to your project settings → Environment Variables
   - Add all required environment variables (see below)

4. For production deployment:
   ```bash
   vercel --prod
   ```

### Environment Variables for Vercel

Add these in your Vercel project settings:
- `MONGODB_URI` - MongoDB connection string
- `FLW_PUBLIC_KEY` - Flutterwave public key (if using payments)
- `FLW_SECRET_KEY` - Flutterwave secret key (if using payments)
- `R2_ENDPOINT` - Cloudflare R2 endpoint URL (required for image uploads)
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key ID (required for image uploads)
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret access key (required for image uploads)
- `R2_BUCKET_NAME` - Cloudflare R2 bucket name (required for image uploads)
- `R2_PUBLIC_URL` - Cloudflare R2 public URL for accessing uploaded images (required for image uploads)
- Any other environment variables your app requires

### Important Notes

- Scheduled jobs (node-cron) may not work reliably on Vercel serverless functions. Consider using Vercel Cron Jobs or external cron services for scheduled tasks.
- The API will be available at `https://your-project.vercel.app`
- All routes are automatically routed through the serverless function

## Environment Variables

### Required
- `MONGODB_URI` - MongoDB connection string

### Optional
- `PORT` - Server port (default: 3000, not used on Vercel)
- `NODE_ENV` - Environment (development/production)

### Image Upload (Cloudflare R2) - Required for image uploads
- `R2_ENDPOINT` - Cloudflare R2 endpoint URL (e.g., `https://xxx.r2.cloudflarestorage.com`)
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret access key
- `R2_BUCKET_NAME` - Cloudflare R2 bucket name
- `R2_PUBLIC_URL` - Cloudflare R2 public URL for accessing uploaded images (e.g., `https://pub-xxx.r2.dev`)

### Payment (Flutterwave) - Required for payments
- `FLW_PUBLIC_KEY` - Flutterwave public key
- `FLW_SECRET_KEY` - Flutterwave secret key

## Database Models

- Customer
- Measurement
- Order
- Payment
- StyleGallery
- Notification

All models include timestamps and proper relationships using MongoDB ObjectIds.

