require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');

async function getFamilyDetails() {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    const collection = db.collection('family_detail');
    const familyRecords = await collection.find({}).toArray();

    if (familyRecords.length === 0) {
      console.log('❌ No family records found in the database\n');
      await disconnectDB();
      process.exit(0);
    }

    console.log('\n📋 FAMILY DETAILS PORTAL');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log(`✅ Total Persons Registered: ${familyRecords.length}\n`);
    console.log('─────────────────────────────────────────────────────────────────────\n');

    let totalFamilyMembers = 0;
    let personWithFamilyCount = 0;
    let personWithoutFamilyCount = 0;

    familyRecords.forEach((record, index) => {
      const familyMembers = record.familyMembers || [];
      const memberCount = familyMembers.length;
      totalFamilyMembers += memberCount;

      if (memberCount > 0) {
        personWithFamilyCount++;
      } else {
        personWithoutFamilyCount++;
      }

      console.log(`${index + 1}. ${record.residentName || 'N/A'}`);
      console.log(`   🏠 Flat: ${record.flatNumber || 'N/A'}`);
      console.log(`   👨‍👩‍👧‍👦 Family Members: ${memberCount}`);

      if (memberCount > 0) {
        console.log(`   📝 Members:`);
        familyMembers.forEach((member, idx) => {
          console.log(`      ${idx + 1}. ${member.name || 'N/A'} (${member.relation || 'N/A'})`);
        });
      }
      console.log('');
    });

    console.log('─────────────────────────────────────────────────────────────────────\n');
    console.log('📊 SUMMARY STATISTICS:');
    console.log(`   • Total Persons: ${familyRecords.length}`);
    console.log(`   • Persons with Family Members: ${personWithFamilyCount}`);
    console.log(`   • Persons without Family Members: ${personWithoutFamilyCount}`);
    console.log(`   • Total Family Members Registered: ${totalFamilyMembers}`);
    console.log(`   • Average Family Members per Person: ${(totalFamilyMembers / familyRecords.length).toFixed(2)}`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

getFamilyDetails();
