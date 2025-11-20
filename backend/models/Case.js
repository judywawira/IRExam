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
    // DICOM metadata
    isDicom: {
      type: Boolean,
      default: false
    },
    dicomMetadata: {
      seriesInstanceUID: String,
      studyInstanceUID: String,
      sopInstanceUID: String,
      seriesDescription: String,
      modality: String,
      instanceNumber: Number,
      seriesNumber: Number,
      rows: Number,
      columns: Number
    },
    // Series grouping
    seriesId: String, // For grouping images into series
    instanceNumber: Number, // For ordering within a series
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
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Annotations for the case
  annotations: [{
    imageId: mongoose.Schema.Types.ObjectId, // Reference to image in images array
    imageIndex: Number, // Index of image in images array
    seriesId: String, // Series this annotation belongs to
    instanceNumber: Number, // Instance number within series
    toolType: {
      type: String,
      enum: ['circle', 'arrow', 'freehand', 'rectangle', 'ellipse', 'probe', 'length', 'angle'],
      required: true
    },
    toolData: mongoose.Schema.Types.Mixed, // Cornerstone tool state data
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdByRole: {
      type: String,
      enum: ['examiner', 'student'],
      required: true
    },
    visible: {
      type: Boolean,
      default: true
    },
    createdAt: {
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
