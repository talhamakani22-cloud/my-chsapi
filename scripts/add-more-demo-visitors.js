const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function addMoreVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  const visitors = [
    {
      emiratesId: '784-1980-3333333-3',
      fullNameEnglish: 'Layla Hassan Al Mazrouei',
      fullNameArabic: 'ليلى حسن المزروعي',
      nationality: 'UAE',
      dateOfBirth: '1980-11-11',
      gender: 'Female',
      expiryDate: '2030-11-10',
      issueDate: '2025-11-11'
    },
    {
      emiratesId: '784-1975-4444444-4',
      fullNameEnglish: 'Yousef Khalid Al Shamsi',
      fullNameArabic: 'يوسف خالد الشامسي',
      nationality: 'UAE',
      dateOfBirth: '1975-05-05',
      gender: 'Male',
      expiryDate: '2029-05-04',
      issueDate: '2024-05-05'
    }
  ];

  for (const v of visitors) {
    try {
      await Visitor.create(v);
      console.log('Added:', v.fullNameEnglish);
    } catch (err) {
      console.error('Error adding', v.fullNameEnglish, err.message);
    }
  }

  await mongoose.disconnect();
}

addMoreVisitors();
