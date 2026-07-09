const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const router = express.Router();
const COMPLAINTS_COLLECTION = 'complaints';
const ANONYMOUS_COMPLAINTS_COLLECTION = 'anonymous_complaints';
const FAMILY_COLLECTION = 'family_detail';

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
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `complaint-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only JPG, PNG images or MP4, MOV videos are allowed.'));
  },
});

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Helper: Get flat owner name from family collection
async function getFlatOwnerName(flatNumber) {
  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) return null;

    const family = await db
      .collection(FAMILY_COLLECTION)
      .findOne({ flatNumber: String(flatNumber).trim() });

    return family ? family.residentName : null;
  } catch (err) {
    console.error('[Error] Failed to fetch flat owner:', err.message);
    return null;
  }
}

// Helper: Generate unique ticket number
function generateTicketNumber() {
  return `ANON-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// Helper: Generate verification token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Send email with verification link
async function sendComplaintEmail(email, ticketNo, verificationToken, flatNumber, complaintType) {
  const verificationLink = `${process.env.APP_URL || 'https://app.com'}/complaints/anonymous/check?ticket=${ticketNo}&token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Complaint Registered - Ticket #${ticketNo}`,
    html: `
      <h2>Complaint Registered Successfully</h2>
      <p>Your complaint has been registered. Here are the details:</p>
      <ul>
        <li><strong>Ticket Number:</strong> ${ticketNo}</li>
        <li><strong>Flat Number:</strong> ${flatNumber}</li>
        <li><strong>Complaint Type:</strong> ${complaintType}</li>
        <li><strong>Registered At:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p>Click the link below to check your complaint status:</p>
      <p><a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Check Complaint Status
      </a></p>
      <p>This link will expire in 7 days. Bookmark this page or save your ticket number for future reference.</p>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`[✅ Complaint Email Sent] Ticket: ${ticketNo}, To: ${email}`);
    return true;
  } catch (err) {
    console.error(`[❌ Email Send Error] ${err.message}`);
    return false;
  }
}

// POST /api/anonymous-complaints - Register anonymous complaint
router.post('/', upload.single('complaintMedia'), async (req, res) => {
  const flatNumber = String(req.body.flatNumber || '').trim();
  const description = String(req.body.description || '').trim();
  const complaintType = String(req.body.complaintType || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();

  // Validation
  if (!flatNumber) {
    return res.status(400).json({ success: false, message: 'Flat number is required.' });
  }

  if (!description) {
    return res.status(400).json({ success: false, message: 'Complaint description is required.' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Valid email address is required.' });
  }

  if (!phone || !/^[0-9+\-() ]{7,20}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a complaint image or video.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    // Get flat owner name
    const ownerName = await getFlatOwnerName(flatNumber);
    if (!ownerName) {
      return res.status(404).json({ success: false, message: 'Flat number not found. Please enter a valid flat number.' });
    }

    // Generate ticket and token
    const ticketNo = generateTicketNumber();
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const mediaUri = `/uploads/complaints/${req.file.filename}`;
    const mediaKind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Save anonymous complaint
    const payload = {
      ticketNo,
      flatNumber,
      ownerName,
      complaintType,
      description,
      mediaUri,
      mediaAvailable: true,
      mediaMimeType: req.file.mimetype,
      mediaKind,
      status: 'Open',
      statusNote: 'Anonymous complaint received',
      isAnonymous: true,
      email,
      phone,
      verificationToken,
      verificationTokenExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection(ANONYMOUS_COMPLAINTS_COLLECTION).insertOne(payload);

    console.log('[✅ Anonymous Complaint Registered]', {
      ticketNo: payload.ticketNo,
      flatNumber: payload.flatNumber,
      email: payload.email,
      timestamp: new Date().toISOString(),
    });

    // Send verification email
    const emailSent = await sendComplaintEmail(email, ticketNo, verificationToken, flatNumber, complaintType);

    res.status(201).json({
      success: true,
      message: 'Complaint registered successfully. Check your email for status updates.',
      ticket: {
        ticketNo,
        flatNumber,
        ownerName,
        complaintType,
        status: 'Open',
        createdAt: new Date().toISOString(),
        emailVerificationSent: emailSent,
      },
    });
  } catch (err) {
    console.error('[❌ Anonymous Complaint Error]', {
      error: err.message,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to register complaint.',
    });
  }
});

// GET /api/anonymous-complaints/:ticketNo/status - Check complaint status
router.get('/:ticketNo/status', async (req, res) => {
  const ticketNo = String(req.params.ticketNo || '').trim();
  const token = String(req.query.token || '').trim();

  if (!ticketNo) {
    return res.status(400).json({ success: false, message: 'Ticket number is required.' });
  }

  if (!token) {
    return res.status(400).json({ success: false, message: 'Verification token is required.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    // Find complaint and verify token
    const complaint = await db.collection(ANONYMOUS_COMPLAINTS_COLLECTION).findOne({
      ticketNo,
      verificationToken: token,
    });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found or invalid verification token.' });
    }

    // Check token expiry
    if (new Date() > new Date(complaint.verificationTokenExpiry)) {
      return res.status(401).json({ success: false, message: 'Verification token has expired. Please contact support.' });
    }

    // Return complaint status
    res.json({
      success: true,
      complaint: {
        ticketNo: complaint.ticketNo,
        flatNumber: complaint.flatNumber,
        ownerName: complaint.ownerName,
        complaintType: complaint.complaintType,
        description: complaint.description,
        status: complaint.status,
        statusNote: complaint.statusNote,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
        mediaAvailable: complaint.mediaAvailable,
        mediaKind: complaint.mediaKind,
      },
    });
  } catch (err) {
    console.error('[❌ Complaint Status Check Error]', {
      error: err.message,
      ticketNo,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch complaint status.',
    });
  }
});

// GET /api/anonymous-complaints - Get all anonymous complaints (admin only)
router.get('/', async (req, res) => {
  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const search = String(req.query.search || '').trim();
    const query = { isAnonymous: true };

    if (search) {
      query.$or = [
        { ticketNo: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { complaintType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const complaints = await db
      .collection(ANONYMOUS_COMPLAINTS_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch complaints.' });
  }
});

module.exports = router;
