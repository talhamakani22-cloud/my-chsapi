const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

const MONGODB_URI = process.env.MONGODB_URI;

async function clearVisitors() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Set the CHS MongoDB connection string before clearing visitors.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  // Remove all visitors
  const delResult = await Visitor.deleteMany({});
  console.log('Removed visitors:', delResult.deletedCount);

  await mongoose.disconnect();
}

clearVisitors();
