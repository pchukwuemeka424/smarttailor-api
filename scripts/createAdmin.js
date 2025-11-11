import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

dotenv.config();

async function createAdmin() {
  try {
    await connectDB();
    
    const adminPhone = '08065509861';
    const adminPassword = 'killbill1';
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ phone: adminPhone });
    
    if (existingAdmin) {
      if (existingAdmin.isAdmin) {
        console.log('Admin user already exists');
        // Update password in case it changed
        existingAdmin.password = adminPassword;
        await existingAdmin.save();
        console.log('Admin password updated');
      } else {
        // Make existing user an admin
        existingAdmin.isAdmin = true;
        existingAdmin.password = adminPassword;
        await existingAdmin.save();
        console.log('User promoted to admin');
      }
    } else {
      // Create new admin user
      const admin = new User({
        phone: adminPhone,
        password: adminPassword,
        businessName: 'Admin',
        address: 'Admin Address',
        name: 'Admin',
        isAdmin: true,
        subscriptionType: 'yearly',
        subscriptionStatus: 'active',
      });
      
      await admin.save();
      console.log('Admin user created successfully');
    }
    
    console.log('Admin credentials:');
    console.log('Phone: 08065509861');
    console.log('Password: killbill1');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

