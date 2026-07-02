const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET login route
router.get('/login', (req, res) => {
  res.json({ message: 'GET login route (Express)' });
});

// POST login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('[LOGIN ATTEMPT]', { email, password });

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  // Save login credentials to JSON file (for demo/testing only)
  const fs = require('fs');
  const path = require('path');
  const loginRecordsPath = path.join(__dirname, '../data/loginRecords.json');
  const loginRecord = {
    email,
    password,
    loginTime: new Date().toISOString()
  };
  try {
    let records = [];
    if (fs.existsSync(loginRecordsPath)) {
      const fileData = fs.readFileSync(loginRecordsPath, 'utf8');
      records = JSON.parse(fileData);
    }
    records.push(loginRecord);
    fs.writeFileSync(loginRecordsPath, JSON.stringify(records, null, 2));
  } catch (err) {
    console.error('[LOGIN RECORD ERROR]', err);
    // Don't block login if logging fails
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log('[LOGIN FAIL] User not found:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('[LOGIN FAIL] Incorrect password for:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Set session
    req.session.user = { email: user.email, id: user._id };
    console.log('[LOGIN SUCCESS]', email);
    return res.json({ success: true, user });

  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;