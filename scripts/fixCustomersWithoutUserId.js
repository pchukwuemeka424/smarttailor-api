/**
 * Migration script to fix customers without userId
 * This script should be run once to clean up existing data
 * 
 * WARNING: This will DELETE customers that cannot be assigned to any user
 * Run this only if you're sure about cleaning up orphaned customers
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../models/Customer.js';
import User from '../models/User.js';
import connectDB from '../config/database.js';

// Load environment variables
dotenv.config({ path: './.env' });

async function fixCustomersWithoutUserId() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Finding customers without userId...');
    const customersWithoutUserId = await Customer.find({ userId: { $exists: false } });
    console.log(`Found ${customersWithoutUserId.length} customers without userId`);
    
    if (customersWithoutUserId.length === 0) {
      console.log('✅ All customers have userId. No action needed.');
      process.exit(0);
    }
    
    // Option 1: Delete customers without userId (recommended for fresh start)
    console.log('\n⚠️  WARNING: This will DELETE all customers without userId!');
    console.log('If you want to keep them, you need to manually assign them to users.');
    console.log('Deleting customers without userId...');
    
    const deleteResult = await Customer.deleteMany({ userId: { $exists: false } });
    console.log(`✅ Deleted ${deleteResult.deletedCount} customers without userId`);
    
    // Option 2: If you want to keep them, you would need to assign them to a default user
    // Uncomment the code below if you want to assign orphaned customers to a specific user
    /*
    const defaultUser = await User.findOne({ phone: 'YOUR_DEFAULT_USER_PHONE' });
    if (defaultUser) {
      await Customer.updateMany(
        { userId: { $exists: false } },
        { userId: defaultUser._id }
      );
      console.log(`✅ Assigned orphaned customers to default user: ${defaultUser.businessName}`);
    }
    */
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

// Run the migration
fixCustomersWithoutUserId();

