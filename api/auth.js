const express = require('express');
const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'POST') {
    res.on('finish', () => {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      console.log('[POST body]', payload);
    });
  }
  next();
});
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { extractFlatNumberFromEmail } = require('./accessScope');

const FAMILY_MEMBER_LIMIT = 15;

function normalizeCnicKey(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 13 ? digits : '';
}

function sanitizeFamilyMember(member = {}) {
  return {
    memberName: String(member.memberName || member.name || member.member || '').trim(),
    relation: String(member.relation || '').trim(),
    cnic: String(member.cnic || '').trim(),
    phone: String(member.phone || '').trim(),
  };
}

function sanitizeFamilyMembers(rawMembers = []) {
  return (Array.isArray(rawMembers) ? rawMembers : [])
    .map(sanitizeFamilyMember)
    .filter((member) => member.memberName || member.relation || member.cnic || member.phone);
}

function findDuplicateCnic(members = []) {
  const seen = new Set();
  for (const member of members) {
    const key = normalizeCnicKey(member.cnic);
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function uniqueMembersByCnic(members = []) {
  const result = [];
  const seen = new Set();
  for (const member of members) {
    const key = normalizeCnicKey(member.cnic);
    if (!key) {
      result.push(member);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(member);
  }
  return result;
}

function mergeFamilyMembers(existingMembers = [], incomingMembers = []) {
  const existing = uniqueMembersByCnic(sanitizeFamilyMembers(existingMembers));
  const incoming = sanitizeFamilyMembers(incomingMembers);

  if (!incoming.length) {
    return existing;
  }

  if (findDuplicateCnic(incoming)) {
    throw new Error('Duplicate CNIC is not allowed. Please edit the existing member instead.');
  }

  const byCnic = new Map();
  const merged = [];

  for (const member of existing) {
    const key = normalizeCnicKey(member.cnic);
    if (key) {
      byCnic.set(key, merged.length);
    }
    merged.push(member);
  }

  for (const member of incoming) {
    const key = normalizeCnicKey(member.cnic);
    if (!member.memberName || !member.relation || !key) {
      throw new Error('Each family member must include member name, relation, and valid CNIC.');
    }

    if (byCnic.has(key)) {
      merged[byCnic.get(key)] = {
        ...merged[byCnic.get(key)],
        ...member,
      };
    } else {
      byCnic.set(key, merged.length);
      merged.push(member);
    }
  }

  if (merged.length > FAMILY_MEMBER_LIMIT) {
    throw new Error(`Maximum ${FAMILY_MEMBER_LIMIT} family members are allowed per flat.`);
  }

  if (findDuplicateCnic(merged)) {
    throw new Error('Duplicate CNIC is not allowed in family details.');
  }

  return merged;
}

async function verifyCollectionLogin({ collectionName, normalizedEmail, password, fallbackRole }) {
  const db = mongoose.connection && mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready.');
  }

  const collection = db.collection(collectionName);
  let record = await collection.findOne({ email: normalizedEmail });

  if (!record) {
    const fallbackUser = await User.findOne({ email: normalizedEmail, role: fallbackRole });
    if (!fallbackUser) {
      return { ok: false };
    }

    const isFallbackPasswordMatch = await fallbackUser.comparePassword(password);
    if (!isFallbackPasswordMatch) {
      return { ok: false };
    }

    await collection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          userId: fallbackUser._id,
          email: normalizedEmail,
          role: fallbackRole,
          active: true,
          passwordHash: fallbackUser.password,
          name: fallbackUser.name || fallbackUser.username || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          username: normalizedEmail.split('@')[0],
        },
      },
      { upsert: true }
    );

    record = await collection.findOne({ email: normalizedEmail });
    return { ok: true, record, user: fallbackUser };
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

function getSignupTarget(signupMode) {
  return { collectionName: 'reception', role: 'manager', successMessage: 'Reception account registered successfully.' };
}

function getAuthTarget(loginType) {
  return { collectionName: 'reception', role: 'manager' };
}

function normalizeVehicleNumberKey(value = '') {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractFlatNumberForResident(record = {}, email = '') {
  const emailMatch = String(email || '').toLowerCase().match(/(\d+)@[^@]+$/i);
  if (emailMatch && emailMatch[1]) return emailMatch[1];

  const usernameMatch = String(record?.username || '').toLowerCase().match(/_(\d+)$/i);
  if (usernameMatch && usernameMatch[1]) return usernameMatch[1];

  const nameMatch = String(record?.name || '').toLowerCase().match(/_(\d+)$/i);
  if (nameMatch && nameMatch[1]) return nameMatch[1];

  return '';
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

  if (!loginType || !['reception'].includes(loginType)) {
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
      const receptionLogin = await verifyCollectionLogin({
        collectionName: 'reception',
        normalizedEmail,
        password,
        fallbackRole: 'manager',
      });

      if (!receptionLogin.ok) {
        console.log('[LOGIN FAIL] Reception invalid credentials for:', normalizedEmail);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const user = receptionLogin.user || {
        _id: receptionLogin.record.userId || receptionLogin.record._id,
        email: receptionLogin.record.email || normalizedEmail,
        role: 'manager',
        name: receptionLogin.record.name || receptionLogin.record.username || '',
      };

      req.session.user = { email: user.email, id: user._id, role: user.role, loginType };
      console.log('[LOGIN SUCCESS] reception', normalizedEmail);
      return res.json({ success: true, user });
    }

  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Signup requests are disabled for this deployment.
router.post('/signup', async (_req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Account creation is disabled. Please use the reception login flow only.',
  });
});

router.post('/reset-password', async (req, res) => {
  const { email, loginType, newPassword, confirmPassword } = req.body;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !loginType || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, login type, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  if (!['reception'].includes(loginType)) {
    return res.status(400).json({ success: false, message: 'Please select a valid login type.' });
  }

  try {
    const { collectionName, role } = getAuthTarget(loginType);
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const collection = db.collection(collectionName);
    const record = await collection.findOne({ email: normalizedEmail });
    let userDoc = record?.userId ? await User.findById(record.userId) : null;

    if (!userDoc) {
      userDoc = await User.findOne({ email: normalizedEmail, role });
    }

    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'Account not found for the selected login type.' });
    }

    userDoc.password = newPassword;
    userDoc.updatedAt = new Date();
    await userDoc.save();

    await collection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          userId: userDoc._id,
          email: normalizedEmail,
          role,
          active: true,
          passwordHash: userDoc.password,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          username: normalizedEmail.split('@')[0],
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

router.get('/profile', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  try {
    const { collectionName, role } = getAuthTarget(String(sessionUser.loginType || 'reception'));
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const collection = db.collection(collectionName);
    const familyCollection = db.collection('family_detail');
    const vehicleCollection = db.collection('vehicle_registration');
    const email = String(sessionUser.email || '').toLowerCase();
    const record = await collection.findOne({ email });
    const userDoc = record?.userId ? await User.findById(record.userId) : await User.findOne({ email, role });

    const flatNumber = String(sessionUser.flatNumber || extractFlatNumberFromEmail(email) || '').trim();
    const residentName = String(userDoc?.name || record?.name || record?.username || '').trim();
    const [familyRecord, vehicleRecords] = flatNumber
      ? await Promise.all([
          familyCollection.findOne({ flatNumber, isActive: { $ne: false } }),
          vehicleCollection.find({ flatNumber, }).sort({ uploadedAt: -1 }).toArray(),
        ])
      : [null, []];

    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    return res.json({
      success: true,
      profile: {
        name: residentName,
        email: userDoc.email || email,
        role: userDoc.role || role,
        loginType: String(sessionUser.loginType || '').toLowerCase(),
        flatNumber,
        signupDetails: {
          username: String(record?.username || '').trim(),
          accountName: residentName,
        },
        familyDetails: familyRecord ? {
          id: String(familyRecord._id || ''),
          residentName: String(familyRecord.residentName || '').trim(),
          flatNumber: String(familyRecord.flatNumber || '').trim(),
          familyMembers: Array.isArray(familyRecord.familyMembers) ? familyRecord.familyMembers : [],
          fileName: familyRecord.fileName || '',
          fileUrl: familyRecord.fileUrl || '',
          uploadedAt: familyRecord.uploadedAt || null,
        } : null,
        vehicleDetails: Array.isArray(vehicleRecords) ? vehicleRecords.map((vehicle) => ({
          id: String(vehicle._id || ''),
          ownerName: String(vehicle.ownerName || '').trim(),
          ownerCnic: String(vehicle.ownerCnic || '').trim(),
          flatNumber: String(vehicle.flatNumber || '').trim(),
          vehicleType: String(vehicle.vehicleType || '').trim(),
          vehicleNumber: String(vehicle.vehicleNumber || '').trim(),
          address: String(vehicle.address || '').trim(),
          registrationDate: String(vehicle.registrationDate || '').trim(),
          fileName: vehicle.fileName || '',
          fileUrl: vehicle.fileUrl || '',
          uploadedAt: vehicle.uploadedAt || null,
        })) : [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch profile.' });
  }
});

router.put('/profile', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  const displayName = String(req.body.displayName || '').trim();
  const residentName = String(req.body.residentName || displayName || '').trim();
  const flatNumber = String(req.body.flatNumber || '').trim();
  const familyMembers = Array.isArray(req.body.familyMembers) ? req.body.familyMembers : [];
  const vehicleDetails = Array.isArray(req.body.vehicleDetails) ? req.body.vehicleDetails : [];

  if (!displayName && !residentName && !flatNumber && !familyMembers.length && !vehicleDetails.length) {
    return res.status(400).json({ success: false, message: 'Profile data is required.' });
  }

  try {
    const loginType = String(sessionUser.loginType || 'reception').toLowerCase();
    const { collectionName, role } = getAuthTarget(loginType);
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const email = String(sessionUser.email || '').toLowerCase();
    const collection = db.collection(collectionName);
    const familyCollection = db.collection('family_detail');
    const vehicleCollection = db.collection('vehicle_registration');
    const userRecord = await collection.findOne({ email });
    const userDoc = userRecord?.userId ? await User.findById(userRecord.userId) : await User.findOne({ email, role });

    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    const nextName = displayName || residentName || userDoc.name || '';
    userDoc.name = nextName;
    userDoc.updatedAt = new Date();
    await userDoc.save();

    await collection.updateOne(
      { email },
      {
        $set: {
          name: nextName,
          username: nextName,
          userId: userDoc._id,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const residentFlatNumber = flatNumber || String(email.match(/(\d+)@chs\.com$/i)?.[1] || '').trim();

    if (false && residentFlatNumber) {
      if (residentName || familyMembers.length || req.body.familyRecordId) {
        const existingFamilyRecord = await familyCollection.findOne({
          flatNumber: residentFlatNumber,
          isActive: { $ne: false },
        });

        const mergedFamilyMembers = mergeFamilyMembers(
          existingFamilyRecord?.familyMembers || [],
          familyMembers
        );

        const familyPayload = {
          residentName: residentName || nextName,
          flatNumber: residentFlatNumber,
          familyMembers: mergedFamilyMembers,
          isActive: true,
          updatedAt: new Date(),
        };

        if (req.body.familyRecordId && mongoose.Types.ObjectId.isValid(String(req.body.familyRecordId))) {
          await familyCollection.updateOne(
            { _id: new mongoose.Types.ObjectId(String(req.body.familyRecordId)) },
            { $set: familyPayload, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
        } else {
          await familyCollection.updateOne(
            { flatNumber: residentFlatNumber, isActive: { $ne: false } },
            { $set: familyPayload, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
        }
      }

      if (vehicleDetails.length) {
        for (const vehicle of vehicleDetails) {
          const ownerName = String(vehicle.ownerName || nextName).trim();
          const ownerCnic = String(vehicle.ownerCnic || '').trim();
          const vehicleFlatNumber = String(vehicle.flatNumber || residentFlatNumber).trim();
          const vehicleType = String(vehicle.vehicleType || '').trim();
          const vehicleNumber = String(vehicle.vehicleNumber || '').trim().toUpperCase();
          const vehicleNumberKey = normalizeVehicleNumberKey(vehicleNumber);
          if (!ownerName || !vehicleFlatNumber || !vehicleType || !vehicleNumber || !vehicleNumberKey) {
            continue;
          }

          const vehiclePayload = {
            ownerName,
            ownerCnic,
            flatNumber: vehicleFlatNumber,
            vehicleType,
            vehicleNumber,
            vehicleNumberKey,
            address: String(vehicle.address || '').trim(),
            registrationDate: String(vehicle.registrationDate || '').trim(),
            updatedAt: new Date(),
            isActive: true,
          };

          if (vehicle.id && mongoose.Types.ObjectId.isValid(String(vehicle.id))) {
            await vehicleCollection.updateOne(
              { _id: new mongoose.Types.ObjectId(String(vehicle.id)) },
              { $set: vehiclePayload, $setOnInsert: { createdAt: new Date() } },
              { upsert: true }
            );
          } else {
            await vehicleCollection.updateOne(
              {
                flatNumber: vehicleFlatNumber,
                isActive: { $ne: false },
                $or: [
                  { vehicleNumberKey },
                  { vehicleNumber },
                ],
              },
              { $set: vehiclePayload, $setOnInsert: { createdAt: new Date() } },
              { upsert: true }
            );
          }
        }
      }
    }

    req.session.user = {
      ...sessionUser,
      email,
      name: nextName,
    };

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      profile: {
        name: nextName,
        email,
        role: userDoc.role || role,
        loginType,
        flatNumber: residentFlatNumber,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update profile.' });
  }
});

module.exports = router;