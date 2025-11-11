import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import Measurement from '../models/Measurement.js';
import Notification from '../models/Notification.js';
import AppSettings from '../models/AppSettings.js';
import { uploadToS3, deleteFromS3, convertToPublicUrl } from '../services/s3Service.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { businessName, address, phone, password } = req.body;

    // Validate required fields
    if (!businessName || !address || !phone || !password) {
      return res.status(400).json({ message: 'Business name, address, phone, and password are required' });
    }

    // Validate phone number is 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone: phoneDigits });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    // Set up 30-day free trial for new users
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days from now

    // Create new user
    const user = new User({
      businessName,
      address,
      phone: phoneDigits,
      password,
      name: businessName, // Use business name as name for display
      subscriptionType: 'trial',
      subscriptionStatus: 'active',
      trialStartDate,
      trialEndDate,
    });

    const savedUser = await user.save();
    const userJson = savedUser.toJSON();
    // Convert profileImage URL to public URL if it exists
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.status(201).json({
      message: 'User created successfully',
      user: userJson,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    // Validate phone number is 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Find user by phone
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const userJson = user.toJSON();
    // Convert profileImage URL to public URL if it exists
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json({
      message: 'Login successful',
      user: userJson,
      isAdmin: user.isAdmin || false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user (for profile)
router.get('/me', async (req, res) => {
  try {
    // For now, we'll use phone from query
    // In production, use JWT token from Authorization header
    let { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    // Handle case where phone might be an array (from query string)
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    
    // Ensure phone is a string
    phone = String(phone);

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userJson = user.toJSON();
    // Convert profileImage URL to public URL if it exists
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/me', async (req, res) => {
  try {
    const { phone, ...updateData } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Don't allow password update through this route
    delete updateData.password;
    // Don't allow phone update (it's the identifier)
    delete updateData.phone;

    const user = await User.findOneAndUpdate(
      { phone: phoneDigits },
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userJson = user.toJSON();
    // Convert profileImage URL to public URL if it exists
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update user settings (notifications, language, etc.)
router.put('/settings', async (req, res) => {
  console.log('Settings route hit:', req.method, req.path, req.body);
  try {
    const { phone, pushNotificationEnabled, pushNotificationToken, language } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Build update object
    const updateData = {};
    if (pushNotificationEnabled !== undefined) {
      updateData.pushNotificationEnabled = pushNotificationEnabled;
    }
    if (pushNotificationToken !== undefined) {
      updateData.pushNotificationToken = pushNotificationToken;
    }
    if (language !== undefined) {
      updateData.language = language;
    }

    const user = await User.findOneAndUpdate(
      { phone: phoneDigits },
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userJson = user.toJSON();
    // Convert profileImage URL to public URL if it exists
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Change password
router.put('/change-password', async (req, res) => {
  try {
    const { phone, currentPassword, newPassword } = req.body;
    
    if (!phone || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Phone, current password, and new password are required' });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Find user
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Check if new password is different from current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get account deletion form page (main entry point)
router.get('/delete-account-form', async (req, res) => {
  try {
    // Fetch app settings to get logo
    const settings = await AppSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Convert logo URL to public URL if it exists
    let logoUrl = null;
    if (settingsObj.welcomeScreen?.logo) {
      logoUrl = convertToPublicUrl(settingsObj.welcomeScreen.logo);
    }
    
    const appName = settingsObj.welcomeScreen?.appName || 'Smart Tailor';
    
    res.render('delete-account-form', {
      logoUrl: logoUrl || null,
      appName: appName
    });
  } catch (error) {
    console.error('Error fetching settings for delete account form:', error);
    console.error('Error stack:', error.stack);
    // Render with default values if error occurs
    res.render('delete-account-form', {
      logoUrl: null,
      appName: 'Smart Tailor'
    });
  }
});

// Get account deletion confirmation page (with phone in query)
router.get('/delete-account', async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).render('delete-account-confirm', {
        phone: '',
        error: 'Phone number is required'
      });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).render('delete-account-confirm', {
        phone: phone,
        error: 'Phone number must be exactly 11 digits'
      });
    }

    // Verify user exists
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(404).render('delete-account-confirm', {
        phone: phone,
        error: 'User not found'
      });
    }

    res.render('delete-account-confirm', {
      phone: phoneDigits,
      error: null
    });
  } catch (error) {
    res.status(500).render('delete-account-confirm', {
      phone: req.query.phone || '',
      error: error.message
    });
  }
});

// Get account deletion result page
router.get('/delete-account/result', (req, res) => {
  const { success, message } = req.query;
  res.render('delete-account-result', {
    success: success === 'true',
    message: message || (success === 'true' ? 'Your account has been successfully deleted.' : 'Failed to delete account.')
  });
});

// Delete account (supports both DELETE and POST for form submission)
router.delete('/account', async (req, res) => {
  await handleAccountDeletion(req, res);
});

router.post('/delete-account', async (req, res) => {
  await handleAccountDeletion(req, res);
});

// Delete account by phone only (from form submission - no password required)
router.post('/delete-account-by-phone', async (req, res) => {
  await handleAccountDeletionByPhone(req, res);
});

// Account deletion handler (with password verification for API)
async function handleAccountDeletion(req, res) {
  try {
    // Support both JSON and form-urlencoded data
    const phone = req.body.phone;
    const password = req.body.password;
    
    if (!phone || !password) {
      if (req.accepts('html')) {
        return res.status(400).render('delete-account-result', {
          success: false,
          message: 'Phone and password are required'
        });
      }
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      if (req.accepts('html')) {
        return res.status(400).render('delete-account-result', {
          success: false,
          message: 'Phone number must be exactly 11 digits'
        });
      }
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Find user
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      if (req.accepts('html')) {
        return res.status(404).render('delete-account-result', {
          success: false,
          message: 'User not found'
        });
      }
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      if (req.accepts('html')) {
        return res.status(401).render('delete-account-result', {
          success: false,
          message: 'Password is incorrect'
        });
      }
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    const userId = user._id;

    // Delete all related data
    try {
      // Delete all customers and their photos
      const customers = await Customer.find({ userId });
      for (const customer of customers) {
        if (customer.photo) {
          try {
            await deleteFromS3(customer.photo);
          } catch (error) {
            console.error('Error deleting customer photo:', error);
          }
        }
      }
      await Customer.deleteMany({ userId });

      // Delete all orders and their associated images
      const orders = await Order.find({ userId });
      for (const order of orders) {
        // Delete style pictures
        if (order.stylePictures && order.stylePictures.length > 0) {
          for (const imageUrl of order.stylePictures) {
            try {
              await deleteFromS3(imageUrl);
            } catch (error) {
              console.error('Error deleting order style picture:', error);
            }
          }
        }
        // Delete sketches
        if (order.sketches && order.sketches.length > 0) {
          for (const sketchUrl of order.sketches) {
            try {
              await deleteFromS3(sketchUrl);
            } catch (error) {
              console.error('Error deleting order sketch:', error);
            }
          }
        }
      }
      await Order.deleteMany({ userId });

      // Delete all measurements and their photos
      const measurements = await Measurement.find({ userId });
      for (const measurement of measurements) {
        if (measurement.photoReference) {
          try {
            await deleteFromS3(measurement.photoReference);
          } catch (error) {
            console.error('Error deleting measurement photo:', error);
          }
        }
      }
      await Measurement.deleteMany({ userId });

      // Delete all notifications
      await Notification.deleteMany({ userId });
    } catch (error) {
      console.error('Error deleting related data:', error);
      // Continue with account deletion even if some cleanup fails
    }

    // Delete profile image from S3 if exists
    if (user.profileImage) {
      try {
        await deleteFromS3(user.profileImage);
      } catch (error) {
        console.error('Error deleting profile image:', error);
        // Continue with account deletion even if image deletion fails
      }
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    if (req.accepts('html')) {
      return res.render('delete-account-result', {
        success: true,
        message: 'Your account and all associated data have been permanently deleted.'
      });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    if (req.accepts('html')) {
      return res.status(500).render('delete-account-result', {
        success: false,
        message: error.message || 'An error occurred while deleting your account'
      });
    }
    res.status(400).json({ message: error.message });
  }
}

// Account deletion handler by phone only (no password required)
async function handleAccountDeletionByPhone(req, res) {
  try {
    // Support both JSON and form-urlencoded data
    const phone = req.body.phone;
    
    if (!phone) {
      if (req.accepts('html')) {
        return res.status(400).render('delete-account-result', {
          success: false,
          message: 'Phone number is required'
        });
      }
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      if (req.accepts('html')) {
        return res.status(400).render('delete-account-result', {
          success: false,
          message: 'Phone number must be exactly 11 digits'
        });
      }
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Find user
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      if (req.accepts('html')) {
        return res.status(404).render('delete-account-result', {
          success: false,
          message: 'Account not found with this phone number'
        });
      }
      return res.status(404).json({ message: 'Account not found with this phone number' });
    }

    const userId = user._id;

    // Delete all related data
    try {
      // Delete all customers and their photos
      const customers = await Customer.find({ userId });
      for (const customer of customers) {
        if (customer.photo) {
          try {
            await deleteFromS3(customer.photo);
          } catch (error) {
            console.error('Error deleting customer photo:', error);
          }
        }
      }
      await Customer.deleteMany({ userId });

      // Delete all orders and their associated images
      const orders = await Order.find({ userId });
      for (const order of orders) {
        // Delete style pictures
        if (order.stylePictures && order.stylePictures.length > 0) {
          for (const imageUrl of order.stylePictures) {
            try {
              await deleteFromS3(imageUrl);
            } catch (error) {
              console.error('Error deleting order style picture:', error);
            }
          }
        }
        // Delete sketches
        if (order.sketches && order.sketches.length > 0) {
          for (const sketchUrl of order.sketches) {
            try {
              await deleteFromS3(sketchUrl);
            } catch (error) {
              console.error('Error deleting order sketch:', error);
            }
          }
        }
      }
      await Order.deleteMany({ userId });

      // Delete all measurements and their photos
      const measurements = await Measurement.find({ userId });
      for (const measurement of measurements) {
        if (measurement.photoReference) {
          try {
            await deleteFromS3(measurement.photoReference);
          } catch (error) {
            console.error('Error deleting measurement photo:', error);
          }
        }
      }
      await Measurement.deleteMany({ userId });

      // Delete all notifications
      await Notification.deleteMany({ userId });
    } catch (error) {
      console.error('Error deleting related data:', error);
      // Continue with account deletion even if some cleanup fails
    }

    // Delete profile image from S3 if exists
    if (user.profileImage) {
      try {
        await deleteFromS3(user.profileImage);
      } catch (error) {
        console.error('Error deleting profile image:', error);
        // Continue with account deletion even if image deletion fails
      }
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    if (req.accepts('html')) {
      return res.render('delete-account-result', {
        success: true,
        message: 'Your account and all associated data have been permanently deleted.'
      });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    if (req.accepts('html')) {
      return res.status(500).render('delete-account-result', {
        success: false,
        message: error.message || 'An error occurred while deleting your account'
      });
    }
    res.status(400).json({ message: error.message });
  }
}

// Helper function to handle upload
const handleImageUpload = async (req, res) => {
  try {
    console.log('Image upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? 'File received' : 'No file');
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    // Find user
    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old image if exists (before uploading new one)
    if (user.profileImage) {
      console.log('Deleting old profile image:', user.profileImage);
      try {
        await deleteFromS3(user.profileImage);
        console.log('Old profile image deleted successfully');
      } catch (error) {
        console.error('Error deleting old image:', error);
        // Continue even if deletion fails - we'll still upload the new image
      }
    } else {
      console.log('No existing profile image to delete');
    }

    // Upload new image to S3
    const fileName = req.file.originalname || 'profile.jpg';
    const imageUrl = await uploadToS3(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    // Update user profile with new image URL
    user.profileImage = imageUrl;
    await user.save();

    const userJson = user.toJSON();
    res.json({
      message: 'Profile image uploaded successfully',
      profileImage: imageUrl, // Already using public URL from uploadToS3
      user: userJson,
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ message: error.message || 'Failed to upload profile image' });
  }
};

// Upload profile image (avatar) - Main route
router.post('/upload-profile-image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'Error uploading file' });
    }
    next();
  });
}, handleImageUpload);

// Alternative route name for avatar upload
router.post('/avatar', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'Error uploading file' });
    }
    next();
  });
}, handleImageUpload);

export default router;

