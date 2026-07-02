const { connectDB, disconnectDB } = require('./config/database');
const Visitor = require('./models/Visitor');

async function seedVisitors() {
  await connectDB();

  // Remove all existing visitors
  await Visitor.deleteMany({});


  // Generate unique visitorId for each dummy visitor
  const visitors = [
    {
      visitorId: 'VIS00001',
      emiratesId: '784-1987-1234567-1',
      fullNameEnglish: 'John Doe',
      fullNameArabic: 'جون دو',
      nationality: 'American',
      dateOfBirth: '1987-05-12',
      gender: 'Male',
      expiryDate: '2030-05-12',
      issueDate: '2020-05-12',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'VIP visitor',
      purposeOfVisit: 'Business Meeting',
      remark: 'Executive visitor from USA'
    },
    {
      visitorId: 'VIS00002',
      emiratesId: '784-1990-7654321-2',
      fullNameEnglish: 'Jane Smith',
      fullNameArabic: 'جين سميث',
      nationality: 'British',
      dateOfBirth: '1990-11-23',
      gender: 'Female',
      expiryDate: '2031-11-23',
      issueDate: '2021-11-23',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'First time visitor',
      purposeOfVisit: 'Project Discussion',
      remark: 'Consultant from UK'
    },
    {
      visitorId: 'VIS00003',
      emiratesId: '784-1990-7654321-3',
      fullNameEnglish: 'Ali',
      fullNameArabic: 'علي',
      nationality: 'British',
      dateOfBirth: '1990-11-23',
      gender: 'Male',
      expiryDate: '2031-12-23',
      issueDate: '2021-12-23',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'First time visitor',
      purposeOfVisit: 'Client Meeting',
      remark: 'Partner visit'
    },
    {
      visitorId: 'VIS00004',
      emiratesId: '784-1985-2345678-4',
      fullNameEnglish: 'Fatima Hassan',
      fullNameArabic: 'فاطمة حسن',
      nationality: 'UAE',
      dateOfBirth: '1985-08-22',
      gender: 'Female',
      expiryDate: '2032-08-21',
      issueDate: '2022-08-22',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'Returning visitor',
      purposeOfVisit: 'Training Session',
      remark: 'Regular guest'
    },
    {
      visitorId: 'VIS00005',
      emiratesId: '784-1992-3456789-5',
      fullNameEnglish: 'Omar Khalid',
      fullNameArabic: 'عمر خالد',
      nationality: 'UAE',
      dateOfBirth: '1992-03-10',
      gender: 'Male',
      expiryDate: '2033-03-09',
      issueDate: '2023-03-10',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'Frequent visitor',
      purposeOfVisit: 'Board Meeting',
      remark: 'Director'
    },
    {
      visitorId: 'VIS00006',
      emiratesId: '784-1988-4567890-6',
      fullNameEnglish: 'Mariam Abdullah',
      fullNameArabic: 'مريم عبدالله',
      nationality: 'UAE',
      dateOfBirth: '1988-11-28',
      gender: 'Female',
      expiryDate: '2034-11-27',
      issueDate: '2024-11-28',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'VIP guest',
      purposeOfVisit: 'Official Visit',
      remark: 'Government official'
    },
    {
      visitorId: 'VIS00007',
      emiratesId: '784-1995-5678901-7',
      fullNameEnglish: 'Khalid Rashid',
      fullNameArabic: 'خالد راشد',
      nationality: 'UAE',
      dateOfBirth: '1995-07-04',
      gender: 'Male',
      expiryDate: '2035-07-03',
      issueDate: '2025-07-04',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'Business visitor',
      purposeOfVisit: 'Sales Presentation',
      remark: 'Sales partner'
    },
    {
      visitorId: 'VIS00008',
      emiratesId: '784-1982-6789012-8',
      fullNameEnglish: 'Noura Saif',
      fullNameArabic: 'نورة سيف',
      nationality: 'UAE',
      dateOfBirth: '1982-01-19',
      gender: 'Female',
      expiryDate: '2036-01-18',
      issueDate: '2026-01-19',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'Special guest',
      purposeOfVisit: 'Strategic Planning',
      remark: 'CEO'
    },
    {
      visitorId: 'VIS00009',
      emiratesId: '784-1999-9999999-9',
      fullNameEnglish: 'Talha Makani',
      fullNameArabic: 'طلحة مكانی',
      nationality: 'Pakistani',
      dateOfBirth: '1999-09-09',
      gender: 'Male',
      expiryDate: '2037-09-09',
      issueDate: '2027-09-09',
      scannedImageUri: null,
      checkInTime: new Date(),
      checkOutTime: null,
      status: 'checked-in',
      platform: 'expo',
      notes: 'New visitor',
      purposeOfVisit: 'Tech Demo',
      remark: 'Developer'
    }
  ];

  await Visitor.insertMany(visitors);

  console.log('✅ Dummy visitors created successfully!');
  await disconnectDB();
  process.exit(0);
}

seedVisitors().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
