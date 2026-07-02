const { connectDB, disconnectDB } = require('./config/database');
const User = require('./models/User');

async function seed() {
  await connectDB();

  // Remove existing demo users if any
  await User.deleteMany({ email: { $in: [
    'demo@example.com',
    'alice@example.com',
    'bob@example.com',
    'talha@example.com'
  ] } });

  // Create fresh demo users
  const users = [
    {
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'password123',
      role: 'user'
    },
    {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'alicepass',
      role: 'admin'
    },
    {
      name: 'Bob Smith',
      email: 'bob@example.com',
      password: 'bobpass',
      role: 'user'
    },
    {
      name: 'Talha Makani',
      email: 'talha@example.com',
      password: 'talhapass',
      role: 'user'
    }
  ];
  for (const u of users) {
    await User.create(u);
    console.log(`📧 Email: ${u.email}`);
    console.log(`🔑 Password: ${u.password}`);
  }
  console.log('✅ Demo users created successfully!');

  await disconnectDB();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
