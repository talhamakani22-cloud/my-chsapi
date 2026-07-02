const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function removeMoreDemoVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  const emiratesIds = [
    '784-1980-3333333-3',
    '784-1975-4444444-4'
  ];

  const result = await Visitor.deleteMany({ emiratesId: { $in: emiratesIds } });
  console.log('Removed visitors:', result.deletedCount);

  await mongoose.disconnect();
}

removeMoreDemoVisitors();
