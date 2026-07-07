const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const NOTIFICATIONS_COLLECTION = 'notifications';
const NOTIFICATION_DEVICES_COLLECTION = 'notification_devices';

function isExpoPushToken(token = '') {
  const value = String(token || '').trim();
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(value);
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendExpoPushNotifications(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return { sentCount: 0, ticketCount: 0, errors: [] };
  }

  const chunks = chunkArray(messages, 100);
  let ticketCount = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const data = await response.json().catch(() => ({}));
      const tickets = Array.isArray(data?.data) ? data.data : [];
      ticketCount += tickets.length;

      if (!response.ok) {
        errors.push(data?.errors || [{ message: `Expo push HTTP ${response.status}` }]);
      }
    } catch (err) {
      errors.push([{ message: err?.message || 'Failed to send Expo push notification.' }]);
    }
  }

  return {
    sentCount: messages.length,
    ticketCount,
    errors,
  };
}

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

router.post('/register-device', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  const expoPushToken = String(req.body.expoPushToken || '').trim();
  const platform = String(req.body.platform || '').trim().toLowerCase();

  if (!isExpoPushToken(expoPushToken)) {
    return res.status(400).json({ success: false, message: 'Invalid Expo push token.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const email = String(sessionUser.email || '').toLowerCase();
    const loginType = String(sessionUser.loginType || '').toLowerCase();
    const role = String(sessionUser.role || '').toLowerCase();
    const now = new Date();

    await db.collection(NOTIFICATION_DEVICES_COLLECTION).updateOne(
      { expoPushToken },
      {
        $set: {
          expoPushToken,
          email,
          loginType,
          role,
          platform,
          isActive: true,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Push token registered successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to register push token.' });
  }
});

router.post('/unregister-device', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  const expoPushToken = String(req.body.expoPushToken || '').trim();
  if (!isExpoPushToken(expoPushToken)) {
    return res.status(400).json({ success: false, message: 'Invalid Expo push token.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    await db.collection(NOTIFICATION_DEVICES_COLLECTION).updateOne(
      { expoPushToken },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );

    return res.json({ success: true, message: 'Push token unregistered successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to unregister push token.' });
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

    const targetLoginTypes = target === 'both' ? ['resident', 'reception'] : [target];
    const deviceRows = await db.collection(NOTIFICATION_DEVICES_COLLECTION)
      .find({ isActive: true, loginType: { $in: targetLoginTypes } })
      .toArray();

    const uniqueTokens = Array.from(new Set(
      deviceRows
        .map((row) => String(row?.expoPushToken || '').trim())
        .filter((token) => isExpoPushToken(token))
    ));

    const messages = uniqueTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: message,
      data: {
        kind: 'committee-notification',
        target,
        notificationId: String(result.insertedId),
      },
      priority: 'high',
      channelId: 'default',
    }));

    const pushResult = await sendExpoPushNotifications(messages);

    return res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      notification: { id: result.insertedId, ...payload },
      push: {
        targetDevices: uniqueTokens.length,
        sentCount: pushResult.sentCount,
        ticketCount: pushResult.ticketCount,
        errorCount: pushResult.errors.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to create notification.' });
  }
});

module.exports = router;
