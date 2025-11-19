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
    description: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  discussionPoints: [{
    point: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usageHistory: [{
    examSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
