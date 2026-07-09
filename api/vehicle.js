const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');

const router = express.Router();
const VEHICLE_COLLECTION = 'vehicle_registration';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'vehicle-cards');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || 'vehicle-card.pdf', path.extname(file.originalname || '.pdf'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase || 'vehicle-card'}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = path.extname(file.originalname || '').toLowerCase() === '.pdf';
    if (!isPdfMime && !isPdfExt) {
      return cb(new Error('Only PDF files are allowed.'));
    }
    return cb(null, true);
  },
});

router.get('/', async (req, res) => {
  try {
    const access = getAccessScope(req);
    if (!access.allowed) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const search = String(req.query.search || '').trim();
    const query = {};

    if (access.scope === 'resident') {
      query.flatNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    if (search) {
      query.$or = [
        { ownerName: { $regex: search, $options: 'i' } },
        { ownerCnic: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
        { vehicleNumber: { $regex: search, $options: 'i' } },
        { vehicleType: { $regex: search, $options: 'i' } },
      ];
    }

    const records = await db
      .collection(VEHICLE_COLLECTION)
      .find(query)
      .sort({ uploadedAt: -1 })
      .limit(500)
      .toArray();

    const normalized = records.map((record) => {
      const filePath = String(record.filePath || '');
      const storedFileName = String(record.storedFileName || filePath.split('/').pop() || '').trim();
      const fileAvailable = storedFileName ? fs.existsSync(path.join(uploadDir, storedFileName)) : false;
      const runtimeFileUrl = filePath ? `${req.protocol}://${req.get('host')}${filePath}` : '';
      return {
        ...record,
        fileAvailable,
        fileUrl: runtimeFileUrl || record.fileUrl || '',
      };
    });

    return res.json({ success: true, records: normalized });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch vehicle records.' });
  }
});

router.post('/upload-card-pdf', upload.single('cardPdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No vehicle card PDF uploaded.' });
  }

  const ownerName = String(req.body.ownerName || '').trim();
  const ownerCnic = String(req.body.ownerCnic || '').trim();
  const flatNumber = String(req.body.flatNumber || '').trim();
  const vehicleType = String(req.body.vehicleType || '').trim();
  const vehicleNumber = String(req.body.vehicleNumber || '').trim().toUpperCase();
  const address = String(req.body.address || '').trim();
  const registrationDate = String(req.body.registrationDate || '').trim();

  if (!ownerName || !flatNumber || !vehicleType || !vehicleNumber) {
    return res.status(400).json({
      success: false,
      message: 'Owner name, flat number, vehicle type, and vehicle number are required.',
    });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const relativePath = `/uploads/vehicle-cards/${req.file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

    const payload = {
      ownerName,
      ownerCnic,
      flatNumber,
      vehicleType,
      vehicleNumber,
      address,
      registrationDate,
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: relativePath,
      fileUrl: absoluteUrl,
      uploadedAt: new Date(),
    };

    const result = await db.collection(VEHICLE_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      message: 'Vehicle registration saved successfully.',
      record: {
        id: result.insertedId,
        ...payload,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Vehicle save failed.' });
  }
});

// New endpoint: Upload vehicle card image as JSON with base64
router.post('/upload-card-image', async (req, res) => {
  try {
    const ownerCnic = String(req.body.ownerCnic || '').trim();
    const flatNumber = String(req.body.flatNumber || '').trim();
    const vehicleType = String(req.body.vehicleType || '').trim();
    const vehicleNumber = String(req.body.vehicleNumber || '').trim().toUpperCase();
    const address = String(req.body.address || '').trim();
    const registrationDate = String(req.body.registrationDate || '').trim();
    const cardImageBase64 = String(req.body.cardImageBase64 || '').trim();
    const cardImageName = String(req.body.cardImageName || 'vehicle-card.jpg').trim();
    const cardImageMimeType = String(req.body.cardImageMimeType || 'image/jpeg').trim();

    if (!ownerCnic || !flatNumber || !vehicleType || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Owner CNIC, flat number, vehicle type, and vehicle number are required.',
      });
    }

    if (!cardImageBase64) {
      return res.status(400).json({
        success: false,
        message: 'cardImageBase64 is required.',
      });
    }

    // Validate image mime type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(cardImageMimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG/PNG images are allowed.',
      });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(cardImageBase64, 'base64');
    const fileSize = imageBuffer.length;

    // Validate file size (max 15MB)
    if (fileSize > 15 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds maximum limit of 15MB.',
      });
    }

    // Determine file extension
    let fileExt = '.jpg';
    if (cardImageMimeType === 'image/png') {
      fileExt = '.png';
    } else if (cardImageName.endsWith('.png')) {
      fileExt = '.png';
    }

    // Create filename with timestamp
    const safeFileName = path
      .basename(cardImageName, path.extname(cardImageName))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const storedFileName = `${Date.now()}-${safeFileName || 'vehicle-card'}${fileExt}`;

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write file to disk
    const filePath = path.join(uploadDir, storedFileName);
    fs.writeFileSync(filePath, imageBuffer);

    const relativePath = `/uploads/vehicle-cards/${storedFileName}`;

    const payload = {
      ownerCnic,
      flatNumber,
      vehicleType,
      vehicleNumber,
      address,
      registrationDate,
      fileName: cardImageName,
      storedFileName,
      mimeType: cardImageMimeType,
      size: fileSize,
      filePath: relativePath,
      uploadedAt: new Date(),
    };

    const result = await db.collection(VEHICLE_COLLECTION).insertOne(payload);

    console.log(`[✅ Vehicle Card Image Uploaded to MongoDB] at ${new Date().toISOString()}`);

    return res.status(201).json({
      success: true,
      message: 'Vehicle registration saved successfully.',
      record: {
        _id: result.insertedId,
        ownerCnic,
        flatNumber,
        vehicleType,
        vehicleNumber,
        address,
        registrationDate,
        cardUri: relativePath,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(`[❌ Vehicle Card Image Save Error] ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.message || 'Vehicle registration save failed.',
    });
  }
});

module.exports = router;
