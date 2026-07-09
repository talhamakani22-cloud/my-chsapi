const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function removeDemoVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  const cnicIds = [
    '784-2000-1111111-1',
    '784-1999-2222222-2'
  ];

  const result = await Visitor.deleteMany({ cnicId: { $in: cnicIds } });
  console.log('Removed visitors:', result.deletedCount);

  await mongoose.disconnect();
}

removeDemoVisitors();
