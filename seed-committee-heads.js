require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('./config/database');

async function seedCommitteeHeads() {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    const collection = db.collection('committee');

    // Committee heads to seed
    const committeeHeads = [
      {
        name: 'Committee Head 1',
        email: 'head1@chs.com',
        password: 'CommitteePass123!',
        role: 'admin',
        active: true
      },
      {
        name: 'Committee Head 2',
        email: 'head2@chs.com',
        password: 'CommitteePass456!',
        role: 'admin',
        active: true
      }
    ];

    console.log('🔒 Seeding Committee Head Credentials...\n');

    for (const head of committeeHeads) {
      // Hash the password
      const passwordHash = await bcrypt.hash(head.password, 10);

      const committeeRecord = {
        name: head.name,
        email: head.email,
        passwordHash: passwordHash,
        role: head.role,
        active: head.active,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert into database
      const result = await collection.insertOne(committeeRecord);

      console.log(`✅ Committee Head Created:`);
      console.log(`   📧 Email: ${head.email}`);
      console.log(`   🔑 Password: ${head.password}`);
      console.log(`   👤 Name: ${head.name}`);
      console.log(`   🆔 MongoDB ID: ${result.insertedId}`);
      console.log(`   ✓ Password hashed and stored securely\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Display all committee heads
    const allCommittee = await collection.find({}).toArray();
    console.log(`📋 Total Committee Members in Database: ${allCommittee.length}\n`);
    
    for (const member of allCommittee) {
      console.log(`• ${member.name} (${member.email}) - ID: ${member._id}`);
    }

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedCommitteeHeads();
