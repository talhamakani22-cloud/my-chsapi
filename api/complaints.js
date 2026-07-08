const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');

const router = express.Router();
const COMPLAINTS_COLLECTION = 'complaints';

const uploadDir = path.join(__dirname, '..', 'uploads', 'complaints');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.webm', '.m4v', '.3gp', '.mkv'].includes(ext) ? ext : '.jpg';
    cb(null, `complaint-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-matroska',
      'video/3gpp',
      'video/3gpp2',
      'video/mpeg',
    ];
    if (allowedMimes.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only image or video files are allowed for complaints.'));
  },
});

function canUseComplaints(req) {
  const loginType = String(req?.session?.user?.loginType || '').toLowerCase();
  return loginType === 'resident' || loginType === 'committee' || loginType === 'reception';
}

function canManageComplaints(req) {
  const loginType = String(req?.session?.user?.loginType || '').toLowerCase();
  return loginType === 'reception';
}

router.get('/', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canUseComplaints(req)) {
    return res.status(403).json({ success: false, message: 'Complaints are available for resident, reception, and committee only.' });
  }

  try {
    const access = getAccessScope(req);
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const status = String(req.query.status || '').trim();
    const search = String(req.query.q || '').trim();
    const requestedLimit = Number.parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 1000)) : 500;

    const query = { isActive: { $ne: false } };
    if (access.scope === 'resident') {
      query.flatNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [
        { ticketNo: regex },
        { flatNumber: regex },
        { complaintType: regex },
        { description: regex },
        { status: regex },
        { statusNote: regex },
        { 'sender.email': regex },
      ];
    }

    const rows = await db.collection(COMPLAINTS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return res.json({ success: true, rows, canManage: canManageComplaints(req) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch complaints.' });
  }
});

router.post('/', upload.single('complaintMedia'), async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (String(sessionUser.loginType || '').toLowerCase() !== 'resident') {
    return res.status(403).json({ success: false, message: 'Only residents can create complaints.' });
  }

  const description = String(req.body.description || '').trim();
  const complaintType = String(req.body.complaintType || '').trim();

  if (!description) {
    return res.status(400).json({ success: false, message: 'Complaint description is required.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a picture or video.' });
  }

  try {
    const access = getAccessScope(req);
    if (!access.allowed || access.scope !== 'resident') {
      return res.status(403).json({ success: false, message: 'Only resident users can submit complaints.' });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const ticketNo = `CMP-${Date.now()}`;
    const mediaUri = `/uploads/complaints/${req.file.filename}`;
    const mediaKind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const payload = {
      ticketNo,
      complaintType,
      description,
      mediaUri,
      mediaMimeType: req.file.mimetype,
      mediaKind,
      flatNumber: access.flatNumber || '',
      status: 'Open',
      statusNote: 'Complaint received',
      isActive: true,
      sender: {
        email: String(sessionUser.email || '').toLowerCase(),
        role: String(sessionUser.role || '').toLowerCase(),
        loginType: String(sessionUser.loginType || '').toLowerCase(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COMPLAINTS_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      row: { id: result.insertedId, ...payload },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to create complaint.' });
  }
});

router.put('/:id/status', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canManageComplaints(req)) {
    return res.status(403).json({ success: false, message: 'Only reception desk can update complaint status.' });
  }

  const complaintId = String(req.params.id || '').trim();
  if (!complaintId || !mongoose.Types.ObjectId.isValid(complaintId)) {
    return res.status(400).json({ success: false, message: 'Invalid complaint id.' });
  }

  const status = String(req.body.status || '').trim();
  const statusNote = String(req.body.statusNote || '').trim();

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const result = await db.collection(COMPLAINTS_COLLECTION).findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(complaintId),
        isActive: { $ne: false },
      },
      {
        $set: {
          status,
          statusNote,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    const row = result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result;

    if (!row) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    return res.json({ success: true, message: 'Complaint status updated successfully.', row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update complaint status.' });
  }
});

module.exports = router;