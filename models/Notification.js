import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'delivery_reminder',
      'balance_alert',
      'birthday',
      'order_update',
      'expiring_soon',
      'expired',
      'trial_users',
      'suspension',
      'ban',
      'new_year',
      'easter',
      'independence_day',
      'democracy_day',
      'christmas',
      'eid_al_fitr',
      'eid_al_adha',
      'valentine',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
  sound: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  strict: true, // Reject any fields not in schema
});

// Create index on userId for better query performance
notificationSchema.index({ userId: 1 });
notificationSchema.index({ userId: 1, read: 1 }); // Compound index for filtering unread notifications

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

