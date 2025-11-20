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
  // Accept images and DICOM files
  const imageTypes = /jpeg|jpg|png|gif/;
  const dicomTypes = /dcm|dicom/;
  const extname = path.extname(file.originalname).toLowerCase();

  // Check if it's an image
  const isImage = imageTypes.test(extname.slice(1));
  const isDicom = dicomTypes.test(extname.slice(1));

  // Also check MIME type
  const isImageMime = file.mimetype.startsWith('image/');
  const isDicomMime = file.mimetype === 'application/dicom' || extname === '.dcm';

  if ((isImage && isImageMime) || isDicom || isDicomMime) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files (JPEG, PNG, GIF) and DICOM files (.dcm) are allowed. Received: ${file.originalname} with type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Create new case - Allow both admins and examiners
router.post('/', authenticate, authorize('admin', 'examiner'), upload.array('images', 10), async (req, res) => {
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

// Get all cases - Admins see all, examiners see only their own
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};

    // If user is an examiner (not admin), only show their own cases
    if (req.userRole === 'examiner') {
      query.createdBy = req.userId;
    }

    const cases = await Case.find(query)
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

// Update case - Admins can edit all, examiners can edit only their own
router.put('/:id', authenticate, authorize('admin', 'examiner'), upload.array('newImages', 10), async (req, res) => {
  try {
    const { title, clinicalHistory, discussionPoints, imageDescriptions } = req.body;
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Check if examiner is trying to edit someone else's case
    if (req.userRole === 'examiner' && caseItem.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only edit cases you created' });
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

// Delete case - Admins can delete all, examiners can delete only their own
router.delete('/:id', authenticate, authorize('admin', 'examiner'), async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Check if examiner is trying to delete someone else's case
    if (req.userRole === 'examiner' && caseItem.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only delete cases you created' });
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

// Delete specific image from case - Admins can delete all, examiners can delete only from their own cases
router.delete('/:id/images/:imageId', authenticate, authorize('admin', 'examiner'), async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Check if examiner is trying to delete image from someone else's case
    if (req.userRole === 'examiner' && caseItem.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only delete images from cases you created' });
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
