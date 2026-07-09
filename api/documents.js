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
const DOCUMENTS_COLLECTION = 'documents';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || 'document.pdf', path.extname(file.originalname || '.pdf'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    cb(null, `${Date.now()}-${safeBase || 'document'}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = path.extname(file.originalname || '').toLowerCase() === '.pdf';
    if (!isPdfMime && !isPdfExt) {
      return cb(new Error('Only PDF files are allowed.'));
    }
    return cb(null, true);
  },
});

function canViewAllDocuments(sessionUser = {}) {
  const role = String(sessionUser.role || '').toLowerCase();
  const loginType = String(sessionUser.loginType || '').toLowerCase();
  return role === 'admin' || loginType === 'committee';
}

router.get('/', async (req, res) => {
  try {
    const access = getAccessScope(req);
    if (!access.allowed) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    if (access.scope === 'all' && !canViewAllDocuments(access.sessionUser)) {
      return res.status(403).json({
        success: false,
        message: 'Only committee head can view all uploaded documents.',
      });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const search = String(req.query.search || '').trim();
    const query = { isActive: { $ne: false } };

    if (access.scope === 'resident') {
      query.flatNumber = { $regex: buildFlatScopedRegex(access.flatNumber) };
    }

    if (search) {
      query.$or = [
        { ownerName: { $regex: search, $options: 'i' } },
        { flatNumber: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
      ];
    }

    const records = await db
      .collection(DOCUMENTS_COLLECTION)
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
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch documents.' });
  }
});

router.post('/upload', upload.single('documentPdf'), async (req, res) => {
  try {
    const access = getAccessScope(req);
    if (!access.allowed) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const documentPdfBase64 = String(req.body.documentPdfBase64 || '').trim();
    const documentPdfName = String(req.body.documentPdfName || 'document.pdf').trim() || 'document.pdf';
    const documentPdfMimeType = String(req.body.documentPdfMimeType || 'application/pdf').trim() || 'application/pdf';

    if (!req.file && !documentPdfBase64) {
      return res.status(400).json({ success: false, message: 'Please upload a PDF document.' });
    }

    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const sessionUser = access.sessionUser || {};
    const requestedOwnerName = String(req.body.ownerName || '').trim();
    const requestedFlatNumber = String(req.body.flatNumber || '').trim();

    const ownerName = requestedOwnerName || String(sessionUser.name || sessionUser.email || 'Resident').trim();
    const flatNumber = access.scope === 'resident'
      ? String(access.flatNumber || '').trim()
      : requestedFlatNumber;

    if (!ownerName || !flatNumber) {
      return res.status(400).json({ success: false, message: 'Owner name and flat number are required.' });
    }

    let storedFileName = req.file?.filename || '';
    let fileName = req.file?.originalname || documentPdfName;
    let mimeType = req.file?.mimetype || documentPdfMimeType;
    let fileSize = req.file?.size || 0;

    if (!req.file) {
      const normalizedBase64 = documentPdfBase64
        .replace(/^data:application\/pdf;base64,/, '')
        .replace(/^data:[^;]+;base64,/, '');
      const pdfBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!pdfBuffer.length) {
        return res.status(400).json({ success: false, message: 'Uploaded PDF is empty.' });
      }

      const safeBase = path
        .basename(fileName, path.extname(fileName || '.pdf'))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      storedFileName = `${Date.now()}-${safeBase || 'document'}.pdf`;
      fs.writeFileSync(path.join(uploadDir, storedFileName), pdfBuffer);
      fileSize = pdfBuffer.length;
      mimeType = 'application/pdf';
      fileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    }

    const relativePath = `/uploads/documents/${storedFileName}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

    const payload = {
      ownerName,
      flatNumber,
      fileName: fileName || 'document.pdf',
      storedFileName,
      mimeType,
      size: fileSize,
      filePath: relativePath,
      fileUrl: absoluteUrl,
      isActive: true,
      uploadedAt: new Date(),
    };

    const result = await db.collection(DOCUMENTS_COLLECTION).insertOne(payload);

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      record: {
        id: result.insertedId,
        ...payload,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to upload document.' });
  }
});

module.exports = router;
