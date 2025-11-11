import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Remove non-digits and check if exactly 11 digits
        const digits = v.replace(/\D/g, '');
        return digits.length === 11;
      },
      message: 'Phone number must be exactly 11 digits'
    }
  },
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  profileImage: {
    type: String,
    trim: true,
  },
  subscriptionType: {
    type: String,
    enum: ['trial', 'monthly', 'quarterly', 'yearly'],
    default: 'trial',
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
  },
  trialStartDate: {
    type: Date,
  },
  trialEndDate: {
    type: Date,
  },
  subscriptionStartDate: {
    type: Date,
  },
  subscriptionEndDate: {
    type: Date,
  },
  pendingPayment: {
    txRef: String,
    subscriptionType: String,
    amount: Number,
    createdAt: Date,
  },
  paymentHistory: [{
    txRef: String,
    transactionId: String,
    amount: Number,
    subscriptionType: String,
    status: String,
    paidAt: Date,
  }],
  // Push notification settings
  pushNotificationEnabled: {
    type: Boolean,
    default: true,
  },
  pushNotificationToken: {
    type: String,
    trim: true,
  },
  // Language preference
  language: {
    type: String,
    enum: ['en', 'yo', 'ig', 'ha', 'pidgin'],
    default: 'en',
  },
  // Admin flag
  isAdmin: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;

