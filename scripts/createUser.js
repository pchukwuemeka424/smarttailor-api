import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

dotenv.config();

async function createUser() {
  try {
    await connectDB();
    
    // Get arguments from command line
    const args = process.argv.slice(2);
    
    let phone, password, businessName, address, subscriptionType, isAdmin;
    
    // Parse command line arguments
    if (args.length >= 4) {
      phone = args[0];
      password = args[1];
      businessName = args[2];
      address = args[3];
      subscriptionType = args[4] || 'trial';
      isAdmin = args[5] === 'true' || args[5] === 'admin';
    } else {
      // If not enough arguments, show usage
      console.log('Usage: node scripts/createUser.js <phone> <password> <businessName> <address> [subscriptionType] [isAdmin]');
      console.log('\nExample:');
      console.log('  node scripts/createUser.js 08012345678 password123 "My Business" "123 Main St" trial false');
      console.log('  node scripts/createUser.js 08012345678 password123 "My Business" "123 Main St" yearly true');
      console.log('\nSubscription types: trial, monthly, quarterly, yearly');
      console.log('isAdmin: true/false or admin');
      process.exit(1);
    }
    
    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      console.error('Error: Phone number must be exactly 11 digits');
      process.exit(1);
    }
    
    // Validate subscription type
    const validSubscriptionTypes = ['trial', 'monthly', 'quarterly', 'yearly'];
    if (!validSubscriptionTypes.includes(subscriptionType)) {
      console.error(`Error: Subscription type must be one of: ${validSubscriptionTypes.join(', ')}`);
      process.exit(1);
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ phone: phoneDigits });
    
    if (existingUser) {
      console.log('User with this phone number already exists');
      console.log('Updating user...');
      
      existingUser.password = password;
      existingUser.businessName = businessName;
      existingUser.address = address;
      existingUser.name = businessName;
      existingUser.subscriptionType = subscriptionType;
      existingUser.subscriptionStatus = 'active';
      
      if (isAdmin) {
        existingUser.isAdmin = true;
      }
      
      // Set up trial dates if trial
      if (subscriptionType === 'trial') {
        const trialStartDate = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        existingUser.trialStartDate = trialStartDate;
        existingUser.trialEndDate = trialEndDate;
      }
      
      await existingUser.save();
      console.log('User updated successfully');
    } else {
      // Create new user
      const userData = {
        phone: phoneDigits,
        password: password,
        businessName: businessName,
        address: address,
        name: businessName,
        subscriptionType: subscriptionType,
        subscriptionStatus: 'active',
        isAdmin: isAdmin || false,
      };
      
      // Set up trial dates if trial
      if (subscriptionType === 'trial') {
        const trialStartDate = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        userData.trialStartDate = trialStartDate;
        userData.trialEndDate = trialEndDate;
      }
      
      const user = new User(userData);
      await user.save();
      console.log('User created successfully');
    }
    
    const user = await User.findOne({ phone: phoneDigits });
    const userJson = user.toJSON();
    
    console.log('\nUser Details:');
    console.log('=============');
    console.log(`Phone: ${userJson.phone}`);
    console.log(`Business Name: ${userJson.businessName}`);
    console.log(`Address: ${userJson.address}`);
    console.log(`Subscription Type: ${userJson.subscriptionType}`);
    console.log(`Subscription Status: ${userJson.subscriptionStatus}`);
    console.log(`Is Admin: ${userJson.isAdmin || false}`);
    if (userJson.trialStartDate) {
      console.log(`Trial Start: ${userJson.trialStartDate}`);
      console.log(`Trial End: ${userJson.trialEndDate}`);
    }
    console.log(`Created At: ${userJson.createdAt}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createUser();

