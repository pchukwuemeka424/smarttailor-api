import mongoose from 'mongoose';

const measurementSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  measurements: {
    type: Map,
    of: Number,
    default: {},
  },
  photoReference: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
  strict: true, // Reject any fields not in schema
});

// Create index on userId for better query performance
measurementSchema.index({ userId: 1 });
measurementSchema.index({ customerId: 1 });

const Measurement = mongoose.model('Measurement', measurementSchema);

export default Measurement;

