const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const NOTIFICATIONS_COLLECTION = 'notifications';

function canCreateNotification(sessionUser) {
  const role = String(sessionUser?.role || '').toLowerCase();
  const loginType = String(sessionUser?.loginType || '').toLowerCase();
  return role === 'admin' || loginType === 'committee';
}

function normalizeTarget(target = '') {
  const value = String(target || '').toLowerCase();
  if (value === 'resident' || value === 'reception' || value === 'both') {
    return value;
  }
  return 'both';
}

function canViewNotificationForUser(notification, sessionUser) {
  const loginType = String(sessionUser?.loginType || '').toLowerCase();
  if (loginType === 'committee') {
    return true;
  }

  const target = normalizeTarget(notification?.target);
  if (target === 'both') return loginType === 'resident' || loginType === 'reception';
  return target === loginType;
}

router.get('/', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const query = includeInactive ? {} : { isActive: { $ne: false } };

    const allRows = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const rows = allRows.filter((row) => canViewNotificationForUser(row, sessionUser));

    return res.json({
      success: true,
      rows,
      canCreate: canCreateNotification(sessionUser),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch notifications.' });
  }
});

router.post('/', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canCreateNotification(sessionUser)) {
    return res.status(403).json({ success: false, message: 'Only committee head can create notifications.' });
  }

  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  const target = normalizeTarget(req.body.target);

  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Title and message are required.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const payload = {
      title,
      message,
      target,
      isActive: true,
      createdBy: {
        email: String(sessionUser.email || '').toLowerCase(),
        role: String(sessionUser.role || '').toLowerCase(),
        loginType: String(sessionUser.loginType || '').toLowerCase(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(NOTIFICATIONS_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      notification: { id: result.insertedId, ...payload },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to create notification.' });
  }
});

module.exports = router;
