const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Case = require('../models/Case');
const { authenticate, authorize } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|dicom|dcm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/dicom';

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Create new case
router.post('/', authenticate, authorize('admin'), upload.array('images', 10), async (req, res) => {
  try {
    const { title, clinicalHistory, discussionPoints } = req.body;

    if (!title || !clinicalHistory) {
      return res.status(400).json({ message: 'Title and clinical history are required' });
    }

    const images = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      description: ''
    })) : [];

    const caseData = {
      title,
      clinicalHistory,
      images,
      createdBy: req.userId
    };

    // Add discussion points if provided
    if (discussionPoints) {
      try {
        const parsedPoints = typeof discussionPoints === 'string'
          ? JSON.parse(discussionPoints)
          : discussionPoints;
        caseData.discussionPoints = parsedPoints;
      } catch (e) {
        console.error('Error parsing discussion points:', e);
      }
    }

    const newCase = new Case(caseData);
    await newCase.save();

    res.status(201).json({
      message: 'Case created successfully',
      case: newCase
    });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ message: 'Server error while creating case' });
  }
});

// Get all cases
router.get('/', authenticate, async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ cases });
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ message: 'Server error while fetching cases' });
  }
});

// Get single case
router.get('/:id', authenticate, async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json({ case: caseItem });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ message: 'Server error while fetching case' });
  }
});

// Update case
router.put('/:id', authenticate, authorize('admin'), upload.array('newImages', 10), async (req, res) => {
  try {
    const { title, clinicalHistory, discussionPoints, imageDescriptions } = req.body;
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    if (title) caseItem.title = title;
    if (clinicalHistory) caseItem.clinicalHistory = clinicalHistory;

    // Update discussion points if provided
    if (discussionPoints) {
      try {
        const parsedPoints = typeof discussionPoints === 'string'
          ? JSON.parse(discussionPoints)
          : discussionPoints;
        caseItem.discussionPoints = parsedPoints;
      } catch (e) {
        console.error('Error parsing discussion points:', e);
      }
    }

    // Update image descriptions if provided
    if (imageDescriptions) {
      try {
        const parsedDescriptions = typeof imageDescriptions === 'string'
          ? JSON.parse(imageDescriptions)
          : imageDescriptions;

        // Update descriptions for existing images
        Object.entries(parsedDescriptions).forEach(([imageId, description]) => {
          const image = caseItem.images.find(img => img._id.toString() === imageId);
          if (image) {
            image.description = description;
          }
        });
      } catch (e) {
        console.error('Error parsing image descriptions:', e);
      }
    }

    // Add new images if provided
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        description: ''
      }));
      caseItem.images.push(...newImages);
    }

    caseItem.updatedAt = Date.now();
    await caseItem.save();

    res.json({
      message: 'Case updated successfully',
      case: caseItem
    });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ message: 'Server error while updating case' });
  }
});

// Delete case
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Delete associated images
    caseItem.images.forEach(image => {
      if (fs.existsSync(image.path)) {
        fs.unlinkSync(image.path);
      }
    });

    await Case.findByIdAndDelete(req.params.id);

    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ message: 'Server error while deleting case' });
  }
});

// Delete specific image from case
router.delete('/:id/images/:imageId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const imageIndex = caseItem.images.findIndex(
      img => img._id.toString() === req.params.imageId
    );

    if (imageIndex === -1) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const image = caseItem.images[imageIndex];

    // Delete file from filesystem
    if (fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }

    caseItem.images.splice(imageIndex, 1);
    caseItem.updatedAt = Date.now();
    await caseItem.save();

    res.json({ message: 'Image deleted successfully', case: caseItem });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Server error while deleting image' });
  }
});

module.exports = router;
