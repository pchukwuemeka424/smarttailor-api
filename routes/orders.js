import express from 'express';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';

const router = express.Router();

// Helper function to get user from phone
const getUserFromPhone = async (phone) => {
  if (!phone) return null;
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length !== 11) return null;
  return await User.findOne({ phone: phoneDigits });
};

// Get all orders
router.get('/', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const orders = await Order.find({ userId: user._id })
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders by customer
router.get('/customer/:customerId', async (req, res) => {
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
    
    // Verify that the customer belongs to this user
    const customer = await Customer.findOne({ 
      _id: req.params.customerId, 
      userId: user._id 
    });
    if (!customer) {
      return res.status(403).json({ 
        message: 'Customer not found or does not belong to your account' 
      });
    }
    
    const orders = await Order.find({ 
      customerId: req.params.customerId,
      userId: user._id 
    })
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders by status
router.get('/status/:status', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const orders = await Order.find({ 
      status: req.params.status,
      userId: user._id 
    })
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const order = await Order.findOne({ _id: req.params.id, userId: user._id })
      .populate('customerId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create order
router.post('/', async (req, res) => {
  try {
    let { phone, ...orderData } = req.body;
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
    
    // Verify that the customer belongs to this user
    if (orderData.customerId) {
      const customer = await Customer.findOne({ 
        _id: orderData.customerId, 
        userId: user._id 
      });
      if (!customer) {
        return res.status(403).json({ 
          message: 'Customer not found or does not belong to your account' 
        });
      }
    }
    
    const order = new Order({ ...orderData, userId: user._id });
    const savedOrder = await order.save();
    await savedOrder.populate('customerId');
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ message: error.message });
  }
});

// Mark order as paid (must be before /:id route)
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const order = await Order.findOne({ _id: req.params.id, userId: user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Set amountPaid to amountCharged and balance to 0
    order.amountPaid = order.amountCharged;
    order.balance = 0;
    
    const updatedOrder = await order.save();
    await updatedOrder.populate('customerId');
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update order
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
    
    // Verify that the order belongs to this user
    const existingOrder = await Order.findOne({ 
      _id: req.params.id, 
      userId: user._id 
    });
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // If customerId is being updated, verify it belongs to the user
    if (updateData.customerId && updateData.customerId !== existingOrder.customerId.toString()) {
      const customer = await Customer.findOne({ 
        _id: updateData.customerId, 
        userId: user._id 
      });
      if (!customer) {
        return res.status(403).json({ 
          message: 'Customer not found or does not belong to your account' 
        });
      }
    }
    
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('customerId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete order
router.delete('/:id', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const order = await Order.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

