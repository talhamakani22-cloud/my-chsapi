const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://localhost:27017/visitor_managment';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_URI;
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true';

const DOCUMENTS_COLLECTION = 'documents';

async function main() {
  console.log(`Target collection: ${DOCUMENTS_COLLECTION}`);

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
    const result = await mongoose.connection.db.collection(DOCUMENTS_COLLECTION).deleteMany({});
    console.log(`Cleared ${DOCUMENTS_COLLECTION}: ${result.deletedCount}`);
    console.log('Documents collection cleared successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Failed to clear documents collection:', err.message || err);
  process.exit(1);
});