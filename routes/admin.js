import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import AppSettings from '../models/AppSettings.js';
import { uploadToS3, deleteFromS3, convertToPublicUrl } from '../services/s3Service.js';
import { sendPushNotifications } from '../services/pushNotificationService.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const phone = req.body.phone || req.query.phone;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const user = await User.findOne({ phone: phoneDigits });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({ isAdmin: { $ne: true } })
      .select('-password')
      .sort({ createdAt: -1 });
    
    const usersJson = users.map(user => {
      const userObj = user.toJSON();
      if (userObj.profileImage) {
        userObj.profileImage = convertToPublicUrl(userObj.profileImage);
      }
      return userObj;
    });
    
    res.json(usersJson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userJson = user.toJSON();
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const { phone } = req.body;
    delete req.body.phone; // Don't allow phone update through this route
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userJson = user.toJSON();
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    const { phone } = req.query;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete profile image from S3 if exists
    if (user.profileImage) {
      try {
        await deleteFromS3(user.profileImage);
      } catch (error) {
        console.error('Error deleting profile image:', error);
      }
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user subscription
router.put('/users/:id/subscription', isAdmin, async (req, res) => {
  try {
    const { subscriptionType, subscriptionStatus, subscriptionStartDate, subscriptionEndDate } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If subscription type is being changed, calculate dates automatically
    if (subscriptionType && subscriptionType !== user.subscriptionType) {
      user.subscriptionType = subscriptionType;
      
      // Calculate dates based on subscription type
      const startDate = subscriptionStartDate ? new Date(subscriptionStartDate) : new Date();
      const endDate = subscriptionEndDate ? new Date(subscriptionEndDate) : new Date();
      
      // If no end date provided, calculate based on subscription type
      if (!subscriptionEndDate) {
        if (subscriptionType === 'trial') {
          // Trial: 30 days from start
          endDate.setDate(startDate.getDate() + 30);
          user.trialStartDate = startDate;
          user.trialEndDate = endDate;
          // Clear paid subscription dates for trial
          user.subscriptionStartDate = undefined;
          user.subscriptionEndDate = undefined;
        } else if (subscriptionType === 'monthly') {
          // Monthly: 1 month from start
          endDate.setMonth(startDate.getMonth() + 1);
          user.subscriptionStartDate = startDate;
          user.subscriptionEndDate = endDate;
          // Clear trial dates for paid subscription
          user.trialStartDate = undefined;
          user.trialEndDate = undefined;
        } else if (subscriptionType === 'quarterly') {
          // Quarterly: 3 months from start
          endDate.setMonth(startDate.getMonth() + 3);
          user.subscriptionStartDate = startDate;
          user.subscriptionEndDate = endDate;
          // Clear trial dates for paid subscription
          user.trialStartDate = undefined;
          user.trialEndDate = undefined;
        } else if (subscriptionType === 'yearly') {
          // Yearly: 1 year from start
          endDate.setFullYear(startDate.getFullYear() + 1);
          user.subscriptionStartDate = startDate;
          user.subscriptionEndDate = endDate;
          // Clear trial dates for paid subscription
          user.trialStartDate = undefined;
          user.trialEndDate = undefined;
        }
      } else {
        // If end date is provided, use it
        if (subscriptionType === 'trial') {
          user.trialStartDate = startDate;
          user.trialEndDate = endDate;
          user.subscriptionStartDate = undefined;
          user.subscriptionEndDate = undefined;
        } else {
          user.subscriptionStartDate = startDate;
          user.subscriptionEndDate = endDate;
          user.trialStartDate = undefined;
          user.trialEndDate = undefined;
        }
      }
      
      // Set status to active if not provided
      if (!subscriptionStatus) {
        user.subscriptionStatus = 'active';
      }
    } else {
      // If subscription type is not changing, just update what's provided
      if (subscriptionType) {
        user.subscriptionType = subscriptionType;
      }
      if (subscriptionStatus) {
        user.subscriptionStatus = subscriptionStatus;
      }
      if (subscriptionStartDate) {
        user.subscriptionStartDate = new Date(subscriptionStartDate);
      }
      if (subscriptionEndDate) {
        user.subscriptionEndDate = new Date(subscriptionEndDate);
      }
    }
    
    await user.save();
    
    const userJson = user.toJSON();
    if (userJson.profileImage) {
      userJson.profileImage = convertToPublicUrl(userJson.profileImage);
    }
    res.json(userJson);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get subscription packages/pricing
router.get('/subscription/packages', isAdmin, async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Return subscription packages from database only (no hardcoded fallbacks)
    if (!settingsObj.subscriptionPackages || !settingsObj.subscriptionPackages.plans || settingsObj.subscriptionPackages.plans.length === 0) {
      return res.status(404).json({ 
        message: 'Subscription packages not found in database. Please initialize them first.' 
      });
    }
    
    const packages = {
      plans: settingsObj.subscriptionPackages.plans,
      trial: settingsObj.subscriptionPackages.trial,
    };
    
    console.log('Fetched subscription packages from database:', JSON.stringify(packages, null, 2));
    res.json(packages);
  } catch (error) {
    console.error('Error fetching subscription packages:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update subscription packages
router.put('/subscription/packages', isAdmin, async (req, res) => {
  try {
    const { plans, trial } = req.body;
    
    // Validate input
    if (!plans || !Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ message: 'Plans array is required and must not be empty' });
    }
    
    // Validate each plan
    for (const plan of plans) {
      if (!plan.type || !['monthly', 'quarterly', 'yearly'].includes(plan.type)) {
        return res.status(400).json({ message: `Invalid plan type: ${plan.type}. Must be monthly, quarterly, or yearly` });
      }
      if (!plan.name || typeof plan.name !== 'string') {
        return res.status(400).json({ message: 'Plan name is required and must be a string' });
      }
      if (typeof plan.price !== 'number' || plan.price < 0) {
        return res.status(400).json({ message: 'Plan price is required and must be a non-negative number' });
      }
      if (!plan.duration || typeof plan.duration !== 'string') {
        return res.status(400).json({ message: 'Plan duration is required and must be a string' });
      }
    }
    
    // Validate trial
    if (trial) {
      if (trial.duration && typeof trial.duration !== 'string') {
        return res.status(400).json({ message: 'Trial duration must be a string' });
      }
      if (trial.price !== undefined && (typeof trial.price !== 'number' || trial.price < 0)) {
        return res.status(400).json({ message: 'Trial price must be a non-negative number' });
      }
    }
    
    console.log('Updating subscription packages:', { plansCount: plans.length, hasTrial: !!trial });
    
    // Prepare trial data - use provided trial or default structure
    const trialData = trial || {
      duration: '30 days',
      price: 0,
    };
    
    // Update settings in database
    const updatedSettings = await AppSettings.updateSettings({
      subscriptionPackages: {
        plans,
        trial: trialData,
      },
    });
    
    console.log('Subscription packages updated successfully in database');
    
    const settingsObj = updatedSettings.toObject();
    const packages = {
      plans: settingsObj.subscriptionPackages.plans,
      trial: settingsObj.subscriptionPackages.trial,
    };
    
    res.json({ 
      message: 'Subscription packages updated successfully', 
      packages 
    });
  } catch (error) {
    console.error('Error updating subscription packages:', error);
    res.status(400).json({ message: error.message || 'Failed to update subscription packages' });
  }
});

// Send notification to all users
router.post('/notifications/broadcast', isAdmin, async (req, res) => {
  try {
    const { title, message, type } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }
    
    // Define valid notification types
    const validTypes = [
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
    ];
    
    // Validate and normalize the type
    // Handle potential typos or variations
    let normalizedType = type;
    if (type === 'trial_user') {
      normalizedType = 'trial_users'; // Fix common typo
    }
    const notificationType = (normalizedType && validTypes.includes(normalizedType)) ? normalizedType : 'order_update';
    
    console.log('Broadcast notification request:', { 
      originalType: type, 
      normalizedType, 
      finalType: notificationType,
      title, 
      message 
    });
    
    let users;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Filter users based on notification type
    if (notificationType === 'expiring_soon') {
      // Users with subscriptions expiring within 7 days
      users = await User.find({ 
        isAdmin: { $ne: true },
        subscriptionStatus: 'active'
      });
      
      users = users.filter(user => {
        const endDate = user.subscriptionType === 'trial' 
          ? (user.trialEndDate ? new Date(user.trialEndDate) : null)
          : (user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null);
        
        if (endDate) {
          return endDate >= now && endDate <= sevenDaysFromNow;
        }
        return false;
      });
    } else if (notificationType === 'expired') {
      // Users with expired subscriptions
      users = await User.find({ 
        isAdmin: { $ne: true },
        $or: [
          { subscriptionStatus: 'expired' },
          {
            subscriptionStatus: 'active',
            $or: [
              { 
                subscriptionType: 'trial',
                trialEndDate: { $lt: now }
              },
              {
                subscriptionType: { $ne: 'trial' },
                subscriptionEndDate: { $lt: now }
              }
            ]
          }
        ]
      });
    } else if (notificationType === 'trial_users') {
      // Users on free trial
      users = await User.find({ 
        isAdmin: { $ne: true },
        subscriptionType: 'trial',
        subscriptionStatus: 'active'
      });
    } else {
      // Get all users (excluding admins) for other notification types
      users = await User.find({ isAdmin: { $ne: true } });
    }
    
    // Create notifications for all filtered users with sound enabled
    console.log(`Creating ${users.length} notifications with type: ${notificationType}`);
    
    if (users.length === 0) {
      return res.json({ 
        message: 'No users found for this notification type',
        count: 0 
      });
    }
    
    const notifications = users.map(user => ({
      userId: user._id,
      type: notificationType, // Use validated type
      title,
      message,
      read: false,
      sound: true, // Enable sound for broadcast notifications
      date: new Date(),
    }));
    
    try {
    await Notification.insertMany(notifications);
      console.log(`Successfully created ${notifications.length} notifications`);
      
      // Send push notifications to users with valid push tokens
      const usersWithTokens = users.filter(user => 
        user.pushNotificationEnabled && 
        user.pushNotificationToken
      );
      
      if (usersWithTokens.length > 0) {
        const pushTokens = usersWithTokens.map(user => user.pushNotificationToken);
        console.log(`Sending push notifications to ${pushTokens.length} users`);
        
        const pushResult = await sendPushNotifications(
          pushTokens,
          title,
          message,
          {
            type: notificationType,
            sound: true,
          }
        );
        
        console.log(`Push notifications: ${pushResult.success} sent, ${pushResult.failed} failed`);
      } else {
        console.log('No users with push notification tokens found');
      }
    } catch (insertError) {
      console.error('Error inserting notifications:', insertError);
      // If validation error, provide more details
      if (insertError.name === 'ValidationError') {
        const validationErrors = Object.keys(insertError.errors || {}).map(key => {
          return `${key}: ${insertError.errors[key].message}`;
        }).join(', ');
        return res.status(400).json({ 
          message: `Validation error: ${validationErrors}`,
          details: insertError.message 
        });
      }
      throw insertError;
    }
    
    res.json({ 
      message: `Notification sent to ${users.length} users`,
      count: users.length 
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get app settings (welcome screen content, header colors, etc.) - Admin only
router.get('/settings', isAdmin, async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    
    // Convert background image URL to public URL if it's an S3 URL
    const settingsObj = settings.toObject();
    if (settingsObj.welcomeScreen?.backgroundImage) {
      settingsObj.welcomeScreen.backgroundImage = convertToPublicUrl(settingsObj.welcomeScreen.backgroundImage);
    }
    
    // Ensure showSubscription is always a boolean
    const showSubscriptionValue = settingsObj.showSubscription !== undefined ? Boolean(settingsObj.showSubscription) : true;
    
    res.json({
      welcomeScreen: settingsObj.welcomeScreen,
      headerColors: settingsObj.headerColors,
      showSubscription: showSubscriptionValue,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update app settings
router.put('/settings', isAdmin, async (req, res) => {
  try {
    const { welcomeScreen, headerColors, showSubscription, phone } = req.body;
    
    console.log('Updating app settings:', { 
      hasWelcomeScreen: !!welcomeScreen, 
      hasHeaderColors: !!headerColors,
      showSubscription: showSubscription,
      showSubscriptionType: typeof showSubscription,
      phone: phone ? 'provided' : 'missing'
    });
    
    // Validate input
    if (!welcomeScreen && !headerColors && showSubscription === undefined) {
      return res.status(400).json({ message: 'At least one setting group is required' });
    }
    
    // Prepare update object - only include fields that are provided
    const updateData = {};
    if (welcomeScreen) updateData.welcomeScreen = welcomeScreen;
    if (headerColors) updateData.headerColors = headerColors;
    if (showSubscription !== undefined) {
      // Ensure boolean value
      updateData.showSubscription = Boolean(showSubscription);
      console.log('Setting showSubscription to:', updateData.showSubscription, '(type:', typeof updateData.showSubscription, ')');
    }
    
    // Update settings in database
    const updatedSettings = await AppSettings.updateSettings(updateData);
    
    console.log('Settings updated successfully in database');
    console.log('Current showSubscription value:', updatedSettings.showSubscription);
    
    // Convert background image URL to public URL if it's an S3 URL
    const settingsObj = updatedSettings.toObject();
    if (settingsObj.welcomeScreen?.backgroundImage) {
      settingsObj.welcomeScreen.backgroundImage = convertToPublicUrl(settingsObj.welcomeScreen.backgroundImage);
    }
    if (settingsObj.welcomeScreen?.logo) {
      settingsObj.welcomeScreen.logo = convertToPublicUrl(settingsObj.welcomeScreen.logo);
    }
    
    // Ensure showSubscription is always a boolean
    const finalShowSubscription = settingsObj.showSubscription !== undefined ? Boolean(settingsObj.showSubscription) : true;
    
    res.json({ 
      message: 'Settings updated successfully', 
      settings: {
        welcomeScreen: settingsObj.welcomeScreen,
        headerColors: settingsObj.headerColors,
        showSubscription: finalShowSubscription,
      }
    });
  } catch (error) {
    console.error('Error updating app settings:', error);
    res.status(400).json({ message: error.message || 'Failed to update settings' });
  }
});

// Upload welcome screen background image
router.post('/settings/welcome-background', upload.single('image'), async (req, res) => {
  try {
    console.log('Welcome background upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? `File received: ${req.file.originalname}, size: ${req.file.size} bytes` : 'No file');
    
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No image file provided' });
    }

    // No phone or user validation required - allow direct upload
    console.log('Proceeding with upload (no phone verification required)');
    
    // Get current settings to check for old image
    const currentSettings = await AppSettings.getSettings();
    const oldImageUrl = currentSettings.welcomeScreen?.backgroundImage;
    console.log('Old image URL:', oldImageUrl);
    
    // Upload new image to S3
    const fileName = req.file.originalname || 'welcome-background.jpg';
    console.log('Uploading to S3:', { fileName, mimetype: req.file.mimetype, size: req.file.size });
    
    const imageUrl = await uploadToS3(
      req.file.buffer,
      `welcome/${fileName}`,
      req.file.mimetype
    );
    console.log('Image uploaded to S3, URL:', imageUrl);
    
    // Delete old image from S3 if it exists and is an S3 URL
    if (oldImageUrl && (oldImageUrl.includes('profile-images') || oldImageUrl.includes('welcome/'))) {
      try {
        console.log('Deleting old image:', oldImageUrl);
        await deleteFromS3(oldImageUrl);
        console.log('Old image deleted successfully');
      } catch (error) {
        console.error('Error deleting old background image:', error);
        // Continue even if deletion fails
      }
    }
    
    // Update settings with new image URL
    console.log('Updating settings with new image URL:', imageUrl);
    await AppSettings.updateSettings({
      welcomeScreen: {
        backgroundImage: imageUrl,
      },
    });
    console.log('Settings updated successfully');
    
    // Convert to public URL for response
    const publicImageUrl = convertToPublicUrl(imageUrl);
    console.log('Public image URL:', publicImageUrl);
    
    res.json({ 
      message: 'Background image uploaded and settings updated successfully',
      imageUrl: publicImageUrl 
    });
  } catch (error) {
    console.error('Error in welcome background upload:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message || 'Failed to upload background image' });
  }
});

// Upload welcome screen logo
router.post('/settings/welcome-logo', upload.single('image'), async (req, res) => {
  try {
    console.log('Welcome logo upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? `File received: ${req.file.originalname}, size: ${req.file.size} bytes` : 'No file');
    
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No image file provided' });
    }

    // No phone or user validation required - allow direct upload
    console.log('Proceeding with logo upload (no phone verification required)');
    
    // Get current settings to check for old logo
    const currentSettings = await AppSettings.getSettings();
    const oldLogoUrl = currentSettings.welcomeScreen?.logo;
    console.log('Old logo URL:', oldLogoUrl);
    
    // Upload new logo to S3
    const fileName = req.file.originalname || 'welcome-logo.jpg';
    console.log('Uploading logo to S3:', { fileName, mimetype: req.file.mimetype, size: req.file.size });
    
    const imageUrl = await uploadToS3(
      req.file.buffer,
      `welcome/logo/${fileName}`,
      req.file.mimetype
    );
    console.log('Logo uploaded to S3, URL:', imageUrl);
    
    // Delete old logo from S3 if it exists and is an S3 URL
    if (oldLogoUrl && (oldLogoUrl.includes('profile-images') || oldLogoUrl.includes('welcome/logo/'))) {
      try {
        console.log('Deleting old logo:', oldLogoUrl);
        await deleteFromS3(oldLogoUrl);
        console.log('Old logo deleted successfully');
      } catch (error) {
        console.error('Error deleting old logo:', error);
        // Continue even if deletion fails
      }
    }
    
    // Update settings with new logo URL
    console.log('Updating settings with new logo URL:', imageUrl);
    await AppSettings.updateSettings({
      welcomeScreen: {
        logo: imageUrl,
      },
    });
    console.log('Settings updated successfully');
    
    // Convert to public URL for response
    const publicImageUrl = convertToPublicUrl(imageUrl);
    console.log('Public logo URL:', publicImageUrl);
    
    res.json({ 
      message: 'Logo uploaded and settings updated successfully',
      imageUrl: publicImageUrl 
    });
  } catch (error) {
    console.error('Error in welcome logo upload:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message || 'Failed to upload logo' });
  }
});

// Get statistics
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
    const activeSubscriptions = await User.countDocuments({ 
      isAdmin: { $ne: true },
      subscriptionStatus: 'active' 
    });
    const expiredSubscriptions = await User.countDocuments({ 
      isAdmin: { $ne: true },
      subscriptionStatus: 'expired' 
    });
    const trialUsers = await User.countDocuments({ 
      isAdmin: { $ne: true },
      subscriptionType: 'trial' 
    });
    
    res.json({
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      trialUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get help & support (admin only)
router.get('/help-support', isAdmin, async (req, res) => {
  try {
    const settings = await AppSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Return data from database only, no defaults
    res.json({
      emailSupport: settingsObj.helpSupport?.emailSupport || '',
      phoneSupport: settingsObj.helpSupport?.phoneSupport || '',
      faq: settingsObj.helpSupport?.faq || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update help & support
router.put('/help-support', isAdmin, async (req, res) => {
  try {
    const { emailSupport, phoneSupport, faq } = req.body;
    
    // Validate input
    if (!emailSupport || !phoneSupport) {
      return res.status(400).json({ message: 'Email support and phone support are required' });
    }
    
    // Validate FAQ array if provided
    if (faq && Array.isArray(faq)) {
      for (const item of faq) {
        if (!item.question || !item.answer) {
          return res.status(400).json({ message: 'Each FAQ item must have both question and answer' });
        }
      }
    }
    
    // Update settings in database
    const updatedSettings = await AppSettings.updateSettings({
      helpSupport: {
        emailSupport,
        phoneSupport,
        faq: faq || [],
      },
    });
    
    const settingsObj = updatedSettings.toObject();
    
    res.json({ 
      message: 'Help & Support updated successfully', 
      helpSupport: {
        emailSupport: settingsObj.helpSupport.emailSupport,
        phoneSupport: settingsObj.helpSupport.phoneSupport,
        faq: settingsObj.helpSupport.faq || [],
      }
    });
  } catch (error) {
    console.error('Error updating help & support:', error);
    res.status(400).json({ message: error.message || 'Failed to update help & support' });
  }
});

export default router;

