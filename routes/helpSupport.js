import express from 'express';
import AppSettings from '../models/AppSettings.js';

const router = express.Router();

// Get help & support (public endpoint - no auth required)
router.get('/public', async (req, res) => {
  try {
    console.log('Public help & support endpoint called');
    const settings = await AppSettings.getSettings();
    console.log('Help & Support retrieved from database');
    
    const settingsObj = settings.toObject();
    
    // Return data from database only, no defaults
    res.json({
      emailSupport: settingsObj.helpSupport?.emailSupport || '',
      phoneSupport: settingsObj.helpSupport?.phoneSupport || '',
      faq: settingsObj.helpSupport?.faq || [],
    });
  } catch (error) {
    console.error('Error fetching public help & support:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch help & support',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

