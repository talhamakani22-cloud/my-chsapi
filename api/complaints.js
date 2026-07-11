const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');

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
const COMPLAINTS_COLLECTION = 'complaints';
const TICKET_COUNTERS_COLLECTION = 'complaint_ticket_counters';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'complaints');
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

function normalizeLoginType(value = '') {
  return String(value || '').toLowerCase().trim().replace(/[-_\s]+/g, '');
}

function isCommitteeLogin(loginType = '') {
  const normalized = normalizeLoginType(loginType);
  return normalized === 'committee' || normalized === 'committeehead';
}

function canUseComplaints(req) {
  const loginType = normalizeLoginType(req?.session?.user?.loginType || '');
  return loginType === 'resident' || isCommitteeLogin(loginType) || loginType === 'reception' || loginType === 'receptiondesk';
}

function canManageComplaints(req) {
  const loginType = normalizeLoginType(req?.session?.user?.loginType || '');
  return loginType === 'reception' || loginType === 'receptiondesk';
}

function canCreateComplaints(req) {
  const loginType = normalizeLoginType(req?.session?.user?.loginType || '');
  return loginType === 'resident';
}

const STATUS_FLOW = ['Registered', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

function normalizeStatus(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'open') return 'Registered';
  if (raw === 'inprogress' || raw === 'in-progress' || raw === 'in progress') return 'In Progress';
  if (raw === 'underreview' || raw === 'under-review' || raw === 'under review') return 'Under Review';
  const hit = STATUS_FLOW.find((item) => item.toLowerCase() === raw);
  return hit || '';
}

function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function getReturnedDoc(result) {
  if (!result) return null;
  if (typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'value')) {
    return result.value;
  }
  return result;
}

async function generateTicketNo(db) {
  const now = new Date();
  const dateKey = formatDateKey(now);
  const updateResult = await db.collection(TICKET_COUNTERS_COLLECTION).findOneAndUpdate(
    { dateKey },
    {
      $inc: { sequence: 1 },
      $setOnInsert: { dateKey, createdAt: now },
      $set: { updatedAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );
  const counterDoc = getReturnedDoc(updateResult);
  const sequence = Number(counterDoc?.sequence || 1);
  return `CMP-${dateKey}-${String(sequence).padStart(5, '0')}`;
}

function inferLocationLabel(locationCode = '') {
  const code = String(locationCode || '').trim().toUpperCase();
  if (!code) return '';
  const reception = code.match(/^REC(\d{1,3})$/i);
  if (reception) {
    return `Reception ${String(reception[1]).padStart(2, '0')}`;
  }
  return code;
}

function serializeComplaintForTracking(row) {
  if (!row) return null;
  return {
    ticketNo: row.ticketNo || '',
    flatNumber: row.flatNumber || '',
    locationCode: row.locationCode || '',
    locationLabel: row.locationLabel || inferLocationLabel(row.locationCode),
    complaintType: row.complaintType || '',
    description: row.description || '',
    status: row.status || 'Registered',
    assignedTo: row.assignedTo || '',
    statusNote: row.statusNote || '',
    residentResolutionRequested: Boolean(row.residentResolutionRequested),
    residentResolutionMessage: row.residentResolutionMessage || '',
    residentResolutionAt: row.residentResolutionAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || row.createdAt || null,
  };
}

function parseOptionalBase64Upload(req) {
  const complaintMediaBase64 = String(req.body.complaintMediaBase64 || '').trim();
  const complaintMediaName = String(req.body.complaintMediaName || 'complaint-media.jpg').trim();
  const complaintMediaMimeType = String(req.body.complaintMediaMimeType || 'image/jpeg').trim();

  if (!complaintMediaBase64) {
    return { mediaUri: '', mediaKind: 'image', storedMimeType: '', storedFileName: '' };
  }

  const normalizedBase64 = complaintMediaBase64
    .replace(/^data:image\/[a-z]+;base64,/, '')
    .replace(/^data:video\/[a-z]+;base64,/, '')
    .replace(/^data:[^;]+;base64,/, '');

  const mediaBuffer = Buffer.from(normalizedBase64, 'base64');
  if (!mediaBuffer.length) {
    throw new Error('Uploaded media file is empty.');
  }

  let fileExt = '.jpg';
  const mimeType = complaintMediaMimeType.toLowerCase();
  let mediaKind = 'image';
  if (mimeType.includes('png')) {
    fileExt = '.png';
  } else if (mimeType.includes('video')) {
    fileExt = '.mp4';
    mediaKind = 'video';
  }

  const safeFileName = String(complaintMediaName || 'complaint').split('.')[0]
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
  const storedFileName = `complaint-${Date.now()}-${safeFileName}-${Math.round(Math.random() * 1e9)}${fileExt}`;
  const filePath = path.join(uploadDir, storedFileName);
  fs.writeFileSync(filePath, mediaBuffer);

  return {
    mediaUri: `/uploads/complaints/${storedFileName}`,
    mediaKind,
    storedMimeType: complaintMediaMimeType,
    storedFileName,
  };
}

function normalizePakistanPhone(raw = '') {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function isValidPakistanPhone(raw = '') {
  const digits = String(raw || '').replace(/\D/g, '');
  return /^03\d{9}$/.test(digits);
}

function normalizeFlatNumber(raw = '') {
  const cleaned = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  const noMultiHyphen = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  const match = noMultiHyphen.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return noMultiHyphen;
}

function isValidFlatNumber(raw = '') {
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(String(raw || ''));
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

    const status = normalizeStatus(req.query.status || '');
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
        { locationCode: regex },
        { locationLabel: regex },
        { complaintType: regex },
        { description: regex },
        { status: regex },
        { statusNote: regex },
        { residentResolutionMessage: regex },
        { 'sender.email': regex },
        { 'sender.name': regex },
        { 'sender.phone': regex },
      ];
    }

    const rows = await db.collection(COMPLAINTS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const normalizedRows = rows.map((row) => {
      const mediaUri = String(row?.mediaUri || '');
      const isAbsoluteMediaUrl = /^https?:\/\//i.test(mediaUri);
      const mediaFileName = mediaUri.split('/').pop() || '';
      const mediaExists = isAbsoluteMediaUrl || (mediaFileName ? fs.existsSync(path.join(uploadDir, mediaFileName)) : false);
      return {
        ...row,
        mediaAvailable: mediaUri ? mediaExists : false,
      };
    });

    return res.json({ success: true, rows: normalizedRows, canManage: canManageComplaints(req) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch complaints.' });
  }
});

router.post('/', upload.single('complaintMedia'), async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canCreateComplaints(req)) {
    return res.status(403).json({ success: false, message: 'Committee head can only view complaints. Only residents can create complaints.' });
  }

  const description = String(req.body.description || '').trim();
  const complaintType = String(req.body.complaintType || '').trim();
  if (!description) {
    return res.status(400).json({ success: false, message: 'Complaint description is required.' });
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

    const ticketNo = await generateTicketNo(db);
    let mediaUri = '';
    let mediaKind = 'image';
    let storedMimeType = '';

    if (req.file) {
      mediaUri = `/uploads/complaints/${req.file.filename}`;
      storedMimeType = req.file.mimetype;
      mediaKind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    } else {
      const uploaded = parseOptionalBase64Upload(req);
      mediaUri = uploaded.mediaUri;
      mediaKind = uploaded.mediaKind;
      storedMimeType = uploaded.storedMimeType;
    }

    const normalizedCategory = complaintType || 'General';

    const payload = {
      ticketNo,
      complaintType: normalizedCategory,
      description,
      mediaUri,
      mediaAvailable: Boolean(mediaUri),
      mediaMimeType: storedMimeType,
      mediaKind,
      flatNumber: access.flatNumber || '',
      locationCode: '',
      locationLabel: '',
      status: 'Registered',
      statusNote: 'Complaint registered',
      assignedTo: '',
      isActive: true,
      sender: {
        email: String(sessionUser.email || '').toLowerCase(),
        role: String(sessionUser.role || '').toLowerCase(),
        loginType: String(sessionUser.loginType || '').toLowerCase(),
        name: '',
        phone: '',
      },
      source: 'app',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COMPLAINTS_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      row: { id: result.insertedId, ...payload },
      ticketNo: payload.ticketNo,
    });
  } catch (err) {
    console.error('[❌ Complaint Creation Error]', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, message: err.message || 'Failed to create complaint.' });
  }
});

router.post('/register', upload.single('complaintMedia'), async (req, res) => {
  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const description = String(req.body.description || '').trim();
    const complaintType = String(req.body.complaintType || req.body.category || '').trim();
    const name = String(req.body.name || '').trim();
    const phone = normalizePakistanPhone(req.body.phone || '');
    const flatNumber = normalizeFlatNumber(req.body.flatNumber || '');
    const locationCode = String(req.body.loc || req.body.locationCode || '').trim().toUpperCase();
    const locationLabel = String(req.body.locationLabel || '').trim() || inferLocationLabel(locationCode);

    const complaintMediaBase64 = String(req.body.complaintMediaBase64 || '').trim();

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    if (!isValidPakistanPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be in Pakistan format (03XXXXXXXXX).' });
    }

    if (!complaintType) {
      return res.status(400).json({ success: false, message: 'Complaint category is required.' });
    }

    if (!description || description.length < 10) {
      return res.status(400).json({ success: false, message: 'Complaint description must be at least 10 characters.' });
    }

    if (!flatNumber || !isValidFlatNumber(flatNumber)) {
      return res.status(400).json({ success: false, message: 'Valid flat number is required (example: A-12).' });
    }

    if (!req.file && !complaintMediaBase64) {
      return res.status(400).json({ success: false, message: 'Picture is required.' });
    }

    if (req.file && !String(req.file.mimetype || '').toLowerCase().startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Only picture upload is allowed.' });
    }

    const base64MimeType = String(req.body.complaintMediaMimeType || '').toLowerCase();
    if (!req.file && complaintMediaBase64 && base64MimeType && !base64MimeType.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Only picture upload is allowed.' });
    }

    let mediaUri = '';
    let mediaKind = 'image';
    let storedMimeType = '';

    if (req.file) {
      mediaUri = `/uploads/complaints/${req.file.filename}`;
      storedMimeType = req.file.mimetype;
      mediaKind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    } else {
      const uploaded = parseOptionalBase64Upload(req);
      mediaUri = uploaded.mediaUri;
      mediaKind = uploaded.mediaKind;
      storedMimeType = uploaded.storedMimeType;
    }

    const ticketNo = await generateTicketNo(db);

    const payload = {
      ticketNo,
      complaintType,
      description,
      mediaUri,
      mediaAvailable: Boolean(mediaUri),
      mediaMimeType: storedMimeType,
      mediaKind,
      flatNumber,
      locationCode,
      locationLabel,
      status: 'Registered',
      statusNote: 'Complaint registered',
      assignedTo: '',
      isActive: true,
      sender: {
        email: '',
        role: 'guest',
        loginType: 'anonymous',
        name,
        phone,
      },
      source: 'qr',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(COMPLAINTS_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      row: { id: result.insertedId, ...payload },
      ticketNo,
      message: 'Your complaint has been registered successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to register complaint.' });
  }
});

router.get('/track/:ticketNo', async (req, res) => {
  const ticketNo = String(req.params.ticketNo || '').trim().toUpperCase();
  if (!ticketNo) {
    return res.status(400).json({ success: false, message: 'Ticket number is required.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const row = await db.collection(COMPLAINTS_COLLECTION).findOne({
      ticketNo,
      isActive: { $ne: false },
    });

    if (!row) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    return res.json({ success: true, complaint: serializeComplaintForTracking(row) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to track complaint.' });
  }
});

router.post('/track/:ticketNo/resolve-message', async (req, res) => {
  const ticketNo = String(req.params.ticketNo || '').trim().toUpperCase();
  if (!ticketNo) {
    return res.status(400).json({ success: false, message: 'Ticket number is required.' });
  }

  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ success: false, message: 'Please enter a message for admin.' });
  }

  if (message.length < 5) {
    return res.status(400).json({ success: false, message: 'Message must be at least 5 characters.' });
  }

  if (message.length > 500) {
    return res.status(400).json({ success: false, message: 'Message is too long (max 500 characters).' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const now = new Date();
    const result = await db.collection(COMPLAINTS_COLLECTION).findOneAndUpdate(
      {
        ticketNo,
        isActive: { $ne: false },
      },
      {
        $set: {
          residentResolutionRequested: true,
          residentResolutionMessage: message,
          residentResolutionAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    const row = getReturnedDoc(result);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    return res.json({
      success: true,
      message: 'Your resolution message has been sent to admin.',
      complaint: serializeComplaintForTracking(row),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to send message.' });
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

  const status = normalizeStatus(req.body.status || '');
  const statusNote = String(req.body.statusNote || '').trim();
  const assignedTo = String(req.body.assignedTo || '').trim();

  if (!status) {
    return res.status(400).json({ success: false, message: `Status is required. Allowed values: ${STATUS_FLOW.join(', ')}` });
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
          assignedTo,
          isActive: true,
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