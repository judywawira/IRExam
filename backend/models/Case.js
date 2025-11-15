const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  clinicalHistory: {
    type: String,
    required: true
  },
  images: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Case', caseSchema);
