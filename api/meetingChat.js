const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const MEETING_CHAT_COLLECTION = 'meeting_chat';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'meeting-chat-audio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.m4a';
    const safeExt = ['.m4a', '.mp3', '.mp4', '.aac', '.wav', '.ogg', '.webm', '.3gp', '.amr'].includes(ext) ? ext : '.m4a';
    cb(null, `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/wav',
      'audio/x-wav',
      'audio/webm',
      'audio/ogg',
      'audio/3gpp',
      'audio/amr',
    ];
    if (allowedMimes.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only audio files are allowed for voice messages.'));
  },
});

function getLoginType(req) {
  return String(req?.session?.user?.loginType || '').toLowerCase();
}

function isMeetingChatAllowed(req) {
  const loginType = getLoginType(req);
  return loginType === 'resident' || loginType === 'committee';
}

router.get('/', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!isMeetingChatAllowed(req)) {
    return res.status(403).json({ success: false, message: 'Meeting chat is available for resident and committee only.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const rows = await db.collection(MEETING_CHAT_COLLECTION)
      .find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();

    const normalizedRows = rows.map((row) => {
      const audioUri = String(row?.audioUri || '').trim();
      const storedFileName = audioUri.split('/').pop() || '';
      const audioAvailable = storedFileName ? fs.existsSync(path.join(uploadDir, storedFileName)) : false;
      return {
        ...row,
        audioAvailable,
      };
    });

    return res.json({ success: true, rows: normalizedRows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch meeting chat.' });
  }
});

router.post('/', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!isMeetingChatAllowed(req)) {
    return res.status(403).json({ success: false, message: 'Meeting chat is available for resident and committee only.' });
  }

  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const payload = {
      messageType: 'text',
      message,
      isActive: true,
      sender: {
        email: String(sessionUser.email || '').toLowerCase(),
        role: String(sessionUser.role || '').toLowerCase(),
        loginType: String(sessionUser.loginType || '').toLowerCase(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(MEETING_CHAT_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      row: { id: result.insertedId, ...payload },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to send chat message.' });
  }
});

router.post('/audio', uploadAudio.single('voiceMessage'), async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!isMeetingChatAllowed(req)) {
    return res.status(403).json({ success: false, message: 'Meeting chat is available for resident and committee only.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Voice message file is required.' });
  }

  const durationMs = Number(req.body.durationMs || 0);

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const payload = {
      messageType: 'audio',
      message: '',
      audioUri: `/uploads/meeting-chat-audio/${req.file.filename}`,
      audioMimeType: req.file.mimetype,
      audioDurationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
      isActive: true,
      sender: {
        email: String(sessionUser.email || '').toLowerCase(),
        role: String(sessionUser.role || '').toLowerCase(),
        loginType: String(sessionUser.loginType || '').toLowerCase(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(MEETING_CHAT_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      row: { id: result.insertedId, ...payload },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to send voice message.' });
  }
});

module.exports = router;
