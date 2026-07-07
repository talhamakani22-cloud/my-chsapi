const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');

const router = express.Router();
const RECEIPTS_COLLECTION = 'maintenance_receipts';
const INBOX_COLLECTION = 'maintenance_inbox';
const E_RECIPTS_COLLECTION = 'e reciept';

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

const slipsUploadDir = path.join(__dirname, '..', 'uploads', 'maintenance-slips');
if (!fs.existsSync(slipsUploadDir)) {
  fs.mkdirSync(slipsUploadDir, { recursive: true });
}

const slipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, slipsUploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname || 'maintenance-slip.pdf', path.extname(file.originalname || '.pdf'))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase || 'maintenance-slip'}.pdf`);
  },
});

const uploadSlip = multer({
  storage: slipStorage,
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
    let receipts = [];

    if (isAllView) {
      receipts = await db
        .collection(RECEIPTS_COLLECTION)
        .find({})
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();

      const receiptIds = receipts.map((r) => r._id);
      const inboxAgg = receiptIds.length
        ? await db
            .collection(INBOX_COLLECTION)
            .aggregate([
              { $match: { receiptId: { $in: receiptIds } } },
              {
                $group: {
                  _id: '$receiptId',
                  totalUsers: { $sum: 1 },
                  paidUsers: {
                    $sum: {
                      $cond: [{ $eq: [{ $toLower: '$status' }, 'paid'] }, 1, 0],
                    },
                  },
                },
              },
            ])
            .toArray()
        : [];

      const byReceiptId = new Map(inboxAgg.map((row) => [String(row._id), row]));
      const rows = receipts.map((receipt) => {
        const stats = byReceiptId.get(String(receipt._id)) || { totalUsers: receipt.recipientsCount || 0, paidUsers: 0 };
        const totalUsers = Number(stats.totalUsers || 0);
        const paidUsers = Number(stats.paidUsers || 0);
        const pendingUsers = Math.max(totalUsers - paidUsers, 0);
        const amount = Number(receipt.amount || 0);

        return {
          id: receipt._id,
          receiptNo: receipt.receiptNo || '-',
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
          receivedAmount: amount * paidUsers,
          pendingAmount: amount * pendingUsers,
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

      return {
        id: row.receiptId,
        receiptNo: receipt?.receiptNo || '-',
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

    const recipients = await User.find({ role: 'user', isActive: { $ne: false } })
      .select('_id email name role')
      .lean();

    const payload = {
      receiptNo: String(receiptNo || `MR-${Date.now()}`),
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
      message: `Receipt sent to ${recipients.length} users.`,
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

router.post('/upload-slip', uploadSlip.single('slipPdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a PDF payment slip.' });
  }

  const sessionUser = req?.session?.user;
  if (!sessionUser?.email) {
    return res.status(401).json({ success: false, message: 'Please log in first.' });
  }

  const receiptIdRaw = String(req.body.receiptId || '').trim();
  const receiptNo = String(req.body.receiptNo || '').trim();
  if (!receiptIdRaw && !receiptNo) {
    return res.status(400).json({ success: false, message: 'receiptId or receiptNo is required.' });
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
    const relativePath = `/uploads/maintenance-slips/${req.file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativePath}`;
    const paidAt = new Date();

    const updateResult = await db.collection(INBOX_COLLECTION).updateOne(
      { receiptId: receipt._id, email: residentEmail },
      {
        $set: {
          status: 'paid',
          paymentDate: paidAt,
          paymentSlipName: req.file.originalname,
          paymentSlipStoredFileName: req.file.filename,
          paymentSlipMimeType: req.file.mimetype,
          paymentSlipSize: req.file.size,
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
          paymentSlipName: req.file.originalname,
          paymentSlipStoredFileName: req.file.filename,
          paymentSlipMimeType: req.file.mimetype,
          paymentSlipSize: req.file.size,
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
