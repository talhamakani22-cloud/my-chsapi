const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    unique: true
  },
  cnicId: {
    type: String,
    required: [true, 'CNIC ID is required'],
    trim: true
  },
  fullNameEnglish: {
    type: String,
    required: [true, 'Full name in English is required'],
    trim: true
  },
  fatherName: {
    type: String,
    default: '',
    trim: true
  },
  countryOfStay: {
    type: String,
    default: '',
    trim: true
  },
  houseNumber: {
    type: String,
    default: '',
    trim: true
  },
  nationality: {
    type: String,
    required: [true, 'Nationality is required']
  },
  dateOfBirth: {
    type: String,
    required: [true, 'Date of birth is required']
  },
  entryTime: {
    type: String,
    default: '',
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: [true, 'Gender is required']
  },
  expiryDate: {
    type: String,
    default: ''
  },
  issueDate: {
    type: String,
    default: ''
  },
  scannedImageUri: {
    type: String,
    default: null
  },
  checkInTime: {
    type: Date,
    default: Date.now
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  purposeOfVisit: {
    type: String,
    required: [true, 'Purpose of visit is required'],
    trim: true
  },
  remark: {
    type: String,
    required: [true, 'Remark is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['checked-in', 'checked-out'],
    default: 'checked-in'
  },
  platform: {
    type: String,
    enum: ['web', 'ios', 'android', 'expo'],
    default: 'expo'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries.
visitorSchema.index({ cnicId: 1 });
visitorSchema.index({ status: 1 });
visitorSchema.index({ checkInTime: -1 });
visitorSchema.index({ nationality: 1 });

// Pre-save middleware to generate visitorId
visitorSchema.pre('save', async function() {
  if (!this.visitorId) {
    const count = await this.constructor.countDocuments();
    this.visitorId = `VIS${String(count + 1).padStart(5, '0')}`;
  }
});

// Static method to get visitor statistics
visitorSchema.statics.getStats = async function() {
  const visitors = await this.find();
  const today = new Date().toISOString().split('T')[0];
  const todayVisitors = visitors.filter(v => 
    v.checkInTime.toISOString().startsWith(today)
  );

  // Get top nationalities
  const nationalityCounts = visitors.reduce((acc, v) => {
    acc[v.nationality] = (acc[v.nationality] || 0) + 1;
    return acc;
  }, {});

  const topNationalities = Object.entries(nationalityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nationality, count]) => ({ nationality, count }));

  return {
    totalRecords: visitors.length,
    activeVisitors: visitors.filter(v => v.status === 'checked-in').length,
    checkedOutToday: todayVisitors.filter(v => v.status === 'checked-out').length,
    todayVisitors: todayVisitors.length,
    genderBreakdown: {
      male: visitors.filter(v => v.gender === 'Male').length,
      female: visitors.filter(v => v.gender === 'Female').length,
      other: visitors.filter(v => v.gender === 'Other').length,
    },
    topNationalities,
    recentVisitors: visitors.slice(-5).reverse(),
  };
};

const Visitor = mongoose.model('Visitor', visitorSchema);

module.exports = Visitor;
// Visitor model removed for new server setup.
