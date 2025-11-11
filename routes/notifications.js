import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

// Helper function to get user from phone
const getUserFromPhone = async (phone) => {
  if (!phone) return null;
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length !== 11) return null;
  return await User.findOne({ phone: phoneDigits });
};

// Get all notifications
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
    
    const notifications = await Notification.find({ userId: user._id })
      .populate('orderId')
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get unread notifications
router.get('/unread', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notifications = await Notification.find({ 
      read: false,
      userId: user._id 
    })
      .populate('orderId')
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single notification
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
    
    const notification = await Notification.findOne({ _id: req.params.id, userId: user._id })
      .populate('orderId')
      .populate('customerId');
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create notification
router.post('/', async (req, res) => {
  try {
    const { phone, ...notificationData } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = new Notification({ ...notificationData, userId: user._id });
    const savedNotification = await notification.save();
    await savedNotification.populate('orderId');
    await savedNotification.populate('customerId');
    res.status(201).json(savedNotification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update notification (mark as read)
router.put('/:id', async (req, res) => {
  try {
    const { phone, ...updateData } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('orderId')
      .populate('customerId');
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mark all as read
router.put('/mark-all-read', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await Notification.updateMany({ userId: user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete notification
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
    
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

