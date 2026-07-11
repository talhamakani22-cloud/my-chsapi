const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://localhost:27017/visitor_managment';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_URI;
const INCLUDE_AUTH = process.argv.includes('--include-auth') || String(process.env.INCLUDE_AUTH || '').toLowerCase() === 'true';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true';

const collectionsToClear = [
  'visitors',
  'family_detail',
  'vehicle_registration',
  'maintenance_receipts',
  'maintenance_inbox',
  'e reciept',
  'documents',
  'notifications',
  'notification_devices',
  'complaints',
  'meeting_chat',
  'loginrecords',
];

const authCollections = ['resident', 'committee', 'users'];

async function clearCollection(db, collectionName) {
  const result = await db.collection(collectionName).deleteMany({});
  console.log(`Cleared ${collectionName}: ${result.deletedCount}`);
}

async function main() {
  const targetCollections = INCLUDE_AUTH
    ? [...collectionsToClear, ...authCollections]
    : collectionsToClear;

  console.log('Reset target collections:');
  targetCollections.forEach((collectionName) => console.log(`- ${collectionName}`));

  if (DRY_RUN) {
    console.log('Dry run only. No data was changed.');
    return;
  }

  await mongoose.connect(MONGODB_URI);
  const maskedUri = MONGODB_URI.includes('@')
    ? MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')
    : MONGODB_URI;
  console.log(`Connected to MongoDB: ${maskedUri}`);

  try {
    for (const collectionName of targetCollections) {
      await clearCollection(mongoose.connection.db, collectionName);
    }
    console.log('Fresh data reset completed successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to reset fresh data:', err.message || err);
  process.exit(1);
});