const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
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
const FAMILY_COLLECTION = 'family_detail';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'cnic-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || 'cnic.jpg', path.extname(file.originalname || '.jpg'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const ext = path.extname(file.originalname || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${safeBase || 'cnic'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isImageMime = ['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
    const isImageExt = ['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname || '').toLowerCase());
    if (!isImageMime && !isImageExt) {
      return cb(new Error('Only JPG and PNG image files are allowed.'));
    }
    return cb(null, true);
  },
});

const FAMILY_MEMBER_LIMIT = 15;

const normalizeCnicKey = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 13 ? digits : '';
};

const hasDuplicateCnic = (members = []) => {
  const seen = new Set();
  for (const member of members) {
    const key = normalizeCnicKey(member.cnic);
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};

const normalizeFamilyMember = (member = {}) => ({
  memberName: String(member.memberName || member.name || member.member || '').trim(),
  relation: String(member.relation || '').trim(),
  cnic: String(member.cnic || '').trim(),
  phone: String(member.phone || '').trim(),
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
        { residentName: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
      ];
    }

    const records = await db
      .collection(FAMILY_COLLECTION)
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
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch family records.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const access = getAccessScope(req);
    if (!access.allowed) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const recordId = String(req.params.id || '').trim();
    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return res.status(400).json({ success: false, message: 'Invalid record id.' });
    }

    const residentName = String(req.body.residentName || '').trim();
    const flatNumber = String(req.body.flatNumber || '').trim();
    let familyMembers = Array.isArray(req.body.familyMembers) ? req.body.familyMembers : [];

    if (typeof req.body.familyMembers === 'string') {
      try {
        const parsed = JSON.parse(req.body.familyMembers);
        if (Array.isArray(parsed)) {
          familyMembers = parsed;
        }
      } catch {
        familyMembers = [];
      }
    }

    if (!residentName || !flatNumber) {
      return res.status(400).json({ success: false, message: 'Resident name and flat number are required.' });
    }

    const sanitizedMembers = familyMembers
      .map(normalizeFamilyMember)
      .filter((member) => member.memberName || member.relation || member.cnic || member.phone);

    if (sanitizedMembers.length > FAMILY_MEMBER_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${FAMILY_MEMBER_LIMIT} family members are allowed per flat.`,
      });
    }

    if (hasDuplicateCnic(sanitizedMembers)) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate CNIC is not allowed. Please edit the existing member instead.',
      });
    }

    const selector = { _id: new mongoose.Types.ObjectId(recordId) };
    if (access.scope === 'resident') {
      selector.flatNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    const updateResult = await db.collection(FAMILY_COLLECTION).updateOne(
      selector,
      {
        $set: {
          residentName,
          flatNumber,
          familyMembers: sanitizedMembers,
          updatedAt: new Date(),
        },
      },
    );

    if (!updateResult.matchedCount) {
      return res.status(404).json({ success: false, message: 'Family record not found.' });
    }

    const updatedRecord = await db.collection(FAMILY_COLLECTION).findOne(selector);

    return res.json({ success: true, message: 'Family details updated successfully.', record: updatedRecord || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update family record.' });
  }
});

router.post('/upload-cnic-image', upload.single('cnicImage'), async (req, res) => {
  const cnicImageBase64 = String(req.body.cnicImageBase64 || '').trim();
  const cnicImageName = String(req.body.cnicImageName || 'CNIC.jpg').trim() || 'CNIC.jpg';
  const cnicImageMimeType = String(req.body.cnicImageMimeType || 'image/jpeg').trim() || 'image/jpeg';

  if (!req.file && !cnicImageBase64) {
    return res.status(400).json({ success: false, message: 'No CNIC image uploaded.' });
  }

  const residentName = String(req.body.residentName || '').trim();
  const flatNumber = String(req.body.flatNumber || '').trim();
  const familyMembersRaw = String(req.body.familyMembers || '[]');

  if (!residentName || !flatNumber) {
    return res.status(400).json({
      success: false,
      message: 'Resident name and flat number are required for CNIC upload.',
    });
  }

  let familyMembers = [];
  try {
    familyMembers = JSON.parse(familyMembersRaw);
    if (!Array.isArray(familyMembers)) {
      familyMembers = [];
    }
  } catch {
    familyMembers = [];
  }

  const safeBase = path
    .basename(cnicImageName, path.extname(cnicImageName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
  const ext = path.extname(cnicImageName).toLowerCase() || '.jpg';
  const storedFileName = req.file?.filename || `${Date.now()}-${safeBase || 'cnic'}${ext}`;
  const relativePath = `/uploads/cnic-images/${storedFileName}`;
  const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    if (!req.file) {
      const normalizedBase64 = cnicImageBase64.replace(/^data:image\/[a-z]+;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!fileBuffer.length) {
        return res.status(400).json({ success: false, message: 'Uploaded CNIC image is empty.' });
      }

      fs.writeFileSync(path.join(uploadDir, storedFileName), fileBuffer);
    }

    const payload = {
      residentName,
      flatNumber,
      familyMembers: familyMembers.map(normalizeFamilyMember),
      fileName: req.file?.originalname || cnicImageName,
      storedFileName,
      mimeType: req.file?.mimetype || cnicImageMimeType,
      size: req.file?.size || Buffer.byteLength(cnicImageBase64, 'base64'),
      filePath: relativePath,
      fileUrl: absoluteUrl,
      uploadedAt: new Date(),
    };

    if (payload.familyMembers.length > FAMILY_MEMBER_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${FAMILY_MEMBER_LIMIT} family members are allowed per flat.`,
      });
    }

    if (hasDuplicateCnic(payload.familyMembers)) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate CNIC is not allowed. Please edit the existing member instead.',
      });
    }

    const result = await db.collection(FAMILY_COLLECTION).insertOne(payload);

    console.log('[✅ Family CNIC Image Uploaded to MongoDB]', {
      id: result.insertedId,
      residentName: payload.residentName,
      flatNumber: payload.flatNumber,
      fileName: payload.fileName,
      uploadedAt: payload.uploadedAt,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'CNIC image uploaded successfully.',
      upload: {
        id: result.insertedId,
        ...payload,
      },
    });
  } catch (err) {
    console.error('[❌ Family Upload Error]', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

module.exports = router;