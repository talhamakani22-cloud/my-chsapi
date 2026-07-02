const mongoose = require('mongoose');

const loginRecordSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  platform: {
    type: String,
    enum: ['web', 'ios', 'android', 'expo'],
    default: 'web'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired'],
    default: 'active'
  },
  ipAddress: {
    type: String,
    default: '0.0.0.0'
  },
  userAgent: {
    type: String
  },
  sessionDuration: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
loginRecordSchema.index({ email: 1, status: 1 });
loginRecordSchema.index({ loginTime: -1 });

// Static method to generate userId
loginRecordSchema.statics.generateUserId = async function() {
  const count = await this.countDocuments();
  return `USR${String(count + 1).padStart(3, '0')}`;
};

// Static method to get statistics
loginRecordSchema.statics.getStats = async function() {
  const records = await this.find();
  
  return {
    totalLogins: records.length,
    activeLogins: records.filter(r => r.status === 'active').length,
    completedLogins: records.filter(r => r.status === 'completed').length,
    uniqueUsers: new Set(records.map(r => r.email)).size,
    platformBreakdown: {
      web: records.filter(r => r.platform === 'web').length,
      ios: records.filter(r => r.platform === 'ios').length,
      android: records.filter(r => r.platform === 'android').length,
    },
    recentLogins: records.slice(-5).reverse(),
  };
};

const LoginRecord = mongoose.model('LoginRecord', loginRecordSchema);

module.exports = LoginRecord;
// LoginRecord model removed for new server setup.
