
const { connectDB } = require('../config/database');
const Visitor = require('../models/Visitor');
const { getAccessScope, buildFlatScopedRegex } = require('./accessScope');

const express = require('express');
const router = express.Router();

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
        { emiratesId: { $regex: search, $options: 'i' } },
        { fullNameEnglish: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { fullNameArabic: { $regex: search, $options: 'i' } },
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
    res.json({ success: true, visitors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch visitors', error: err.message });
  }
});


// Pakistani CNIC format: 12345-1234567-1
const cnicPattern = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;

// POST /api/visitors - Add a new visitor
router.post('/', async (req, res) => {
  const {
    emiratesId,
    fullNameEnglish,
    fatherName,
    fullNameArabic,
    nationality,
    countryOfStay,
    houseNumber,
    entryTime,
    dateOfBirth,
    gender,
    issueDate,
    expiryDate,
    purposeOfVisit,
    remark
  } = req.body;

  const normalizedGender = normalizeGender(gender);

  // CNIC validation
  if (!cnicPattern.test(emiratesId)) {
    return res.status(400).json({ success: false, message: 'Invalid CNIC format. Use 12345-1234567-1.' });
  }

  // Required fields validation
  if (!emiratesId || !fullNameEnglish || !fatherName || !countryOfStay || !houseNumber || !entryTime || !dateOfBirth || !normalizedGender || !issueDate || !expiryDate || !purposeOfVisit || !remark) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const visitor = new Visitor({
      emiratesId,
      fullNameEnglish,
      fatherName,
      fullNameArabic,
      nationality: countryOfStay || nationality,
      countryOfStay: countryOfStay || nationality,
      houseNumber,
      entryTime,
      dateOfBirth,
      gender: normalizedGender,
      issueDate,
      expiryDate,
      purposeOfVisit,
      remark
    });
    await visitor.save();
    console.log('[Visitor Added]', {
      id: visitor._id,
      emiratesId: visitor.emiratesId,
      fullNameEnglish: visitor.fullNameEnglish,
      nationality: visitor.nationality,
      dateOfBirth: visitor.dateOfBirth,
      gender: visitor.gender,
      purposeOfVisit: visitor.purposeOfVisit,
      remark: visitor.remark
    });
    res.status(201).json(visitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
