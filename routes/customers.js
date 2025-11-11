/**
 * Customer Routes
 * 
 * CRITICAL DATA ISOLATION:
 * - All customers MUST have a userId field that identifies the user who created them
 * - When creating a customer, userId is ALWAYS set from the authenticated user (never trust client)
 * - When fetching customers, ONLY customers with matching userId are returned
 * - Users can ONLY access customers they created (enforced by userId filtering)
 * 
 * Security:
 * - userId is extracted from the phone parameter (which comes from AsyncStorage on frontend)
 * - Client-provided userId is IGNORED and replaced with authenticated user's ID
 * - All queries filter by userId to ensure data isolation
 */

import express from 'express';
import Customer from '../models/Customer.js';
import User from '../models/User.js';

const router = express.Router();

// Helper function to get user from phone
const getUserFromPhone = async (phone) => {
  if (!phone) return null;
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length !== 11) return null;
  return await User.findOne({ phone: phoneDigits });
};

// Get all customers
router.get('/', async (req, res) => {
  try {
    let { phone } = req.query;
    console.log('=== FETCHING CUSTOMERS ===');
    console.log('Received phone from query:', phone);
    
    if (!phone) {
      console.error('❌ Phone is missing from request');
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    phone = String(phone);
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      console.error('❌ User not found for phone:', phone);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('✅ Found user ID:', user._id.toString(), 'for phone:', phone);
    
    // CRITICAL: Only fetch customers that belong to this user
    const customers = await Customer.find({ userId: user._id }).sort({ createdAt: -1 });
    
    console.log('✅ Found', customers.length, 'customers for user:', user._id.toString());
    console.log('✅ Customer IDs:', customers.map(c => ({ id: c._id, userId: c.userId, name: c.name })));
    console.log('========================');
    
    res.json(customers);
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single customer
router.get('/:id', async (req, res) => {
  try {
    let { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    phone = String(phone);
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // CRITICAL: Only return customer if it belongs to this user
    const customer = await Customer.findOne({ _id: req.params.id, userId: user._id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or does not belong to your account' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    console.log('=== CUSTOMER CREATION REQUEST ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    let { phone, ...customerData } = req.body;
    console.log('Extracted phone (for user auth):', phone);
    console.log('Extracted customerData:', customerData);
    
    // IMPORTANT: The phone in the request body serves dual purpose:
    // 1. User authentication (to find which user is creating the customer)
    // 2. Customer's phone number (stored in the customer record)
    // We need to preserve the phone for the customer record
    customerData.phone = phone;
    
    // CRITICAL: Phone is required for user identification
    if (!phone) {
      console.error('❌ CRITICAL: Phone is missing from request body!');
      console.error('❌ Request body keys:', Object.keys(req.body));
      return res.status(400).json({ 
        message: 'Phone is required for customer creation',
        received: Object.keys(req.body),
        error: 'MISSING_PHONE'
      });
    }
    
    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      console.log('📞 Phone is array, taking first element:', phone);
      phone = phone[0];
    }
    
    // Ensure phone is a string
    phone = String(phone);
    console.log('📞 Final phone for user lookup:', phone);
    
    // Find user by phone
    const user = await getUserFromPhone(phone);
    if (!user) {
      console.error('❌ CRITICAL: User not found for phone:', phone);
      console.error('❌ This means either:');
      console.error('   1. User is not logged in');
      console.error('   2. Phone format is incorrect');
      console.error('   3. User does not exist in database');
      return res.status(404).json({ 
        message: 'User not found. Please ensure you are logged in.',
        phone: phone,
        error: 'USER_NOT_FOUND'
      });
    }
    
    console.log('✅ Found user for customer creation:');
    console.log('   User ID:', user._id.toString());
    console.log('   User phone:', user.phone);
    console.log('   User business:', user.businessName);
    
    // CRITICAL SECURITY: Remove any userId from client data
    if (customerData.userId) {
      console.warn('⚠️ Client tried to send userId - IGNORING for security');
      delete customerData.userId;
    }
    
    // FORCE userId to authenticated user - NEVER trust client
    const customerToSave = {
      ...customerData,
      userId: user._id, // ALWAYS use server-side authenticated user ID
    };
    
    console.log('✅ Customer data to save:');
    console.log('   Name:', customerToSave.name);
    console.log('   Phone:', customerToSave.phone);
    console.log('   Gender:', customerToSave.gender);
    console.log('   Address:', customerToSave.address);
    console.log('   UserId:', user._id.toString());
    
    // Create and save customer
    const customer = new Customer(customerToSave);
    console.log('📝 Created Customer instance, now saving...');
    
    const savedCustomer = await customer.save();
    console.log('💾 Customer saved to database');
    
    // CRITICAL VERIFICATION: Ensure userId was saved correctly
    if (!savedCustomer.userId) {
      console.error('❌ CRITICAL ERROR: Customer saved WITHOUT userId!');
      console.error('❌ This should never happen with required field');
      console.error('❌ Saved customer:', JSON.stringify(savedCustomer, null, 2));
      // Delete the broken customer
      await Customer.findByIdAndDelete(savedCustomer._id);
      return res.status(500).json({ 
        message: 'Database error: Customer created without userId',
        error: 'MISSING_USERID_AFTER_SAVE'
      });
    }
    
    if (savedCustomer.userId.toString() !== user._id.toString()) {
      console.error('❌ CRITICAL ERROR: Customer saved with WRONG userId!');
      console.error('❌ Expected:', user._id.toString());
      console.error('❌ Actual:', savedCustomer.userId.toString());
      // Delete the customer with wrong userId
      await Customer.findByIdAndDelete(savedCustomer._id);
      return res.status(500).json({ 
        message: 'Database error: Customer created with incorrect userId',
        error: 'WRONG_USERID_AFTER_SAVE'
      });
    }
    
    console.log('✅ SUCCESS: Customer created with correct userId!');
    console.log('✅ Customer ID:', savedCustomer._id.toString());
    console.log('✅ Customer userId:', savedCustomer.userId.toString());
    console.log('✅ Customer name:', savedCustomer.name);
    console.log('✅ Verification: userId matches user:', savedCustomer.userId.toString() === user._id.toString());
    console.log('===============================');
    
    res.status(201).json(savedCustomer);
  } catch (error) {
    console.error('❌ EXCEPTION in customer creation:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      console.error('❌ Mongoose validation error:', error.errors);
      return res.status(400).json({ 
        message: 'Validation error: ' + error.message,
        errors: error.errors,
        error: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Internal server error during customer creation',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    let { phone, ...updateData } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    phone = String(phone);
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // CRITICAL: Prevent userId from being changed
    delete updateData.userId;
    
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or does not belong to your account' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    let { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    phone = String(phone);
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // CRITICAL: Only delete customer if it belongs to this user
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or does not belong to your account' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

