import express from 'express';
import Flutterwave from 'flutterwave-node-v3';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize Flutterwave (only if keys are provided)
let flw = null;
let flwConfigured = false;
if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
  flw = new Flutterwave(
    process.env.FLUTTERWAVE_PUBLIC_KEY,
    process.env.FLUTTERWAVE_SECRET_KEY
  );
  flwConfigured = true;
}

// Flutterwave API base URL
const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

// Initialize payment
router.post('/initialize', async (req, res) => {
  try {
    if (!flwConfigured) {
      return res.status(500).json({ 
        message: 'Payment gateway not configured. Please set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY in environment variables.' 
      });
    }

    let { phone, subscriptionType, amount, email, name } = req.body;

    if (!phone || !subscriptionType || !amount || !email || !name) {
      return res.status(400).json({ 
        message: 'Phone, subscription type, amount, email, and name are required' 
      });
    }

    // Handle case where phone might be an array
    if (Array.isArray(phone)) {
      phone = phone[0];
    }
    
    // Ensure phone is a string
    phone = String(phone);

    // Normalize phone to 11 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return res.status(400).json({ message: 'Phone number must be exactly 11 digits' });
    }

    const user = await User.findOne({ phone: phoneDigits });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate unique transaction reference
    const txRef = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create payment payload
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'NGN',
      redirect_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payment/callback?tx_ref=${txRef}`,
      payment_options: 'card,banktransfer,ussd,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyuganda,mobilemoneyzambia,barter,mpesa,mobilemoneyfranco',
      customer: {
        email: email,
        phonenumber: phoneDigits,
        name: name,
      },
      customizations: {
        title: 'SmartTailor NG Subscription',
        description: `${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)} Subscription Payment`,
        logo: 'https://your-logo-url.com/logo.png', // Update with your logo URL
      },
      meta: {
        phone: phoneDigits,
        subscriptionType: subscriptionType,
        userId: user._id.toString(),
      },
    };

    // Initialize payment using Flutterwave API directly
    const response = await fetch(`${FLUTTERWAVE_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (responseData.status === 'success' && responseData.data && responseData.data.link) {
      // Store payment reference in user (optional, for tracking)
      user.pendingPayment = {
        txRef: txRef,
        subscriptionType: subscriptionType,
        amount: amount,
        createdAt: new Date(),
      };
      await user.save();

      res.json({
        status: 'success',
        message: 'Payment initialized successfully',
        paymentUrl: responseData.data.link,
        txRef: txRef,
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: responseData.message || 'Failed to initialize payment',
        data: responseData,
      });
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to initialize payment' 
    });
  }
});

// Payment callback/verification
router.get('/callback', async (req, res) => {
  try {
    if (!flwConfigured) {
      return res.render('payment-result', {
        success: false,
        message: 'Payment gateway not configured',
      });
    }

    const { tx_ref, transaction_id, status } = req.query;

    if (!tx_ref) {
      return res.render('payment-result', {
        success: false,
        paymentStatus: 'error',
        message: 'Transaction reference is missing',
      });
    }

    // Check if payment was cancelled (status parameter from Flutterwave)
    if (status === 'cancelled') {
      return res.render('payment-result', {
        success: false,
        paymentStatus: 'cancelled',
        message: 'Payment was cancelled. You can try again anytime.',
        txRef: tx_ref,
      });
    }

    // Verify transaction with Flutterwave API
    let verificationResponse;
    try {
      const verifyUrl = transaction_id 
        ? `${FLUTTERWAVE_API_URL}/transactions/${transaction_id}/verify`
        : `${FLUTTERWAVE_API_URL}/transactions/verify_by_reference?tx_ref=${tx_ref}`;
      
      const verifyRes = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      verificationResponse = await verifyRes.json();
    } catch (verifyError) {
      console.error('Verification error:', verifyError);
      return res.render('payment-result', {
        success: false,
        paymentStatus: 'error',
        message: 'Failed to verify transaction. Please contact support if payment was deducted.',
        txRef: tx_ref,
      });
    }

    // Check transaction status
    const transactionStatus = verificationResponse.data?.status;
    
    if (verificationResponse.status === 'success' && verificationResponse.data && transactionStatus === 'successful') {
      const transaction = verificationResponse.data;
      const phone = transaction.customer?.phonenumber || transaction.meta?.phone;
      const subscriptionType = transaction.meta?.subscriptionType;

      if (!phone || !subscriptionType) {
        return res.render('payment-result', {
          success: false,
          paymentStatus: 'error',
          message: 'Invalid transaction data. Please contact support.',
          txRef: tx_ref,
        });
      }

      // Normalize phone
      let phoneStr = phone;
      if (Array.isArray(phoneStr)) {
        phoneStr = phoneStr[0];
      }
      phoneStr = String(phoneStr || '');
      const phoneDigits = phoneStr.replace(/\D/g, '');
      const user = await User.findOne({ phone: phoneDigits });

      if (!user) {
        return res.render('payment-result', {
          success: false,
          paymentStatus: 'error',
          message: 'User account not found. Please contact support.',
          txRef: tx_ref,
        });
      }

      // Calculate subscription end date
      const subscriptionStartDate = new Date();
      const subscriptionEndDate = new Date();
      
      if (subscriptionType === 'monthly') {
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
      } else if (subscriptionType === 'quarterly') {
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 3);
      } else if (subscriptionType === 'yearly') {
        subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
      }

      // Update user subscription
      user.subscriptionType = subscriptionType;
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = subscriptionStartDate;
      user.subscriptionEndDate = subscriptionEndDate;
      
      // Clear trial dates when upgrading to paid subscription
      user.trialStartDate = undefined;
      user.trialEndDate = undefined;
      
      user.pendingPayment = undefined; // Clear pending payment
      
      // Store payment record (optional)
      if (!user.paymentHistory) {
        user.paymentHistory = [];
      }
      user.paymentHistory.push({
        txRef: tx_ref,
        transactionId: transaction_id,
        amount: transaction.amount,
        subscriptionType: subscriptionType,
        status: 'successful',
        paidAt: new Date(),
      });

      await user.save();

      console.log(`✅ Payment successful for user ${phoneDigits}. Subscription ${subscriptionType} activated.`);

      return res.render('payment-result', {
        success: true,
        paymentStatus: 'successful',
        message: 'Payment successful! Your subscription has been activated.',
        subscriptionType: subscriptionType,
        amount: transaction.amount,
        txRef: tx_ref,
      });
    } else if (transactionStatus === 'failed' || transactionStatus === 'unsuccessful') {
      // Payment failed
      return res.render('payment-result', {
        success: false,
        paymentStatus: 'failed',
        message: 'Payment failed. Please try again or use a different payment method.',
        txRef: tx_ref,
      });
    } else {
      // Other statuses (pending, etc.)
      return res.render('payment-result', {
        success: false,
        paymentStatus: 'pending',
        message: verificationResponse.message || 'Payment is being processed. Please check back later.',
        txRef: tx_ref,
      });
    }
  } catch (error) {
    console.error('Callback error:', error);
    return res.render('payment-result', {
      success: false,
      paymentStatus: 'error',
      message: 'An error occurred while processing your payment. Please contact support if payment was deducted.',
      txRef: req.query.tx_ref || 'unknown',
    });
  }
});

// Verify payment status
router.get('/verify/:txRef', async (req, res) => {
  try {
    if (!flwConfigured) {
      return res.status(500).json({ 
        message: 'Payment gateway not configured' 
      });
    }

    const { txRef } = req.params;

    const verifyRes = await fetch(`${FLUTTERWAVE_API_URL}/transactions/verify_by_reference?tx_ref=${txRef}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verificationResponse = await verifyRes.json();

    if (verificationResponse.status === 'success') {
      res.json({
        status: 'success',
        data: verificationResponse.data,
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: verificationResponse.message || 'Transaction verification failed',
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to verify transaction' 
    });
  }
});

export default router;

