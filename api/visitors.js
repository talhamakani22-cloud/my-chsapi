
const { connectDB } = require('../config/database');
const Visitor = require('../models/Visitor');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const normalizeGender = (value = '') => {
  const v = String(value).trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  if (v === 'OTHER' || v === 'O') return 'Other';
  return value;
};


// Connect to MongoDB (ensure connection for all requests)
connectDB();

// GET /api/1001 - Get all visitors
router.get('/', async (req, res) => {
  try {
    const access = getAccessScope(req);
    if (!access.allowed) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const { search = '', startDate, endDate } = req.query;
    const query = {};

    if (access.scope === 'resident') {
      query.houseNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    if (search) {
      query.$or = [
        { cnicId: { $regex: search, $options: 'i' } },
        { fullNameEnglish: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { nationality: { $regex: search, $options: 'i' } },
        { countryOfStay: { $regex: search, $options: 'i' } },
        { houseNumber: { $regex: search, $options: 'i' } },
        { entryTime: { $regex: search, $options: 'i' } },
        { gender: { $regex: search, $options: 'i' } },
        { purposeOfVisit: { $regex: search, $options: 'i' } },
        { remark: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      query.dateOfBirth = {};
      if (startDate) query.dateOfBirth.$gte = startDate;
      if (endDate) query.dateOfBirth.$lte = endDate;
    }

    const visitors = await Visitor.find(query).sort({ createdAt: -1 });
    const scansDir = path.join(uploadsRoot, 'cnic-scans');
    const normalizedVisitors = visitors.map((visitorDoc) => {
      const visitor = typeof visitorDoc?.toObject === 'function' ? visitorDoc.toObject() : visitorDoc;
      const scannedImageUri = String(visitor.scannedImageUri || '').trim();
      const storedFileName = scannedImageUri.split('/').pop() || '';
      const scannedImageAvailable = storedFileName ? fs.existsSync(path.join(scansDir, storedFileName)) : false;
      return {
        ...visitor,
        scannedImageAvailable,
      };
    });
    console.log(`[✅ Fetched ${normalizedVisitors.length} visitors from MongoDB]`);
    res.json({ success: true, visitors: normalizedVisitors });
  } catch (err) {
    console.error('[❌ Get Visitors Error]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch visitors', error: err.message });
  }
});


// Pakistani CNIC format: 12345-1234567-1
const cnicPattern = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;

const uploadDir = path.join(uploadsRoot, 'cnic-scans');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeBase = `cnic-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only PDF or image files are allowed for CNIC scans.'));
  },
});

// POST /api/visitors - Add a new visitor (supports JSON with base64 OR FormData)
router.post('/', upload.single('cnicPdf'), async (req, res) => {
  const requestPayload = req.body || {};
  console.log('[📥 Incoming /api/visitors request body]', {
    cnicId: requestPayload.cnicId,
    fullNameEnglish: requestPayload.fullNameEnglish,
    fatherName: requestPayload.fatherName,
    nationality: requestPayload.nationality,
    countryOfStay: requestPayload.countryOfStay,
    houseNumber: requestPayload.houseNumber,
    entryTime: requestPayload.entryTime,
    dateOfBirth: requestPayload.dateOfBirth,
    gender: requestPayload.gender,
    issueDate: requestPayload.issueDate,
    expiryDate: requestPayload.expiryDate,
    purposeOfVisit: requestPayload.purposeOfVisit,
    remark: requestPayload.remark,
    platform: requestPayload.platform,
    cnicImageName: requestPayload.cnicImageName,
    cnicImageMimeType: requestPayload.cnicImageMimeType,
    cnicImageBase64Preview: requestPayload.cnicImageBase64
      ? String(requestPayload.cnicImageBase64).slice(0, 80)
      : null,
    cnicImageBase64Length: requestPayload.cnicImageBase64
      ? String(requestPayload.cnicImageBase64).length
      : 0,
    uploadedFile: req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          filename: req.file.filename,
        }
      : null,
    timestamp: new Date().toISOString(),
  });

  const {
    cnicId,
    fullNameEnglish,
    fatherName,
    nationality,
    countryOfStay,
    houseNumber,
    entryTime,
    dateOfBirth,
    gender,
    issueDate,
    expiryDate,
    purposeOfVisit,
    remark,
    platform,
    cnicImageBase64,
    cnicImageName,
    cnicImageMimeType
  } = req.body;

  const submittedCnicId = String(cnicId || '').trim();

  const normalizedGender = normalizeGender(gender);

  // CNIC validation
  if (!cnicPattern.test(submittedCnicId)) {
    return res.status(400).json({ success: false, message: 'Invalid CNIC format. Use 12345-1234567-1.' });
  }

  // Required fields validation
  if (!submittedCnicId || !fullNameEnglish || !fatherName || !countryOfStay || !houseNumber || !entryTime || !dateOfBirth || !normalizedGender || !issueDate || !expiryDate || !purposeOfVisit || !remark) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    // Ensure DB connection before save
    if (!Visitor.collection.conn.readyState) {
      console.error('[Visitor Error] Database connection not ready');
      return res.status(500).json({ success: false, message: 'Database connection not ready. Please try again.' });
    }

    let scannedImageUri = null;
    let storedFileName = null;

    // Handle JSON base64 image upload
    if (cnicImageBase64 && !req.file) {
      const normalizedBase64 = String(cnicImageBase64).trim()
        .replace(/^data:image\/[a-z]+;base64,/, '')
        .replace(/^data:[^;]+;base64,/, '');
      
      const imageBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!imageBuffer.length) {
        return res.status(400).json({ success: false, message: 'Uploaded CNIC image is empty.' });
      }

      // Determine file extension
      let fileExt = '.jpg';
      const mimeType = String(cnicImageMimeType || 'image/jpeg').toLowerCase();
      if (mimeType.includes('png')) {
        fileExt = '.png';
      }

      const safeFileName = String(cnicImageName || 'cnic').split('.')[0]
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      
      storedFileName = `cnic-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const filePath = path.join(uploadDir, storedFileName);
      
      fs.writeFileSync(filePath, imageBuffer);
      scannedImageUri = `/uploads/cnic-scans/${storedFileName}`;
    } else if (req.file) {
      // Handle FormData file upload
      scannedImageUri = `/uploads/cnic-scans/${req.file.filename}`;
      storedFileName = req.file.filename;
    }

    const visitor = new Visitor({
      cnicId: submittedCnicId,
      fullNameEnglish,
      fatherName,
      nationality: countryOfStay || nationality,
      countryOfStay: countryOfStay || nationality,
      houseNumber,
      entryTime,
      dateOfBirth,
      gender: normalizedGender,
      issueDate,
      expiryDate,
      purposeOfVisit,
      remark,
      scannedImageUri,
      platform: platform || 'expo'
    });
    
    await visitor.save();
    
    console.log('[✅ Visitor Added to MongoDB]', {
      id: visitor._id,
      cnicId: visitor.cnicId,
      fullNameEnglish: visitor.fullNameEnglish,
      nationality: visitor.nationality,
      dateOfBirth: visitor.dateOfBirth,
      gender: visitor.gender,
      purposeOfVisit: visitor.purposeOfVisit,
      remark: visitor.remark,
      platform: visitor.platform,
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Visitor added successfully',
      visitor: {
        _id: visitor._id,
        cnicId: visitor.cnicId,
        fullNameEnglish: visitor.fullNameEnglish,
        fatherName: visitor.fatherName,
        nationality: visitor.nationality,
        countryOfStay: visitor.countryOfStay,
        houseNumber: visitor.houseNumber,
        entryTime: visitor.entryTime,
        dateOfBirth: visitor.dateOfBirth,
        gender: visitor.gender,
        issueDate: visitor.issueDate,
        expiryDate: visitor.expiryDate,
        purposeOfVisit: visitor.purposeOfVisit,
        remark: visitor.remark,
        scannedImageUri: visitor.scannedImageUri,
        platform: visitor.platform,
        createdAt: visitor.createdAt
      }
    });
  } catch (err) {
    console.error('[❌ Visitor Save Error]', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(400).json({ 
      success: false, 
      message: err.message || 'Failed to save visitor',
      error: err.message 
    });
  }
});

module.exports = router;
