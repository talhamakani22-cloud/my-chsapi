const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function addVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  const visitors = [
    {
      emiratesId: '784-2000-1111111-1',
      fullNameEnglish: 'Sara Ahmed Al Farsi',
      fullNameArabic: 'سارة أحمد الفارسي',
      nationality: 'Oman',
      dateOfBirth: '2000-02-20',
      gender: 'Female',
      expiryDate: '2030-02-19',
      issueDate: '2025-02-20'
    },
    {
      emiratesId: '784-1999-2222222-2',
      fullNameEnglish: 'Mohammed Faisal Al Balushi',
      fullNameArabic: 'محمد فيصل البلوشي',
      nationality: 'Oman',
      dateOfBirth: '1999-07-15',
      gender: 'Male',
      expiryDate: '2029-07-14',
      issueDate: '2024-07-15'
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

addVisitors();
