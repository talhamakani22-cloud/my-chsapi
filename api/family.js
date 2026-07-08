const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');

const router = express.Router();
const FAMILY_COLLECTION = 'family_detail';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'cnic-pdfs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || 'cnic.pdf', path.extname(file.originalname || '.pdf'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase || 'cnic'}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

    const sanitizedMembers = familyMembers.map((member) => ({
      memberName: String(member.memberName || '').trim(),
      relation: String(member.relation || '').trim(),
      cnic: String(member.cnic || '').trim(),
      phone: String(member.phone || '').trim(),
    }));

    const selector = { _id: new mongoose.Types.ObjectId(recordId) };
    if (access.scope === 'resident') {
      selector.flatNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    const result = await db.collection(FAMILY_COLLECTION).findOneAndUpdate(
      selector,
      {
        $set: {
          residentName,
          flatNumber,
          familyMembers: sanitizedMembers,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Family record not found.' });
    }

    return res.json({ success: true, message: 'Family details updated successfully.', record: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update family record.' });
  }
});

router.post('/upload-cnic-pdf', upload.single('cnicPdf'), async (req, res) => {
  const cnicPdfBase64 = String(req.body.cnicPdfBase64 || '').trim();
  const cnicPdfName = String(req.body.cnicPdfName || 'CNIC.pdf').trim() || 'CNIC.pdf';
  const cnicPdfMimeType = String(req.body.cnicPdfMimeType || 'application/pdf').trim() || 'application/pdf';

  if (!req.file && !cnicPdfBase64) {
    return res.status(400).json({ success: false, message: 'No CNIC PDF uploaded.' });
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
    .basename(cnicPdfName, path.extname(cnicPdfName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
  const storedFileName = req.file?.filename || `${Date.now()}-${safeBase || 'cnic'}.pdf`;
  const relativePath = `/uploads/cnic-pdfs/${storedFileName}`;
  const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    if (!req.file) {
      const normalizedBase64 = cnicPdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!fileBuffer.length) {
        return res.status(400).json({ success: false, message: 'Uploaded CNIC PDF is empty.' });
      }

      fs.writeFileSync(path.join(uploadDir, storedFileName), fileBuffer);
    }

    const payload = {
      residentName,
      flatNumber,
      familyMembers,
      fileName: req.file?.originalname || cnicPdfName,
      storedFileName,
      mimeType: req.file?.mimetype || cnicPdfMimeType,
      size: req.file?.size || Buffer.byteLength(cnicPdfBase64, 'base64'),
      filePath: relativePath,
      fileUrl: absoluteUrl,
      uploadedAt: new Date(),
    };

    const result = await db.collection(FAMILY_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      message: 'CNIC PDF uploaded successfully.',
      upload: {
        id: result.insertedId,
        ...payload,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

module.exports = router;