import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  clothType: {
    type: String,
    required: true,
    trim: true,
  },
  style: {
    type: String,
    required: true,
    trim: true,
  },
  fabric: {
    type: String,
    required: true,
    trim: true,
  },
  dateReceived: {
    type: Date,
    required: true,
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'ready', 'delivered'],
    default: 'pending',
  },
  stylePictures: {
    type: [String],
    default: [],
  },
  sketches: {
    type: [String],
    default: [],
  },
  amountCharged: {
    type: Number,
    required: true,
    default: 0,
  },
  amountPaid: {
    type: Number,
    required: true,
    default: 0,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
  strict: true, // Reject any fields not in schema
});

// Create index on userId for better query performance
orderSchema.index({ userId: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;

