const { connectDB, disconnectDB } = require('./config/database');
const User = require('./models/User');

async function seed() {
  await connectDB();

  // Remove existing demo users if any
  await User.deleteMany({ email: { $in: [
    'demo@example.com',
    'alice@example.com',
    'bob@example.com',
    'talha@example.com',
    'reception1@chs.com',
    'reception2@chs.com',
    'desk01@chs.com',
    'desk02@chs.com',
    'frontdesk@chs.com'
  ] } });

  const db = (await import('mongoose')).default.connection.db;
  const receptionCollection = db.collection('reception');
  await receptionCollection.deleteMany({ email: { $in: [
    'reception1@chs.com',
    'reception2@chs.com',
    'desk01@chs.com',
    'desk02@chs.com',
    'frontdesk@chs.com'
  ] } });

  // Create fresh CHS reception login users
  const users = [
    {
      name: 'Reception User 1',
      email: 'reception1@chs.com',
      password: 'Reception@123',
      role: 'manager'
    },
    {
      name: 'Reception User 2',
      email: 'reception2@chs.com',
      password: 'Reception@456',
      role: 'manager'
    },
    {
      name: 'Desk User 1',
      email: 'desk01@chs.com',
      password: 'Desk@101',
      role: 'manager'
    },
    {
      name: 'Desk User 2',
      email: 'desk02@chs.com',
      password: 'Desk@202',
      role: 'manager'
    },
    {
      name: 'Front Desk',
      email: 'frontdesk@chs.com',
      password: 'FrontDesk@999',
      role: 'manager'
    }
  ];
  for (const u of users) {
    const created = await User.create(u);
    await receptionCollection.updateOne(
      { email: u.email },
      {
        $set: {
          userId: created._id,
          email: u.email,
          role: 'manager',
          active: true,
          name: u.name,
          username: u.email.split('@')[0],
          passwordHash: created.password,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`📧 Email: ${u.email}`);
    console.log(`🔑 Password: ${u.password}`);
  }
  console.log('✅ CHS reception users created successfully!');

  await disconnectDB();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
