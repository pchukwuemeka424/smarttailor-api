/**
 * Initialize AppSettings in the database
 * This script creates the default app settings document if it doesn't exist
 */

import dotenv from 'dotenv';
import AppSettings from '../models/AppSettings.js';
import connectDB from '../config/database.js';

// Load environment variables
dotenv.config();

async function initAppSettings() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Checking for existing app settings...');
    let settings = await AppSettings.findOne();
    
    // Use getSettings to ensure all defaults are initialized
    settings = await AppSettings.getSettings();
    const settingsObj = settings.toObject();
    
    // Check if subscription packages need initialization
    if (!settingsObj.subscriptionPackages || !settingsObj.subscriptionPackages.plans || settingsObj.subscriptionPackages.plans.length === 0) {
      console.log('Initializing subscription packages with defaults...');
      await AppSettings.updateSettings({
        subscriptionPackages: {
          plans: [
            {
              type: 'monthly',
              name: 'Monthly',
              price: 500,
              duration: '1 month',
              savings: null,
            },
            {
              type: 'quarterly',
              name: 'Quarterly',
              price: 1500,
              duration: '3 months',
              savings: 'Save ₦0 (Same as monthly)',
            },
            {
              type: 'yearly',
              name: 'Yearly',
              price: 5000,
              duration: '1 year',
              savings: 'Save ₦1000 (17% off)',
            },
          ],
          trial: {
            duration: '30 days',
            price: 0,
          },
        },
      });
      console.log('✅ Subscription packages initialized in database');
    }
    
    console.log('✅ AppSettings ready in database');
    const finalSettings = await AppSettings.getSettings();
    const finalSettingsObj = finalSettings.toObject();
    console.log('Current settings:');
    console.log(JSON.stringify({
      welcomeScreen: finalSettingsObj.welcomeScreen,
      headerColors: finalSettingsObj.headerColors,
      helpSupport: finalSettingsObj.helpSupport || null,
      subscriptionPackages: finalSettingsObj.subscriptionPackages || null,
      showSubscription: finalSettingsObj.showSubscription,
    }, null, 2));
    
    console.log('\n✅ AppSettings initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing app settings:', error);
    process.exit(1);
  }
}

// Run the initialization
initAppSettings();

