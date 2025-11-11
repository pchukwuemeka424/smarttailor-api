import express from 'express';
import Measurement from '../models/Measurement.js';
import User from '../models/User.js';

const router = express.Router();

// Helper function to get user from phone
const getUserFromPhone = async (phone) => {
  if (!phone) return null;
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length !== 11) return null;
  return await User.findOne({ phone: phoneDigits });
};

// Get all measurements
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
    
    const measurements = await Measurement.find({ userId: user._id })
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(measurements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get measurements by customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const measurements = await Measurement.find({ 
      customerId: req.params.customerId,
      userId: user._id 
    })
      .populate('customerId')
      .sort({ createdAt: -1 });
    res.json(measurements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single measurement
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
    
    const measurement = await Measurement.findOne({ _id: req.params.id, userId: user._id })
      .populate('customerId');
    if (!measurement) {
      return res.status(404).json({ message: 'Measurement not found' });
    }
    res.json(measurement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create measurement
router.post('/', async (req, res) => {
  try {
    const { phone, ...measurementData } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }
    
    const user = await getUserFromPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const measurement = new Measurement({ ...measurementData, userId: user._id });
    const savedMeasurement = await measurement.save();
    await savedMeasurement.populate('customerId');
    res.status(201).json(savedMeasurement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update measurement
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
    
    const measurement = await Measurement.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('customerId');
    if (!measurement) {
      return res.status(404).json({ message: 'Measurement not found' });
    }
    res.json(measurement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete measurement
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
    
    const measurement = await Measurement.findOneAndDelete({ _id: req.params.id, userId: user._id });
    if (!measurement) {
      return res.status(404).json({ message: 'Measurement not found' });
    }
    res.json({ message: 'Measurement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

