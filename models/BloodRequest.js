const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema({
  seekerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
bloodType: {
  type: String,
  enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  required: function () {
    return this.role === 'donor';
  },
  set: function (value) {
    return this.role === 'seeker' ? null : value;
  }
},
  location: {
    type: String,
    required: true,
  },
  locationUrl: {
    type: String,
    required: false,
  },
  patientName: {
    type: String,
    required: false,
  },
  quantity: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ['pending', 'fulfilled'],
    default: 'pending',
  },
  acceptedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

module.exports = BloodRequest;
