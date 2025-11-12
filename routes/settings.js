import express from 'express';
import AppSettings from '../models/AppSettings.js';
import { convertToPublicUrl } from '../services/s3Service.js';

const router = express.Router();

// Test route to verify settings router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Settings router is working', timestamp: new Date().toISOString() });
});

// Get app settings (public endpoint - no auth required)
router.get('/public', async (req, res) => {
  try {
    console.log('Public settings endpoint called');
    const settings = await AppSettings.getSettings();
    console.log('Settings retrieved from database');
    
    // Convert background image URL to public URL if it's an S3 URL
    const settingsObj = settings.toObject();
    if (settingsObj.welcomeScreen?.backgroundImage) {
      settingsObj.welcomeScreen.backgroundImage = convertToPublicUrl(settingsObj.welcomeScreen.backgroundImage);
    }
    if (settingsObj.welcomeScreen?.logo) {
      settingsObj.welcomeScreen.logo = convertToPublicUrl(settingsObj.welcomeScreen.logo);
    }
    
    console.log('Returning settings:', {
      title: settingsObj.welcomeScreen?.title,
      appName: settingsObj.welcomeScreen?.appName,
      hasLogo: !!settingsObj.welcomeScreen?.logo,
      showSubscription: settingsObj.showSubscription,
    });
    
    // Ensure showSubscription is always a boolean
    const showSubscriptionValue = settingsObj.showSubscription !== undefined ? Boolean(settingsObj.showSubscription) : true;
    
    res.json({
      welcomeScreen: settingsObj.welcomeScreen,
      headerColors: settingsObj.headerColors,
      showSubscription: showSubscriptionValue,
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch settings',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

