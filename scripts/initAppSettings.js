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
    
    if (settings) {
      console.log('✅ AppSettings already exists in database');
      console.log('Current settings:');
      console.log(JSON.stringify(settings.toObject(), null, 2));
    } else {
      console.log('Creating default app settings...');
      settings = await AppSettings.create({});
      console.log('✅ Default app settings created successfully');
      console.log('Settings:', JSON.stringify(settings.toObject(), null, 2));
    }
    
    console.log('\n✅ AppSettings initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing app settings:', error);
    process.exit(1);
  }
}

// Run the initialization
initAppSettings();

