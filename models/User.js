const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['donor', 'seeker', 'admin'],
    default: 'donor',
  },
  bloodType: {
    type: String,
    // enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    // required: function () {
    //   return this.role === 'donor';
    // }
  },
  location: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  googleId: {
    type: String,
    default: null,
  },
  pushSubscription: {
    type: Object,
    default: null
  },
  emailNotifications: {
    type: Boolean,
    default: true,
  },
  lastDonatedDate: {
    type: Date,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    select: false // Don't return in queries by default
  },
  otpExpires: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
