# DICOM ZIP Upload and Annotation Features - Integration Guide

This document describes the new features added to support DICOM ZIP file uploads and real-time annotation tools.

## Features Implemented

### 1. ZIP File Upload with DICOM Series Support
- Upload zipped folders containing multiple DICOM files
- Automatic extraction and metadata parsing
- Series grouping and ordering by instance number
- Support for multiple series from one patient

### 2. DICOM Viewer with Annotation Tools
- Circle (Elliptical ROI)
- Arrow annotations
- Rectangle ROI
- Freehand drawing
- Length measurement
- Angle measurement
- Mouse wheel scrolling through DICOM series
- Window/Level adjustment

### 3. Real-time Annotation Synchronization
- Annotations created by examiners are visible to students
- Annotations created by students are visible to examiners
- Real-time sync via Socket.IO
- Persistent storage in MongoDB

## Backend Changes

### Database Schema Updates (`backend/models/Case.js`)

Added to each image in the `images` array:
```javascript
{
  isDicom: Boolean,
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
  seriesId: String,
  instanceNumber: Number
}
```

Added new `annotations` array to Case schema:
```javascript
annotations: [{
  imageId: ObjectId,
  imageIndex: Number,
  seriesId: String,
  instanceNumber: Number,
  toolType: String, // 'circle', 'arrow', 'freehand', etc.
  toolData: Mixed, // Cornerstone tool state data
  createdBy: ObjectId,
  createdByRole: String, // 'examiner' or 'student'
  visible: Boolean,
  createdAt: Date
}]
```

### New Backend Files

1. **`backend/utils/dicomUtils.js`**
   - `extractDicomMetadata(filePath)` - Extracts DICOM tags from a file
   - `isDicomFile(filename, filePath)` - Checks if a file is DICOM
   - `groupImagesBySeries(images)` - Groups images by series UID
   - `generateSeriesId(metadata)` - Generates unique series identifier

2. **Updated `backend/routes/cases.js`**
   - Added ZIP file support to multer configuration
   - `processUploadedFile(file)` - Processes individual files and extracts DICOM metadata
   - `extractZipFile(zipFile)` - Extracts DICOM files from ZIP archives
   - Updated POST and PUT routes to handle ZIP files
   - Added annotation endpoints:
     - `GET /api/cases/:id/annotations` - Get all annotations for a case
     - `POST /api/cases/:id/annotations` - Create new annotation
     - `PUT /api/cases/:id/annotations/:annotationId` - Update annotation
     - `DELETE /api/cases/:id/annotations/:annotationId` - Delete annotation

3. **Updated `backend/socket/examSession.js`**
   - `annotation-added` - Broadcasts new annotations to all session participants
   - `annotation-updated` - Broadcasts annotation updates
   - `annotation-deleted` - Broadcasts annotation deletions

## Frontend Changes

### New Components

1. **`frontend/src/components/DicomViewer.jsx`**

   A complete DICOM viewer component with annotation tools.

   **Props:**
   ```javascript
   {
     images: Array,              // Array of image objects
     currentImageIndex: Number,   // Current image index
     onImageChange: Function,     // Callback when image changes
     caseId: String,             // Case ID for annotations
     isExaminer: Boolean,        // Show annotation tools for examiners
     onAnnotationChange: Function, // Callback when annotation is added/modified
     initialAnnotations: Array,  // Existing annotations to load
     className: String           // CSS classes
   }
   ```

   **Features:**
   - Automatic series detection and grouping
   - Mouse wheel scrolling through series
   - Toolbar with annotation tools (for examiners only)
   - Window/Level adjustment with left-click drag
   - Pan with middle-click drag
   - Zoom with right-click drag

   **Usage Example:**
   ```jsx
   import DicomViewer from '../components/DicomViewer'

   <DicomViewer
     images={currentCase.images}
     currentImageIndex={currentImageIndex - 1}
     caseId={currentCase._id}
     isExaminer={isExaminer}
     onAnnotationChange={handleAnnotationChange}
     initialAnnotations={currentCase.annotations}
     className="w-full h-[60vh]"
   />
   ```

### Updated Components

1. **`frontend/src/components/admin/CaseManager.jsx`**
   - Updated dropzone to accept ZIP files
   - Updated UI text to mention ZIP support

2. **`frontend/src/components/examiner/ExaminerCaseManager.jsx`**
   - Updated dropzone to accept ZIP files
   - Updated UI text to mention ZIP support

## Integration Instructions

### Integrating DicomViewer into ExamSession

To integrate the DicomViewer component into `ExamSession.jsx`, replace the current DICOM rendering sections with the DicomViewer component:

#### 1. Import the component
```javascript
import DicomViewer from '../components/DicomViewer'
```

#### 2. Add annotation state
```javascript
const [annotations, setAnnotations] = useState([])
```

#### 3. Load annotations when case changes
```javascript
useEffect(() => {
  if (currentCase?._id) {
    loadAnnotations()
  }
}, [currentCase?._id])

const loadAnnotations = async () => {
  if (!currentCase?._id) return

  try {
    const response = await axios.get(`/api/cases/${currentCase._id}/annotations`)
    setAnnotations(response.data.annotations || [])
  } catch (error) {
    console.error('Error loading annotations:', error)
  }
}
```

#### 4. Handle annotation changes
```javascript
const handleAnnotationChange = (annotationData) => {
  // Emit socket event for real-time sync
  if (socketRef.current) {
    socketRef.current.emit('annotation-added', {
      sessionId,
      caseId: annotationData.caseId,
      annotation: {
        imageIndex: annotationData.imageIndex,
        seriesId: annotationData.seriesId,
        instanceNumber: annotationData.instanceNumber,
        toolType: activeTool,
        toolData: annotationData.toolData
      }
    })
  }
}
```

#### 5. Listen for annotation events
```javascript
// Add to setupSocket function
socketRef.current.on('annotation-added', (data) => {
  if (data.caseId === currentCase?._id) {
    setAnnotations(prev => [...prev, data.annotation])
  }
})

socketRef.current.on('annotation-updated', (data) => {
  if (data.caseId === currentCase?._id) {
    setAnnotations(prev =>
      prev.map(ann =>
        ann._id === data.annotationId
          ? { ...ann, ...data.updates }
          : ann
      )
    )
  }
})

socketRef.current.on('annotation-deleted', (data) => {
  if (data.caseId === currentCase?._id) {
    setAnnotations(prev =>
      prev.filter(ann => ann._id !== data.annotationId)
    )
  }
})
```

#### 6. Replace DICOM rendering sections

**For Student View (around line 479):**
```javascript
{status !== 'scheduled' && viewMode === 'image' && currentImage && (
  <div className="w-full max-w-6xl">
    {isDicomFile(currentImage.path) ? (
      <DicomViewer
        images={currentCase.images}
        currentImageIndex={currentImageIndex - 1}
        caseId={currentCase._id}
        isExaminer={false}
        initialAnnotations={annotations}
        className="w-full h-[80vh]"
      />
    ) : (
      <img
        src={`/${currentImage.path}`}
        alt="Medical image"
        className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-2xl mx-auto"
      />
    )}
  </div>
)}
```

**For Examiner View (around line 570):**
```javascript
{isDicomFile(currentImage.path) ? (
  <DicomViewer
    images={currentCase.images}
    currentImageIndex={currentImageIndex - 1}
    caseId={currentCase._id}
    isExaminer={true}
    onAnnotationChange={handleAnnotationChange}
    initialAnnotations={annotations}
    className="w-full h-[60vh]"
  />
) : (
  <img
    src={`/${currentImage.path}`}
    alt={currentImage.originalName}
    className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-lg mx-auto"
  />
)}
```

## How to Use

### Uploading ZIP Files with DICOM Series

1. **As Admin or Examiner:**
   - Navigate to Case Manager
   - Click "Create New Case" or edit existing case
   - Drag and drop a ZIP file containing DICOM files
   - The system will:
     - Extract all DICOM files
     - Parse metadata (series UID, instance number, etc.)
     - Group images by series
     - Sort by instance number
     - Delete the original ZIP file

2. **Supported ZIP Structure:**
   ```
   patient_study.zip
   ├── series1/
   │   ├── image1.dcm
   │   ├── image2.dcm
   │   └── image3.dcm
   └── series2/
       ├── image1.dcm
       └── image2.dcm
   ```

### Using Annotation Tools

1. **During Exam Session (Examiner):**
   - Navigate to a DICOM image
   - Select annotation tool from toolbar:
     - **Window/Level** - Adjust image brightness/contrast (default)
     - **Circle** - Draw circular regions of interest
     - **Arrow** - Point to specific areas
     - **Rectangle** - Draw rectangular ROIs
     - **Length** - Measure distances
     - **Angle** - Measure angles
     - **Freehand** - Draw custom shapes
   - Click and drag on the image to create annotations
   - Annotations are automatically saved and synced to students

2. **During Exam Session (Student):**
   - View examiner annotations in real-time
   - Can also create own annotations (if tool access is enabled)
   - Student annotations are visible to examiners

### Scrolling Through DICOM Series

- **Mouse Wheel:** Scroll up/down to navigate through series
- **Keyboard:** Arrow keys (if implemented)
- Series indicator shows current position (e.g., "Image 5 of 45")

## Testing

### Test ZIP Upload
1. Create a ZIP file with multiple DICOM files
2. Upload through Case Manager
3. Verify all DICOMs are extracted
4. Check that metadata is stored correctly
5. Verify images are grouped by series

### Test Annotations
1. Start an exam session
2. As examiner, navigate to DICOM image
3. Create circle annotation
4. Verify student sees the annotation in real-time
5. As student, create arrow annotation
6. Verify examiner sees the annotation
7. Test annotation persistence (refresh page)

### Test Series Scrolling
1. Upload a case with 20+ DICOM images
2. Open in exam session
3. Use mouse wheel to scroll through images
4. Verify smooth navigation
5. Verify instance number ordering is correct

## Dependencies Installed

### Backend
```json
"adm-zip": "^0.5.10",
"dicom-parser": "^1.8.21"
```

### Frontend
```json
"cornerstone-tools": "^6.0.10",
"hammerjs": "^2.0.8"
```

## Known Limitations

1. **Series Selection:** Currently displays the first series only. Multi-series viewer could be added.
2. **3D Rendering:** No MPR (multi-planar reconstruction) support yet.
3. **Advanced Tools:** No measurement calibration or Hounsfield units display.
4. **Performance:** Large series (100+ images) may have loading delays.
5. **Annotation Persistence:** Annotations are tied to image index, not DICOM SOP Instance UID.

## Future Enhancements

1. Series selector dropdown for multi-series cases
2. MPR (coronal, sagittal views)
3. Cine mode for dynamic scrolling
4. Annotation export (PDF reports)
5. DICOM metadata viewer panel
6. Preset window/level values (lung, bone, soft tissue)
7. Measurement calibration
8. Hanging protocols for side-by-side comparison

## Troubleshooting

### ZIP Upload Issues
- **Error: "Only image files and DICOM files allowed"**
  - Ensure ZIP contains only DICOM files
  - Check file extensions (.dcm or .dicom)

- **No images appear after ZIP upload**
  - Verify ZIP contains valid DICOM files with DICM magic number
  - Check server logs for extraction errors

### DICOM Viewer Issues
- **Black screen or "Failed to load DICOM"**
  - Check browser console for CORS errors
  - Verify DICOM file is accessible at the URL
  - Ensure cornerstone-wado-image-loader is configured correctly

- **Annotations not syncing**
  - Check Socket.IO connection status
  - Verify user is authenticated
  - Check browser console for socket errors

### Series Scrolling Issues
- **Mouse wheel doesn't work**
  - Ensure cursor is over the DICOM viewer element
  - Check that StackScrollMouseWheelTool is activated
  - Try clicking on the viewer first to focus

## API Reference

### REST Endpoints

#### Annotations
```
GET    /api/cases/:id/annotations
POST   /api/cases/:id/annotations
PUT    /api/cases/:id/annotations/:annotationId
DELETE /api/cases/:id/annotations/:annotationId
```

### Socket Events

#### Server → Client
```javascript
'annotation-added'   - { caseId, annotation }
'annotation-updated' - { caseId, annotationId, updates }
'annotation-deleted' - { caseId, annotationId }
```

#### Client → Server
```javascript
'annotation-added'   - { sessionId, caseId, annotation }
'annotation-updated' - { sessionId, caseId, annotationId, updates }
'annotation-deleted' - { sessionId, caseId, annotationId }
```

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for backend errors
3. Verify all dependencies are installed
4. Ensure MongoDB schema is updated (restart MongoDB if needed)
