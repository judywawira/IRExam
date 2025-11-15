const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  examiner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'paused', 'completed'],
    default: 'scheduled'
  },
  currentCaseIndex: {
    type: Number,
    default: 0
  },
  currentImageIndex: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  timeRemaining: {
    type: Number // Seconds remaining
  },
  participants: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
