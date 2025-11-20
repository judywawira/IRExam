const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const Case = require('../models/Case');
const { authenticate, authorize } = require('../middleware/auth');
const { extractDicomMetadata, isDicomFile, generateSeriesId } = require('../utils/dicomUtils');

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
  // Accept images, DICOM files, and ZIP files
  const imageTypes = /jpeg|jpg|png|gif/;
  const dicomTypes = /dcm|dicom/;
  const zipTypes = /zip/;
  const extname = path.extname(file.originalname).toLowerCase();

  // Check if it's an image
  const isImage = imageTypes.test(extname.slice(1));
  const isDicom = dicomTypes.test(extname.slice(1));
  const isZip = zipTypes.test(extname.slice(1));

  // Also check MIME type
  const isImageMime = file.mimetype.startsWith('image/');
  const isDicomMime = file.mimetype === 'application/dicom' || extname === '.dcm';
  const isZipMime = file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed';

  if ((isImage && isImageMime) || isDicom || isDicomMime || (isZip && isZipMime)) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files (JPEG, PNG, GIF), DICOM files (.dcm), and ZIP files are allowed. Received: ${file.originalname} with type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for DICOM files and ZIP archives
});

/**
 * Process uploaded file and extract DICOM metadata if applicable
 */
async function processUploadedFile(file) {
  const isDicom = isDicomFile(file.filename, file.path);
  const imageData = {
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    description: '',
    isDicom
  };

  if (isDicom) {
    const metadata = extractDicomMetadata(file.path);
    if (metadata) {
      imageData.dicomMetadata = metadata;
      imageData.seriesId = generateSeriesId(metadata);
      imageData.instanceNumber = metadata.instanceNumber;
    }
  }

  return imageData;
}

/**
 * Extract DICOM files from a ZIP archive
 */
async function extractZipFile(zipFile) {
  const extractedImages = [];

  try {
    const zip = new AdmZip(zipFile.path);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      // Skip directories and hidden files
      if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.name.startsWith('.')) {
        continue;
      }

      // Check if it's a DICOM file
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.dcm' || ext === '.dicom' || !ext) {
        // Extract to a temporary location
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extractedPath = path.join(uploadDir, `${uniqueSuffix}${ext || '.dcm'}`);

        // Write the file
        fs.writeFileSync(extractedPath, entry.getData());

        // Verify it's actually a DICOM file
        if (isDicomFile(entry.name, extractedPath)) {
          const metadata = extractDicomMetadata(extractedPath);

          if (metadata) {
            extractedImages.push({
              filename: path.basename(extractedPath),
              originalName: entry.name,
              path: extractedPath,
              description: '',
              isDicom: true,
              dicomMetadata: metadata,
              seriesId: generateSeriesId(metadata),
              instanceNumber: metadata.instanceNumber
            });
          } else {
            // Not a valid DICOM, delete it
            fs.unlinkSync(extractedPath);
          }
        } else {
          // Not a DICOM file, delete it
          fs.unlinkSync(extractedPath);
        }
      }
    }

    // Delete the original ZIP file
    fs.unlinkSync(zipFile.path);

    // Sort by series and instance number
    extractedImages.sort((a, b) => {
      if (a.seriesId !== b.seriesId) {
        return a.seriesId.localeCompare(b.seriesId);
      }
      return (a.instanceNumber || 0) - (b.instanceNumber || 0);
    });

    return extractedImages;
  } catch (error) {
    console.error('Error extracting ZIP file:', error);
    // Clean up ZIP file on error
    if (fs.existsSync(zipFile.path)) {
      fs.unlinkSync(zipFile.path);
    }
    throw error;
  }
}

// Create new case - Allow both admins and examiners
router.post('/', authenticate, authorize('admin', 'examiner'), upload.array('images', 10), async (req, res) => {
  try {
    const { title, clinicalHistory, discussionPoints } = req.body;

    if (!title || !clinicalHistory) {
      return res.status(400).json({ message: 'Title and clinical history are required' });
    }

    let images = [];

    // Process uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.zip') {
          // Extract DICOM files from ZIP
          const extractedImages = await extractZipFile(file);
          images.push(...extractedImages);
        } else {
          // Process individual file (image or DICOM)
          const imageData = await processUploadedFile(file);
          images.push(imageData);
        }
      }
    }

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
      const newImages = [];

      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.zip') {
          // Extract DICOM files from ZIP
          const extractedImages = await extractZipFile(file);
          newImages.push(...extractedImages);
        } else {
          // Process individual file (image or DICOM)
          const imageData = await processUploadedFile(file);
          newImages.push(imageData);
        }
      }

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

// Get annotations for a case
router.get('/:id/annotations', authenticate, async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json({ annotations: caseItem.annotations || [] });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({ message: 'Server error while fetching annotations' });
  }
});

// Create new annotation
router.post('/:id/annotations', authenticate, async (req, res) => {
  try {
    const { imageIndex, seriesId, instanceNumber, toolType, toolData } = req.body;
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Get image ID if imageIndex is provided
    let imageId = null;
    if (imageIndex !== undefined && caseItem.images[imageIndex]) {
      imageId = caseItem.images[imageIndex]._id;
    }

    const annotation = {
      imageId,
      imageIndex,
      seriesId,
      instanceNumber,
      toolType,
      toolData,
      createdBy: req.userId,
      createdByRole: req.userRole,
      visible: true
    };

    if (!caseItem.annotations) {
      caseItem.annotations = [];
    }

    caseItem.annotations.push(annotation);
    await caseItem.save();

    // Return the newly created annotation
    const newAnnotation = caseItem.annotations[caseItem.annotations.length - 1];

    res.status(201).json({
      message: 'Annotation created successfully',
      annotation: newAnnotation
    });
  } catch (error) {
    console.error('Create annotation error:', error);
    res.status(500).json({ message: 'Server error while creating annotation' });
  }
});

// Update annotation
router.put('/:id/annotations/:annotationId', authenticate, async (req, res) => {
  try {
    const { toolData, visible } = req.body;
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const annotation = caseItem.annotations.id(req.params.annotationId);

    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    // Only allow the creator to edit their annotation
    if (annotation.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only edit your own annotations' });
    }

    if (toolData !== undefined) annotation.toolData = toolData;
    if (visible !== undefined) annotation.visible = visible;

    await caseItem.save();

    res.json({
      message: 'Annotation updated successfully',
      annotation
    });
  } catch (error) {
    console.error('Update annotation error:', error);
    res.status(500).json({ message: 'Server error while updating annotation' });
  }
});

// Delete annotation
router.delete('/:id/annotations/:annotationId', authenticate, async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.id);

    if (!caseItem) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const annotation = caseItem.annotations.id(req.params.annotationId);

    if (!annotation) {
      return res.status(404).json({ message: 'Annotation not found' });
    }

    // Allow deletion by the creator or an admin
    if (annotation.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own annotations' });
    }

    annotation.deleteOne();
    await caseItem.save();

    res.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ message: 'Server error while deleting annotation' });
  }
});

module.exports = router;
