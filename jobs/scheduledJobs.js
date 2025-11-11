import cron from 'node-cron';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';

/**
 * Scheduled job to automatically update orders to 'in_progress' after 2 days
 * and send delivery reminder notifications
 * 
 * This job runs every hour to check for orders that need to be updated
 */
const updateOrdersToProgress = async () => {
  try {
    console.log('[Scheduled Job] Starting order status update check...');
    
    // Calculate the date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0); // Start of day 2 days ago
    
    // Find orders created 2 days ago (or earlier) that are still pending
    const ordersToUpdate = await Order.find({
      status: 'pending',
      createdAt: { $lte: twoDaysAgo }
    }).populate('customerId');

    console.log(`[Scheduled Job] Found ${ordersToUpdate.length} orders to update`);

    // Update each order and create notification
    for (const order of ordersToUpdate) {
      // Update order status to in_progress
      order.status = 'in_progress';
      await order.save();

      // Format delivery date for notification
      const deliveryDate = new Date(order.deliveryDate);
      const formattedDeliveryDate = deliveryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Calculate days until delivery
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deliveryDateOnly = new Date(deliveryDate);
      deliveryDateOnly.setHours(0, 0, 0, 0);
      const daysUntilDelivery = Math.ceil((deliveryDateOnly - today) / (1000 * 60 * 60 * 24));

      // Create delivery reminder notification
      const notification = new Notification({
        userId: order.userId,
        type: 'delivery_reminder',
        title: 'Order Status Updated - In Progress',
        message: `Order for ${order.clothType} (${order.style}) is now in progress. Delivery deadline: ${formattedDeliveryDate}${daysUntilDelivery > 0 ? ` (${daysUntilDelivery} day${daysUntilDelivery !== 1 ? 's' : ''} remaining)` : ' (Due today!)'}`,
        orderId: order._id,
        customerId: order.customerId?._id || null,
        date: new Date(),
        read: false
      });

      await notification.save();
      console.log(`[Scheduled Job] Updated order ${order._id} and created notification`);
    }

    console.log(`[Scheduled Job] Completed. Updated ${ordersToUpdate.length} orders.`);
  } catch (error) {
    console.error('[Scheduled Job] Error updating orders:', error);
  }
};

/**
 * Initialize and start all scheduled jobs
 * Note: Cron jobs don't work on Vercel serverless functions.
 * Use Vercel Cron Jobs or external cron services for scheduled tasks on Vercel.
 */
export const startScheduledJobs = () => {
  // Skip scheduled jobs on Vercel (serverless functions don't support persistent cron)
  if (process.env.VERCEL === '1') {
    console.log('[Scheduled Jobs] Skipping cron jobs on Vercel. Use Vercel Cron Jobs for scheduled tasks.');
    return;
  }

  console.log('[Scheduled Jobs] Initializing scheduled jobs...');

  // Run every hour to check for orders that need to be updated
  // Cron format: minute hour day month day-of-week
  // '0 * * * *' = Every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  cron.schedule('0 * * * *', updateOrdersToProgress, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[Scheduled Jobs] Scheduled job configured to run every hour');
  console.log('[Scheduled Jobs] Job will update orders created 2+ days ago from pending to in_progress');

  // Optionally run immediately on startup for testing (comment out in production)
  // Uncomment the line below if you want to test the job immediately
  // updateOrdersToProgress();
};

