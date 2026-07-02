// Script to insert a new user into MongoDB
const mongoose = require('mongoose');
const User = require('./models/User');
const { connectDB } = require('./config/database');

async function createUser() {
  await connectDB();
  const user = new User({
    email: 'ali@example.com',
    password: 'ali12345',
    name: 'Ali',
    role: 'user',
    isActive: true
  });
  await user.save();
  console.log('User created:', user);
  mongoose.connection.close();
}

createUser().catch(console.error);
