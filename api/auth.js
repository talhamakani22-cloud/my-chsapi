const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function verifyCollectionLogin({ collectionName, normalizedEmail, password, fallbackRole }) {
  const db = mongoose.connection && mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready.');
  }

  const collection = db.collection(collectionName);
  const record = await collection.findOne({ email: normalizedEmail });
  if (!record) {
    return { ok: false };
  }

  if (record.passwordHash) {
    const isHashMatch = await bcrypt.compare(password, record.passwordHash);
    if (isHashMatch) {
      return { ok: true, record, user: null };
    }
    return { ok: false };
  }

  const fallbackUser = await User.findOne({ email: normalizedEmail, role: fallbackRole });
  if (!fallbackUser) {
    return { ok: false };
  }

  const isFallbackPasswordMatch = await fallbackUser.comparePassword(password);
  if (!isFallbackPasswordMatch) {
    return { ok: false };
  }

  await collection.updateOne(
    { _id: record._id },
    {
      $set: {
        userId: fallbackUser._id,
        email: normalizedEmail,
        role: fallbackRole,
        active: true,
        passwordHash: fallbackUser.password,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return { ok: true, record, user: fallbackUser };
}

// GET login route
router.get('/login', (req, res) => {
  res.json({ message: 'GET login route (Express)' });
});

// POST login route
router.post('/login', async (req, res) => {
  const { email, password, loginType } = req.body;
  console.log('[LOGIN ATTEMPT]', { email, loginType });
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  if (!loginType || !['reception', 'resident', 'committee'].includes(loginType)) {
    return res.status(400).json({ success: false, message: 'Please select a valid login type.' });
  }

  // Save login credentials to JSON file (for demo/testing only)
  const fs = require('fs');
  const path = require('path');
  const loginRecordsPath = path.join(__dirname, '../data/loginRecords.json');
  const loginRecord = {
    email: normalizedEmail,
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
    if (loginType === 'reception') {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        console.log('[LOGIN FAIL] Reception user not found:', normalizedEmail);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('[LOGIN FAIL] Reception incorrect password for:', normalizedEmail);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!['manager', 'admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'This account cannot sign in as reception.',
          suggestedLoginType: user.role === 'user' ? 'resident' : 'committee',
        });
      }

      req.session.user = { email: user.email, id: user._id, role: user.role, loginType };
      console.log('[LOGIN SUCCESS] reception', normalizedEmail);
      return res.json({ success: true, user });
    }

    if (loginType === 'resident') {
      const residentLogin = await verifyCollectionLogin({
        collectionName: 'resident',
        normalizedEmail,
        password,
        fallbackRole: 'user',
      });

      if (!residentLogin.ok) {
        console.log('[LOGIN FAIL] resident invalid credentials for:', normalizedEmail);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const residentUser = residentLogin.user || {
        _id: residentLogin.record.userId || residentLogin.record._id,
        email: residentLogin.record.email || normalizedEmail,
        role: 'user',
        name: residentLogin.record.name || residentLogin.record.username || '',
      };

      req.session.user = { email: residentUser.email, id: residentUser._id, role: 'user', loginType };
      console.log('[LOGIN SUCCESS] resident', normalizedEmail);
      return res.json({ success: true, user: residentUser });
    }

    const committeeLogin = await verifyCollectionLogin({
      collectionName: 'committee',
      normalizedEmail,
      password,
      fallbackRole: 'admin',
    });

    if (!committeeLogin.ok) {
      console.log('[LOGIN FAIL] committee invalid credentials for:', normalizedEmail);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const committeeUser = committeeLogin.user || {
      _id: committeeLogin.record.userId || committeeLogin.record._id,
      email: committeeLogin.record.email || normalizedEmail,
      role: 'admin',
      name: committeeLogin.record.name || 'Committee Head',
    };

    req.session.user = { email: committeeUser.email, id: committeeUser._id, role: 'admin', loginType };
    console.log('[LOGIN SUCCESS] committee', normalizedEmail);
    return res.json({ success: true, user: committeeUser });

  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST signup route - committee head can create resident credentials
router.post('/signup', async (req, res) => {
  const {
    username,
    email,
    password,
    signupMode,
    committeeEmail,
    committeePassword,
  } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const residentEmailPattern = /^[a-z]+(?:[._-]?[a-z]+)*\d+@chs\.com$/i;
  const residentUsernamePattern = /^[a-z]+(?:_[a-z]+)*_\d+$/i;

  if (!residentEmailPattern.test(String(email).trim())) {
    return res.status(400).json({
      success: false,
      message: 'Email must be like name + apartment number @chs.com (e.g., ali123@chs.com).',
    });
  }

  if (!residentUsernamePattern.test(String(username).trim())) {
    return res.status(400).json({
      success: false,
      message: 'Username must be like name_flatnumber (e.g., ali_123).',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim().toLowerCase();

  const emailPartsMatch = normalizedEmail.match(/^([a-z._-]+?)(\d+)@chs\.com$/i);
  const usernamePartsMatch = normalizedUsername.match(/^([a-z_]+)_(\d+)$/i);

  if (!emailPartsMatch || !usernamePartsMatch) {
    return res.status(400).json({ success: false, message: 'Invalid resident email or username format.' });
  }

  const emailName = emailPartsMatch[1].replace(/[._-]/g, '');
  const emailFlat = emailPartsMatch[2];
  const usernameName = usernamePartsMatch[1].replace(/_/g, '');
  const usernameFlat = usernamePartsMatch[2];

  if (emailName !== usernameName || emailFlat !== usernameFlat) {
    return res.status(400).json({
      success: false,
      message: 'Name and flat number must match in both email and username.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    const isResidentSelfSignup = signupMode === 'resident-self';

    if (!isResidentSelfSignup) {
      if (!committeeEmail || !committeePassword) {
        return res.status(400).json({ success: false, message: 'Committee credentials are required.' });
      }

      const committeeUser = await User.findOne({ email: committeeEmail.toLowerCase().trim() });
      if (!committeeUser) {
        return res.status(403).json({ success: false, message: 'Only committee head can create resident credentials.' });
      }

      const committeePasswordMatch = await committeeUser.comparePassword(committeePassword);
      if (!committeePasswordMatch || committeeUser.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Invalid committee head credentials.' });
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const newResident = await User.create({
      name: username.trim(),
      email: normalizedEmail,
      password,
      role: 'user',
      isActive: true,
    });

    try {
      const residentCollection = mongoose.connection.db.collection('resident');
      await residentCollection.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            userId: newResident._id,
            username: normalizedUsername,
            email: normalizedEmail,
            name: username.trim(),
            role: 'user',
            active: true,
            passwordHash: newResident.password,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (residentErr) {
      await User.deleteOne({ _id: newResident._id }).catch(() => {});
      console.error('[RESIDENT COLLECTION WRITE ERROR]', residentErr);
      return res.status(500).json({
        success: false,
        message: 'Could not complete resident registration. Please try again.',
      });
    }

    return res.status(201).json({
      success: true,
      message: isResidentSelfSignup
        ? 'Resident account registered successfully.'
        : 'Resident credentials created successfully.',
      user: newResident,
    });
  } catch (err) {
    console.error('[SIGNUP ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;