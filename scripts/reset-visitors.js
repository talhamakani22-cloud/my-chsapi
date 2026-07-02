const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');

async function resetVisitors() {
  await mongoose.connect('mongodb://localhost:27017/visitor_managment');

  // Remove all existing visitors
  const delResult = await Visitor.deleteMany({});
  console.log('Removed visitors:', delResult.deletedCount);

  // Insert 10 new visitors
  const newVisitors = [
    {
      emiratesId: '784-1981-1111111-1',
      fullNameEnglish: 'Ali Saeed Al Mansoori',
      fullNameArabic: 'علي سعيد المنصوري',
      nationality: 'UAE',
      dateOfBirth: '1981-01-01',
      gender: 'Male',
      expiryDate: '2031-01-01',
      issueDate: '2026-01-01'
    },
    {
      emiratesId: '784-1982-2222222-2',
      fullNameEnglish: 'Fatima Khalifa Al Nuaimi',
      fullNameArabic: 'فاطمة خليفة النعيمي',
      nationality: 'UAE',
      dateOfBirth: '1982-02-02',
      gender: 'Female',
      expiryDate: '2032-02-02',
      issueDate: '2027-02-02'
    },
    {
      emiratesId: '784-1983-3333333-3',
      fullNameEnglish: 'Hassan Mohammed Al Mazrouei',
      fullNameArabic: 'حسن محمد المزروعي',
      nationality: 'UAE',
      dateOfBirth: '1983-03-03',
      gender: 'Male',
      expiryDate: '2033-03-03',
      issueDate: '2028-03-03'
    },
    {
      emiratesId: '784-1984-4444444-4',
      fullNameEnglish: 'Mariam Saif Al Shamsi',
      fullNameArabic: 'مريم سيف الشامسي',
      nationality: 'UAE',
      dateOfBirth: '1984-04-04',
      gender: 'Female',
      expiryDate: '2034-04-04',
      issueDate: '2029-04-04'
    },
    {
      emiratesId: '784-1985-5555555-5',
      fullNameEnglish: 'Omar Rashid Al Falasi',
      fullNameArabic: 'عمر راشد الفلاسي',
      nationality: 'UAE',
      dateOfBirth: '1985-05-05',
      gender: 'Male',
      expiryDate: '2035-05-05',
      issueDate: '2030-05-05'
    },
    {
      emiratesId: '784-1986-6666666-6',
      fullNameEnglish: 'Noura Ibrahim Al Ketbi',
      fullNameArabic: 'نورة إبراهيم الكتبي',
      nationality: 'UAE',
      dateOfBirth: '1986-06-06',
      gender: 'Female',
      expiryDate: '2036-06-06',
      issueDate: '2031-06-06'
    },
    {
      emiratesId: '784-1987-7777777-7',
      fullNameEnglish: 'Sultan Ahmed Al Qasimi',
      fullNameArabic: 'سلطان أحمد القاسمي',
      nationality: 'UAE',
      dateOfBirth: '1987-07-07',
      gender: 'Male',
      expiryDate: '2037-07-07',
      issueDate: '2032-07-07'
    },
    {
      emiratesId: '784-1988-8888888-8',
      fullNameEnglish: 'Ayesha Yousuf Al Muhairi',
      fullNameArabic: 'عائشة يوسف المهيري',
      nationality: 'UAE',
      dateOfBirth: '1988-08-08',
      gender: 'Female',
      expiryDate: '2038-08-08',
      issueDate: '2033-08-08'
    },
    {
      emiratesId: '784-1989-9999999-9',
      fullNameEnglish: 'Khalid Hamad Al Dhaheri',
      fullNameArabic: 'خالد حمد الظاهري',
      nationality: 'UAE',
      dateOfBirth: '1989-09-09',
      gender: 'Male',
      expiryDate: '2039-09-09',
      issueDate: '2034-09-09'
    },
    {
      emiratesId: '784-1990-0000000-0',
      fullNameEnglish: 'Hessa Salem Al Suwaidi',
      fullNameArabic: 'حصة سالم السويدي',
      nationality: 'UAE',
      dateOfBirth: '1990-10-10',
      gender: 'Female',
      expiryDate: '2040-10-10',
      issueDate: '2035-10-10'
    }
  ];

  const addResult = await Visitor.insertMany(newVisitors);
  console.log('Inserted visitors:', addResult.length);

  await mongoose.disconnect();
}

resetVisitors();
