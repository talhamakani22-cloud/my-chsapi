const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function clearVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  // Remove all visitors
  const delResult = await Visitor.deleteMany({});
  console.log('Removed visitors:', delResult.deletedCount);

  await mongoose.disconnect();
}

clearVisitors();
