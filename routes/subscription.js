import express from 'express';
import User from '../models/User.js';
import AppSettings from '../models/AppSettings.js';

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Subscription routes are working!' });
});

// Get subscription status
router.get('/status', async (req, res) => {
  try {
    console.log('Subscription status endpoint called with query:', req.query);
    let { phone } = req.query;
    
    if (!phone) {
      console.log('Phone is missing in request');
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
      console.log('User not found for phone:', phoneDigits);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User found, subscription type:', user.subscriptionType);

    // Initialize subscription fields for existing users who don't have them
    if (!user.subscriptionType) {
      // Use createdAt if available, otherwise use current date
      const trialStartDate = user.createdAt ? new Date(user.createdAt) : new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + 30);
      
      user.subscriptionType = 'trial';
      user.subscriptionStatus = 'active';
      user.trialStartDate = trialStartDate;
      user.trialEndDate = trialEndDate;
      await user.save();
    }

    // Check if trial has expired
    let subscriptionStatus = user.subscriptionStatus || 'active';
    if (user.subscriptionType === 'trial' && user.trialEndDate) {
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      if (now > trialEnd && subscriptionStatus === 'active') {
        subscriptionStatus = 'expired';
        user.subscriptionStatus = 'expired';
        await user.save();
      }
    }

    // Check if paid subscription has expired
    if (user.subscriptionType !== 'trial' && user.subscriptionEndDate) {
      const now = new Date();
      const subEnd = new Date(user.subscriptionEndDate);
      if (now > subEnd && subscriptionStatus === 'active') {
        subscriptionStatus = 'expired';
        user.subscriptionStatus = 'expired';
        await user.save();
      }
    }

    const userJson = user.toJSON();
    res.json({
      subscriptionType: userJson.subscriptionType,
      subscriptionStatus: subscriptionStatus,
      trialStartDate: userJson.trialStartDate,
      trialEndDate: userJson.trialEndDate,
      subscriptionStartDate: userJson.subscriptionStartDate,
      subscriptionEndDate: userJson.subscriptionEndDate,
      daysRemaining: userJson.trialEndDate 
        ? Math.max(0, Math.ceil((new Date(userJson.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : (userJson.subscriptionEndDate 
          ? Math.max(0, Math.ceil((new Date(userJson.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
          : 0),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upgrade subscription
router.post('/upgrade', async (req, res) => {
  try {
    let { phone, subscriptionType } = req.body;
    
    if (!phone || !subscriptionType) {
      return res.status(400).json({ message: 'Phone and subscription type are required' });
    }

    if (!['monthly', 'quarterly', 'yearly'].includes(subscriptionType)) {
      return res.status(400).json({ message: 'Invalid subscription type. Must be monthly, quarterly, or yearly' });
    }

    // Handle case where phone might be an array
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

    // Calculate subscription end date based on type
    const subscriptionStartDate = new Date();
    const subscriptionEndDate = new Date();
    
    if (subscriptionType === 'monthly') {
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    } else if (subscriptionType === 'quarterly') {
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 3);
    } else if (subscriptionType === 'yearly') {
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
    }

    // Update user subscription
    user.subscriptionType = subscriptionType;
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = subscriptionStartDate;
    user.subscriptionEndDate = subscriptionEndDate;
    
    // Clear trial dates when upgrading to paid subscription
    user.trialStartDate = undefined;
    user.trialEndDate = undefined;

    await user.save();

    const userJson = user.toJSON();
    res.json({
      message: 'Subscription upgraded successfully',
      subscription: {
        subscriptionType: userJson.subscriptionType,
        subscriptionStatus: userJson.subscriptionStatus,
        subscriptionStartDate: userJson.subscriptionStartDate,
        subscriptionEndDate: userJson.subscriptionEndDate,
      },
      user: userJson,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subscription pricing
router.get('/pricing', async (req, res) => {
  try {
    console.log('Pricing endpoint called - fetching from database');
    
    // Fetch subscription packages from database
    const settings = await AppSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Return subscription packages from database only (no hardcoded fallbacks)
    if (!settingsObj.subscriptionPackages || !settingsObj.subscriptionPackages.plans || settingsObj.subscriptionPackages.plans.length === 0) {
      console.error('Subscription packages not found in database');
      return res.status(404).json({ 
        message: 'Subscription packages not available. Please contact administrator.' 
      });
    }
    
    const pricingData = {
      plans: settingsObj.subscriptionPackages.plans,
      trial: settingsObj.subscriptionPackages.trial,
    };
    
    console.log('Sending pricing data from database:', JSON.stringify(pricingData, null, 2));
    res.json(pricingData);
  } catch (error) {
    console.error('Error in pricing endpoint:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

export default router;

