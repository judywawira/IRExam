const fs = require('fs');
const dicomParser = require('dicom-parser');

/**
 * Extract DICOM metadata from a file
 * @param {string} filePath - Path to DICOM file
 * @returns {Object|null} - DICOM metadata or null if not a valid DICOM
 */
function extractDicomMetadata(filePath) {
  try {
    // Read the DICOM file
    const dicomData = fs.readFileSync(filePath);

    // Parse the DICOM file
    const dataSet = dicomParser.parseDicom(dicomData);

    // Helper function to safely get DICOM tag value
    const getTagValue = (tag, defaultValue = '') => {
      try {
        return dataSet.string(tag) || defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    const getTagNumber = (tag, defaultValue = undefined) => {
      try {
        const value = dataSet.string(tag);
        if (!value) return defaultValue;
        const parsed = parseInt(value, 10);
        // Return defaultValue if parsing results in NaN
        return isNaN(parsed) ? defaultValue : parsed;
      } catch (e) {
        return defaultValue;
      }
    };

    // Extract relevant DICOM tags
    const metadata = {
      seriesInstanceUID: getTagValue('x0020000e'),
      studyInstanceUID: getTagValue('x0020000d'),
      sopInstanceUID: getTagValue('x00080018'),
      seriesDescription: getTagValue('x0008103e'),
      modality: getTagValue('x00080060'),
      instanceNumber: getTagNumber('x00200013', 1),
      seriesNumber: getTagNumber('x00200011', 1),
      rows: getTagNumber('x00280010'),
      columns: getTagNumber('x00280011'),
      patientName: getTagValue('x00100010'),
      studyDate: getTagValue('x00080020'),
      studyDescription: getTagValue('x00081030')
    };

    return metadata;
  } catch (error) {
    console.error('Error parsing DICOM file:', error);
    return null;
  }
}

/**
 * Check if a file is a DICOM file by extension or magic number
 * @param {string} filename - Filename to check
 * @param {string} filePath - Optional path to check magic number
 * @returns {boolean}
 */
function isDicomFile(filename, filePath = null) {
  // Check by extension
  const ext = filename.toLowerCase();
  if (ext.endsWith('.dcm') || ext.endsWith('.dicom')) {
    return true;
  }

  // Check by magic number if path provided
  if (filePath) {
    try {
      const buffer = Buffer.alloc(132);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 132, 0);
      fs.closeSync(fd);

      // DICOM files have 'DICM' at byte offset 128
      const dicm = buffer.toString('ascii', 128, 132);
      return dicm === 'DICM';
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Group images by series
 * @param {Array} images - Array of image objects with DICOM metadata
 * @returns {Object} - Object with series grouped by seriesInstanceUID
 */
function groupImagesBySeries(images) {
  const series = {};

  images.forEach(image => {
    if (image.isDicom && image.dicomMetadata && image.dicomMetadata.seriesInstanceUID) {
      const seriesUID = image.dicomMetadata.seriesInstanceUID;

      if (!series[seriesUID]) {
        series[seriesUID] = {
          seriesInstanceUID: seriesUID,
          seriesDescription: image.dicomMetadata.seriesDescription || 'Unnamed Series',
          seriesNumber: image.dicomMetadata.seriesNumber || 0,
          modality: image.dicomMetadata.modality || 'Unknown',
          images: []
        };
      }

      series[seriesUID].images.push(image);
    }
  });

  // Sort images within each series by instance number
  Object.values(series).forEach(s => {
    s.images.sort((a, b) => {
      const aNum = a.dicomMetadata?.instanceNumber || a.instanceNumber || 0;
      const bNum = b.dicomMetadata?.instanceNumber || b.instanceNumber || 0;
      return aNum - bNum;
    });
  });

  return series;
}

/**
 * Generate a series ID from DICOM metadata
 * @param {Object} metadata - DICOM metadata
 * @returns {string} - Series ID
 */
function generateSeriesId(metadata) {
  if (metadata.seriesInstanceUID) {
    return metadata.seriesInstanceUID;
  }
  // Fallback to combining available identifiers
  return `${metadata.studyInstanceUID || 'unknown'}_${metadata.seriesNumber || 0}`;
}

module.exports = {
  extractDicomMetadata,
  isDicomFile,
  groupImagesBySeries,
  generateSeriesId
};
