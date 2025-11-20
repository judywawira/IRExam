const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
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
  examiners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['scheduled', 'active', 'paused', 'completed'],
    default: 'scheduled'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedDate: {
    type: Date
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
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  examinerStudentPairs: [{
    examiner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
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
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
