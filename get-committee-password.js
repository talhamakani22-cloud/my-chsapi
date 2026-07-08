require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
const User = require('./models/User');

async function getCommitteePassword() {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    // Get all committee members
    const collection = db.collection('committee');
    const committeeMembers = await collection.find({}).toArray();

    if (committeeMembers.length === 0) {
      console.log('❌ No committee members found in the database');
    } else {
      console.log(`\n✅ Found ${committeeMembers.length} committee member(s):`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      for (const committee of committeeMembers) {
        console.log(`\n📋 Committee: ${committee.name}`);
        console.log(`📧 Email: ${committee.email}`);
        console.log(`🔑 Password Hash: ${committee.passwordHash ? 'Yes (bcrypt hashed)' : 'Not set'}`);
        console.log(`🆔 ID: ${committee._id}`);
        console.log(`🔗 Linked User ID: ${committee.userId || 'Not linked'}`);

        // Check for linked user
        if (committee.userId) {
          const user = await User.findById(committee.userId);
          if (user) {
            console.log(`  ✅ Linked User: ${user.email}`);
          }
        }
      }
    }

    // Also check for admin users
    console.log('\n\n✅ Checking User collection for admin users:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const adminUsers = await User.find({ role: 'admin' });
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found');
    } else {
      for (const user of adminUsers) {
        console.log(`\n👤 Admin User: ${user.name}`);
        console.log(`📧 Email: ${user.email}`);
        console.log(`🔑 Password: ${user.password || 'N/A (hashed)'}`);
        console.log(`🎭 Role: ${user.role}`);
      }
    }

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

getCommitteePassword();
