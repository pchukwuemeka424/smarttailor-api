import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // Index is created below with schema.index() - don't duplicate here
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: false,
    trim: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true,
  },
  photo: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
  strict: true, // Reject any fields not in schema
});

// Create index on userId for better query performance
customerSchema.index({ userId: 1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;

