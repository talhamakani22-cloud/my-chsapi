const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const { extractFlatNumberFromEmail } = require('./accessScope');

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
const RECEIPTS_COLLECTION = 'maintenance_receipts';
const INBOX_COLLECTION = 'maintenance_inbox';
const E_RECIPTS_COLLECTION = 'e reciept';
const FAMILY_COLLECTION = 'family_detail';
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

function normalizeFlatNumber(flatNumber = '') {
  const value = String(flatNumber || '').trim();
  if (!value) return '';
  const digitOnly = value.match(/\d+/g);
  if (digitOnly && digitOnly.length) {
    return digitOnly.join('');
  }
  return value.toLowerCase();
}

function buildReceiptNo(flatNumber = '', index = 0) {
  const safeFlat = normalizeFlatNumber(flatNumber) || 'NA';
  const suffix = index > 0 ? `-${index}` : '';
  return `MR-${safeFlat}-${Date.now()}${suffix}`;
}

async function getRecipientsByFlat(flatNumber = '') {
  const users = await User.find({ role: 'user', isActive: { $ne: false } })
    .select('_id email name role')
    .lean();

  const targetFlat = normalizeFlatNumber(flatNumber);
  if (!targetFlat) return [];

  return users.filter((user) => normalizeFlatNumber(extractFlatNumberFromEmail(user.email)) === targetFlat);
}

async function ensureCollectionExists(db, collectionName) {
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (!collections.length) {
    await db.createCollection(collectionName);
  }
}

function canViewAllMaintenance(sessionUser) {
  const role = String(sessionUser?.role || '').toLowerCase();
  const loginType = String(sessionUser?.loginType || '').toLowerCase();
  return role === 'admin' || role === 'manager' || loginType === 'committee' || loginType === 'reception';
}

function canManageMaintenance(sessionUser) {
  const role = String(sessionUser?.role || '').toLowerCase();
  const loginType = String(sessionUser?.loginType || '').toLowerCase();
  return role === 'admin' || role === 'manager' || loginType === 'committee';
}

const slipsUploadDir = path.join(uploadsRoot, 'maintenance-slips');
if (!fs.existsSync(slipsUploadDir)) {
  fs.mkdirSync(slipsUploadDir, { recursive: true });
}

const slipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, slipsUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg'].includes(ext) ? ext : '.pdf';
    const safeBase = path
      .basename(file.originalname || 'maintenance-slip.pdf', path.extname(file.originalname || '.pdf'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase || 'maintenance-slip'}${safeExt}`);
  },
});

const uploadSlip = multer({
  storage: slipStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isAllowedExt = ['.pdf', '.jpg', '.jpeg'].includes(ext);
    const isAllowedMime = ['application/pdf', 'image/jpeg', 'image/jpg'].includes(file.mimetype);
    if (!isAllowedExt && !isAllowedMime) {
      return cb(new Error('Only PDF or JPG/JPEG files are allowed.'));
    }
    return cb(null, true);
  },
});

router.get('/report', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    await ensureCollectionExists(db, E_RECIPTS_COLLECTION);

    const isAllView = canViewAllMaintenance(sessionUser);
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    let receipts = [];

    if (isAllView) {
      const receiptQuery = includeInactive ? {} : { isActive: { $ne: false } };
      receipts = await db
        .collection(RECEIPTS_COLLECTION)
        .find(receiptQuery)
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();

      const receiptIds = receipts.map((r) => r._id);
      const inboxRows = receiptIds.length
        ? await db
            .collection(INBOX_COLLECTION)
            .find({ receiptId: { $in: receiptIds } })
            .sort({ updatedAt: -1, createdAt: -1 })
            .toArray()
        : [];

      const byReceiptId = new Map();
      for (const row of inboxRows) {
        const key = String(row.receiptId || '');
        if (!key) continue;

        if (!byReceiptId.has(key)) {
          byReceiptId.set(key, {
            totalUsers: 0,
            paidUsers: 0,
            paidSlipCount: 0,
            paymentSlipUrl: '',
            paymentSlipPath: '',
            paymentSlipStoredFileName: '',
            paymentSlipName: '',
          });
        }

        const stats = byReceiptId.get(key);
        stats.totalUsers += 1;

        const residentStatus = String(row.status || '').toLowerCase();
        if (residentStatus === 'paid') {
          stats.paidUsers += 1;
        }

        if (row.paymentSlipUrl) {
          stats.paidSlipCount += 1;
          if (!stats.paymentSlipUrl) {
            stats.paymentSlipUrl = row.paymentSlipUrl;
            stats.paymentSlipPath = row.paymentSlipPath || '';
            stats.paymentSlipStoredFileName = row.paymentSlipStoredFileName || '';
            stats.paymentSlipName = row.paymentSlipName || '';
          }
        }
      }

      const rows = receipts.map((receipt) => {
        const stats = byReceiptId.get(String(receipt._id)) || {
          totalUsers: receipt.recipientsCount || 0,
          paidUsers: 0,
          paidSlipCount: 0,
          paymentSlipUrl: '',
          paymentSlipPath: '',
          paymentSlipStoredFileName: '',
          paymentSlipName: '',
        };
        const totalUsers = Number(stats.totalUsers || 0);
        const paidUsers = Number(stats.paidUsers || 0);
        const pendingUsers = Math.max(totalUsers - paidUsers, 0);
        const amount = Number(receipt.amount || 0);
        const receiptStatus = String(receipt.status || '').toLowerCase();
        const isPaid = receiptStatus === 'paid';
        const legacyUrl = String(stats.paymentSlipUrl || '').trim();
        const paymentSlipPath = String(stats.paymentSlipPath || '').trim()
          || (legacyUrl.startsWith('/uploads/') ? legacyUrl : '');
        const paymentSlipStoredFileName = String(stats.paymentSlipStoredFileName || paymentSlipPath.split('/').pop() || '').trim();
        const isAbsoluteSlipUrl = /^https?:\/\//i.test(legacyUrl);
        const paymentSlipAvailable = isAbsoluteSlipUrl || (paymentSlipStoredFileName
          ? fs.existsSync(path.join(slipsUploadDir, paymentSlipStoredFileName))
          : false);
        const paymentSlipUrl = paymentSlipPath
          ? `${req.protocol}://${req.get('host')}${paymentSlipPath}`
          : legacyUrl;

        return {
          id: receipt._id,
          receiptNo: receipt.receiptNo || '-',
          ownerName: receipt.ownerName || receipt.residentName || '-',
          residentName: receipt.residentName || '-',
          flatNumber: receipt.flatNumber || '-',
          receiptMonth: receipt.receiptMonth || '-',
          amount,
          status: receipt.status || '-',
          paymentDate: receipt.paymentDate || '-',
          note: receipt.note || '-',
          recipientsCount: totalUsers,
          receivedUsers: paidUsers,
          pendingUsers,
          receivedAmount: isPaid ? amount : 0,
          pendingAmount: isPaid ? 0 : amount,
          paidSlipCount: Number(stats.paidSlipCount || 0),
          paymentSlipPath,
          paymentSlipUrl,
          paymentSlipAvailable,
          paymentSlipName: stats.paymentSlipName || '',
          generatedAt: receipt.generatedAt || receipt.createdAt || null,
        };
      });

      return res.json({ success: true, scope: 'all', rows });
    }

    const residentEmail = String(sessionUser.email).trim().toLowerCase();
    const inboxRows = await db
      .collection(INBOX_COLLECTION)
      .find({ email: residentEmail })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const receiptIds = inboxRows.map((row) => row.receiptId).filter(Boolean);
    receipts = receiptIds.length
      ? await db
          .collection(RECEIPTS_COLLECTION)
          .find({ _id: { $in: receiptIds } })
          .toArray()
      : [];

    const receiptsMap = new Map(receipts.map((r) => [String(r._id), r]));
    const rows = inboxRows.map((row) => {
      const receipt = receiptsMap.get(String(row.receiptId));
      const amount = Number(receipt?.amount || 0);
      const residentStatus = String(row.status || 'unread').toLowerCase();
      const paymentSlipPath = String(row.paymentSlipPath || '').trim();
      const paymentSlipStoredFileName = String(row.paymentSlipStoredFileName || paymentSlipPath.split('/').pop() || '').trim();
      const legacyUrl = String(row.paymentSlipUrl || '').trim();
      const isAbsoluteSlipUrl = /^https?:\/\//i.test(legacyUrl);
      const paymentSlipAvailable = isAbsoluteSlipUrl || (paymentSlipStoredFileName
        ? fs.existsSync(path.join(slipsUploadDir, paymentSlipStoredFileName))
        : false);
      const paymentSlipUrl = paymentSlipPath
        ? `${req.protocol}://${req.get('host')}${paymentSlipPath}`
        : legacyUrl;

      return {
        id: row.receiptId,
        receiptNo: receipt?.receiptNo || '-',
        ownerName: receipt?.ownerName || receipt?.residentName || '-',
        residentName: receipt?.residentName || '-',
        flatNumber: receipt?.flatNumber || '-',
        receiptMonth: receipt?.receiptMonth || '-',
        amount,
        status: residentStatus,
        paymentDate: row.paymentDate || receipt?.paymentDate || '-',
        note: receipt?.note || '-',
        recipientsCount: 1,
        receivedUsers: residentStatus === 'paid' ? 1 : 0,
        pendingUsers: residentStatus === 'paid' ? 0 : 1,
        receivedAmount: residentStatus === 'paid' ? amount : 0,
        pendingAmount: residentStatus === 'paid' ? 0 : amount,
        paidSlipCount: row.paymentSlipUrl ? 1 : 0,
        paymentSlipPath,
        paymentSlipUrl,
        paymentSlipAvailable,
        paymentSlipName: row.paymentSlipName || '',
        generatedAt: receipt?.generatedAt || receipt?.createdAt || row.createdAt || null,
      };
    });

    return res.json({ success: true, scope: 'resident', rows });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch maintenance report.',
    });
  }
});

router.post('/broadcast', async (req, res) => {
  const {
    receiptNo,
    ownerName,
    residentName,
    flatNumber,
    receiptMonth,
    amount,
    status,
    paymentDate,
    note,
    generatedAt,
    receiptPdfUri,
  } = req.body || {};

  const required = [residentName, flatNumber, receiptMonth, amount];
  if (required.some((v) => String(v || '').trim() === '')) {
    return res.status(400).json({
      success: false,
      message: 'residentName, flatNumber, receiptMonth, and amount are required.',
    });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    await ensureCollectionExists(db, E_RECIPTS_COLLECTION);

    const recipients = await getRecipientsByFlat(flatNumber);
    const ownerLabel = String(ownerName || residentName || '').trim();

    const payload = {
      receiptNo: String(receiptNo || buildReceiptNo(flatNumber)),
      ownerName: ownerLabel,
      residentName: String(residentName || '').trim(),
      flatNumber: String(flatNumber || '').trim(),
      receiptMonth: String(receiptMonth || '').trim(),
      amount: numericAmount,
      status: String(status || 'Unpaid').trim(),
      paymentDate: String(paymentDate || '').trim(),
      note: String(note || '').trim(),
      generatedAt: generatedAt ? new Date(generatedAt) : new Date(),
      receiptPdfUri: String(receiptPdfUri || '').trim(),
      recipientsCount: recipients.length,
      createdBy: req?.session?.user?.email || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertedReceipt = await db.collection(RECEIPTS_COLLECTION).insertOne(payload);

    if (recipients.length > 0) {
      const inboxRows = recipients.map((user) => ({
        receiptId: insertedReceipt.insertedId,
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: 'unread',
        createdAt: new Date(),
      }));

      await db.collection(INBOX_COLLECTION).insertMany(inboxRows);
    }

    return res.status(201).json({
      success: true,
      message: `Receipt generated for flat ${payload.flatNumber} and sent to ${recipients.length} matched resident account(s).`,
      receiptId: insertedReceipt.insertedId,
      recipientsCount: recipients.length,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to broadcast maintenance receipt.',
    });
  }
});

router.post('/broadcast-bulk', async (req, res) => {
  const {
    receiptMonth,
    amount,
    status,
    paymentDate,
    note,
    generatedAt,
  } = req.body || {};

  if (String(receiptMonth || '').trim() === '' || String(amount || '').trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'receiptMonth and amount are required.',
    });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const familyRows = await db
      .collection(FAMILY_COLLECTION)
      .find({
        residentName: { $exists: true, $ne: '' },
        flatNumber: { $exists: true, $ne: '' },
      })
      .sort({ uploadedAt: -1, _id: -1 })
      .toArray();

    const uniqueFamilies = [];
    const seenFlats = new Set();
    for (const row of familyRows) {
      const normalizedFlat = normalizeFlatNumber(row.flatNumber);
      if (!normalizedFlat || seenFlats.has(normalizedFlat)) continue;
      seenFlats.add(normalizedFlat);
      uniqueFamilies.push(row);
    }

    if (!uniqueFamilies.length) {
      return res.status(404).json({
        success: false,
        message: 'No family records found with resident name and flat number.',
      });
    }

    const receiptDocs = [];
    const inboxDocs = [];
    let totalRecipients = 0;

    for (let i = 0; i < uniqueFamilies.length; i += 1) {
      const family = uniqueFamilies[i];
      const resident = String(family.residentName || '').trim();
      const flat = String(family.flatNumber || '').trim();
      if (!resident || !flat) continue;

      const recipients = await getRecipientsByFlat(flat);
      totalRecipients += recipients.length;

      const receiptId = new mongoose.Types.ObjectId();
      const now = new Date();
      const receiptDoc = {
        _id: receiptId,
        receiptNo: buildReceiptNo(flat, i + 1),
        ownerName: resident,
        residentName: resident,
        flatNumber: flat,
        receiptMonth: String(receiptMonth || '').trim(),
        amount: numericAmount,
        status: String(status || 'Unpaid').trim(),
        paymentDate: String(paymentDate || '').trim(),
        note: String(note || '').trim(),
        generatedAt: generatedAt ? new Date(generatedAt) : now,
        receiptPdfUri: '',
        recipientsCount: recipients.length,
        createdBy: req?.session?.user?.email || 'system',
        createdAt: now,
        updatedAt: now,
      };

      receiptDocs.push(receiptDoc);

      for (const user of recipients) {
        inboxDocs.push({
          receiptId,
          userId: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: 'unread',
          createdAt: now,
        });
      }
    }

    if (!receiptDocs.length) {
      return res.status(404).json({
        success: false,
        message: 'No valid family records found for receipt generation.',
      });
    }

    await db.collection(RECEIPTS_COLLECTION).insertMany(receiptDocs);
    if (inboxDocs.length) {
      await db.collection(INBOX_COLLECTION).insertMany(inboxDocs);
    }

    return res.status(201).json({
      success: true,
      message: `Generated ${receiptDocs.length} e-receipt(s) for flat owners. Sent to ${totalRecipients} matched resident account(s).`,
      generatedCount: receiptDocs.length,
      recipientsCount: totalRecipients,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate maintenance e-receipts.',
    });
  }
});

router.put('/:id', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canManageMaintenance(sessionUser)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to edit receipts.' });
  }

  const receiptIdRaw = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(receiptIdRaw)) {
    return res.status(400).json({ success: false, message: 'Invalid receipt id.' });
  }

  const updates = {};

  const ownerName = String(req.body.ownerName || '').trim();
  const residentName = String(req.body.residentName || '').trim();
  const flatNumber = String(req.body.flatNumber || '').trim();
  const receiptMonth = String(req.body.receiptMonth || '').trim();
  const status = String(req.body.status || '').trim();
  const paymentDate = String(req.body.paymentDate || '').trim();
  const note = String(req.body.note || '').trim();

  if (ownerName) updates.ownerName = ownerName;
  if (residentName) updates.residentName = residentName;
  if (flatNumber) updates.flatNumber = flatNumber;
  if (receiptMonth) updates.receiptMonth = receiptMonth;
  if (status) updates.status = status;
  updates.paymentDate = paymentDate;
  updates.note = note;

  if (req.body.amount !== undefined) {
    const numericAmount = Number(req.body.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }
    updates.amount = numericAmount;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: 'No valid fields provided to update.' });
  }

  updates.updatedAt = new Date();

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const receiptId = new mongoose.Types.ObjectId(receiptIdRaw);
    const result = await db.collection(RECEIPTS_COLLECTION).updateOne(
      { _id: receiptId },
      { $set: updates }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    return res.json({ success: true, message: 'Receipt updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update receipt.' });
  }
});

router.put('/:id/status', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canManageMaintenance(sessionUser)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to update receipt status.' });
  }

  const receiptIdRaw = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(receiptIdRaw)) {
    return res.status(400).json({ success: false, message: 'Invalid receipt id.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const receiptId = new mongoose.Types.ObjectId(receiptIdRaw);
    const isActive = String(req.body.isActive).toLowerCase() === 'true';
    const updateResult = await db.collection(RECEIPTS_COLLECTION).updateOne(
      { _id: receiptId },
      {
        $set: {
          isActive,
          status: isActive ? 'Active' : 'Inactive',
          ...(isActive ? { $unset: { deletedAt: '' } } : { deletedAt: new Date() }),
          updatedAt: new Date(),
        },
      }
    );

    if (!updateResult.matchedCount) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    await db.collection(INBOX_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );
    await db.collection(E_RECIPTS_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    return res.json({ success: true, message: `Receipt marked ${isActive ? 'active' : 'inactive'} successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update receipt.' });
  }
});

router.delete('/:id', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canManageMaintenance(sessionUser)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to delete receipts.' });
  }

  const receiptIdRaw = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(receiptIdRaw)) {
    return res.status(400).json({ success: false, message: 'Invalid receipt id.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const receiptId = new mongoose.Types.ObjectId(receiptIdRaw);
    const deleteResult = await db.collection(RECEIPTS_COLLECTION).updateOne(
      { _id: receiptId, isActive: { $ne: false } },
      {
        $set: {
          isActive: false,
          status: 'Inactive',
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (!deleteResult.matchedCount) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    await db.collection(INBOX_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );
    await db.collection(E_RECIPTS_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );

    return res.json({ success: true, message: 'Receipt marked inactive successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update receipt.' });
  }
});

router.put('/:id/status', async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  if (!canManageMaintenance(sessionUser)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to update receipts.' });
  }

  const receiptIdRaw = String(req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(receiptIdRaw)) {
    return res.status(400).json({ success: false, message: 'Invalid receipt id.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const receiptId = new mongoose.Types.ObjectId(receiptIdRaw);
    const isActive = String(req.body.isActive).toLowerCase() === 'true';

    const updateResult = await db.collection(RECEIPTS_COLLECTION).updateOne(
      { _id: receiptId },
      {
        $set: {
          isActive,
          status: isActive ? String(req.body.status || 'Unpaid').trim() : 'Inactive',
          deletedAt: isActive ? null : new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (!updateResult.matchedCount) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    await db.collection(INBOX_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );
    await db.collection(E_RECIPTS_COLLECTION).updateMany(
      { receiptId },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    return res.json({ success: true, message: `Receipt marked ${isActive ? 'active' : 'inactive'} successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update receipt.' });
  }
});

router.post('/upload-slip', uploadSlip.single('slipPdf'), async (req, res) => {
  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  const receiptIdRaw = String(req.body.receiptId || '').trim();
  const receiptNo = String(req.body.receiptNo || '').trim();
  const slipImageBase64 = String(req.body.slipImageBase64 || '').trim();
  const slipImageName = String(req.body.slipImageName || 'payment-slip.jpg').trim();
  const slipImageMimeType = String(req.body.slipImageMimeType || 'image/jpeg').trim();

  if (!receiptIdRaw && !receiptNo) {
    return res.status(400).json({ success: false, message: 'receiptId or receiptNo is required.' });
  }

  // Check for either file upload (FormData) or base64 (JSON)
  if (!req.file && !slipImageBase64) {
    return res.status(400).json({ success: false, message: 'Please upload a payment slip.' });
  }

  try {
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready.');
    }

    const receiptQuery = {};
    if (receiptIdRaw) {
      if (!mongoose.Types.ObjectId.isValid(receiptIdRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid receiptId.' });
      }
      receiptQuery._id = new mongoose.Types.ObjectId(receiptIdRaw);
    } else {
      receiptQuery.receiptNo = receiptNo;
    }

    const receipt = await db.collection(RECEIPTS_COLLECTION).findOne(receiptQuery);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    const residentEmail = String(sessionUser.email).trim().toLowerCase();
    const paidAt = new Date();
    let relativePath = '';
    let storedFileName = '';
    let storedMimeType = '';
    let storedDisplayName = '';
    let storedSize = 0;

    // Handle JSON base64 upload
    if (slipImageBase64 && !req.file) {
      const normalizedBase64 = slipImageBase64
        .replace(/^data:image\/[a-z]+;base64,/, '')
        .replace(/^data:[^;]+;base64,/, '');
      
      const slipBuffer = Buffer.from(normalizedBase64, 'base64');
      if (!slipBuffer.length) {
        return res.status(400).json({ success: false, message: 'Uploaded slip image is empty.' });
      }

      // Determine file extension
      let fileExt = '.jpg';
      const mimeType = slipImageMimeType.toLowerCase();
      if (mimeType.includes('png')) {
        fileExt = '.png';
      }

      const slipsDir = path.join(uploadsRoot, 'maintenance-slips');
      if (!fs.existsSync(slipsDir)) {
        fs.mkdirSync(slipsDir, { recursive: true });
      }

      const safeFileName = String(slipImageName || 'slip').split('.')[0]
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      
      storedFileName = `slip-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
      const filePath = path.join(slipsDir, storedFileName);
      
      fs.writeFileSync(filePath, slipBuffer);
      relativePath = `/uploads/maintenance-slips/${storedFileName}`;
      storedMimeType = slipImageMimeType || 'image/jpeg';
      storedDisplayName = slipImageName || 'payment-slip.jpg';
      storedSize = slipBuffer.length;
    } else if (req.file) {
      // Handle FormData file upload
      relativePath = `/uploads/maintenance-slips/${req.file.filename}`;
      storedFileName = req.file.filename;
      storedMimeType = req.file.mimetype || 'application/octet-stream';
      storedDisplayName = req.file.originalname || 'payment-slip';
      storedSize = Number(req.file.size || 0);
    }

    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;

    const updateResult = await db.collection(INBOX_COLLECTION).updateOne(
      { receiptId: receipt._id, email: residentEmail },
      {
        $set: {
          status: 'paid',
          paymentDate: paidAt,
          paymentSlipName: storedDisplayName || 'payment-slip',
          paymentSlipStoredFileName: storedFileName,
          paymentSlipMimeType: storedMimeType,
          paymentSlipSize: storedSize,
          paymentSlipPath: relativePath,
          paymentSlipUrl: absoluteUrl,
          updatedAt: new Date(),
        },
      }
    );

    if (!updateResult.matchedCount) {
      return res.status(403).json({ success: false, message: 'This receipt is not assigned to your account.' });
    }

    const pendingCount = await db.collection(INBOX_COLLECTION).countDocuments({
      receiptId: receipt._id,
      status: { $ne: 'paid' },
    });

    const nextStatus = pendingCount === 0 ? 'paid' : 'partially-paid';
    await db.collection(RECEIPTS_COLLECTION).updateOne(
      { _id: receipt._id },
      {
        $set: {
          status: nextStatus,
          updatedAt: new Date(),
        },
      }
    );

    await db.collection(E_RECIPTS_COLLECTION).updateOne(
      {
        receiptId: receipt._id,
        residentEmail,
      },
      {
        $set: {
          receiptId: receipt._id,
          receiptNo: receipt.receiptNo,
          residentEmail,
          residentStatus: 'paid',
          overallStatus: nextStatus,
          amount: Number(receipt.amount || 0),
          paymentDate: paidAt,
          paymentSlipName: storedDisplayName || 'payment-slip',
          paymentSlipStoredFileName: storedFileName,
          paymentSlipMimeType: storedMimeType,
          paymentSlipSize: storedSize,
          paymentSlipPath: relativePath,
          paymentSlipUrl: absoluteUrl,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: 'Payment slip uploaded. Status changed to paid.',
      receiptId: receipt._id,
      receiptNo: receipt.receiptNo,
      residentEmail,
      residentStatus: 'paid',
      overallStatus: nextStatus,
      paymentSlipUrl: absoluteUrl,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to upload payment slip.',
    });
  }
});

module.exports = router;
