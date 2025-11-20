const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: function() {
      // Provide a default name based on creation date
      return `Exam Session - ${new Date().toLocaleDateString()}`;
    }
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

// Pre-save hook to ensure name exists
examSessionSchema.pre('save', async function(next) {
  // If name is missing, generate one from exam title or use default
  if (!this.name) {
    if (this.populated('exam')) {
      this.name = `${this.exam.title} - Session`;
    } else if (this.exam) {
      // Populate exam to get title
      const Exam = mongoose.model('Exam');
      const exam = await Exam.findById(this.exam);
      if (exam) {
        this.name = `${exam.title} - Session`;
      } else {
        this.name = `Exam Session - ${new Date().toLocaleDateString()}`;
      }
    } else {
      this.name = `Exam Session - ${new Date().toLocaleDateString()}`;
    }
  }
  next();
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
