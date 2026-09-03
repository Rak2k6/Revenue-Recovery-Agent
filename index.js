// Enable TypeScript for new src/ modules without a build step
require('ts-node').register({ transpileOnly: true, files: true });

require('dotenv').config({ path: 'credential.env' });
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// express.json() verify callback: captures the raw request buffer *during*
// stream consumption, so the webhook route can run HMAC-SHA256 against the
// exact bytes that Razorpay signed — without a separate stream-reading middleware.
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Razorpay instance
// Replace with your actual key_id and key_secret, or use .env file
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET',
});

// Endpoint to create an order
app.post('/create-order', async (req, res) => {
  try {
    const options = {
      amount: 50000, // amount in the smallest currency unit (e.g., ₹500.00)
      currency: 'INR',
      receipt: `receipt_order_${Math.floor(Math.random() * 1000)}`,
    };
    
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Endpoint to verify payment signature (Success)
app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  const secret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET';
  
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');
    
  if (expectedSignature === razorpay_signature) {
    res.status(200).json({ status: 'SUCCESS', message: 'Payment verified successfully' });
  } else {
    res.status(400).json({ status: 'FAILED', message: 'Invalid signature' });
  }
});

app.get('/get-razorpay-key', (req, res) => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID });
});

// ── Milestone 1: Revenue Recovery Agent routes ────────────────────────────────
const { mountRoutes } = require('./src/routes/index');
mountRoutes(app);
// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
