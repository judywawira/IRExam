# IRExam - Product Specification Document
## Real-Time Medical Education Examination Platform

**Version:** 1.0
**Last Updated:** 2025-11-22
**Status:** Production Ready

---

## Executive Summary

IRExam is a real-time, synchronized medical education examination platform designed specifically for delivering image-based clinical cases to radiology residents. The system enables examiners to conduct live, synchronized exams where the student views the same medical images the examiner is displaying simultaneously, creating a controlled testing environment for radiology and medical imaging education.

### Key Differentiators
- **Real-time synchronization** - The student and the examiner see identical images at the same time
- **DICOM support** - Full medical imaging format with ZIP upload and annotation tools
- **Multi-user roles** - Admin, Examiner, and Student with distinct capabilities
- **Annotation tools** - Real-time synchronized drawing tools on the images 
- **Session management** - Named sessions with examiner and student pairing support. 
- **Specifications** -  FastAPI implementation with Api documentation and React frontend 

---

## 1. Product Overview

### 1.1 Purpose
IRExam addresses the need for synchronized, controlled examination environments in medical education, particularly for radiology and medical imaging training. It replaces manual image presentation with an automated, synchronized system that ensures the student and examiner experience identical examination conditions.

### 1.2 Target Users
- **Medical Education Administrators** - Manage cases, exams, users, and sessions
- **Medical Examiners/Faculty** - Create cases, conduct live exam sessions, annotate images
- **Medical Residents/Students** - Participate in synchronized examination sessions

### 1.3 Core Value Proposition
- Eliminates timing discrepancies in image-based examinations
- Provides real-time annotation capabilities for teaching
- Supports DICOM medical imaging format with series navigation
- Ensures fair examination conditions for all students
- Enables remote, synchronized medical education

---

## 2. System Architecture

### 2.1 Technology Stack

#### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **State Management:** React Context API
- **HTTP Client:** Axios
- **Real-time:** Socket.IO Client
- **Build Tool:** Vite
- **DICOM Viewer:** Cornerstone.js, Cornerstone Tools
- **File Upload:** React Dropzone
- **UI Components:** Headless UI, Heroicons

#### Backend (Dual Implementation)

**Option 1: Node.js Backend**
- Express.js web framework
- MongoDB with Mongoose ODM
- Socket.IO for real-time communication
- JWT authentication (jsonwebtoken)
- bcryptjs for password hashing
- Multer for file uploads
- dicom-parser for DICOM metadata extraction
- adm-zip for ZIP file processing

**Option 2: FastAPI Backend** (Recommended - More Features)
- FastAPI (Python async web framework)
- MongoDB with Motor (async driver) + Beanie ODM
- Python-SocketIO for real-time features
- JWT authentication (python-jose)
- Passlib with bcrypt for password hashing
- **SHA-256 pre-hashing** for long passwords (handles bcrypt 72-byte limit)
- pydicom for DICOM processing
- Pillow for image manipulation
- Pydantic for data validation

#### Database
- **MongoDB** - NoSQL document database
- Collections: users, cases, exams, examsessions

#### Infrastructure
- Real-time communication via WebSocket (Socket.IO)
- File storage: Local filesystem (configurable to cloud storage)
- DICOM file support with metadata extraction

### 2.2 Architecture Pattern
- **Frontend:** Component-based architecture with React
- **Backend:** RESTful API + WebSocket for real-time
- **Database:** Document-oriented with MongoDB
- **Authentication:** Stateless JWT tokens
- **File Management:** Multipart form uploads with local/cloud storage

### 2.3 System Diagram
```
┌──────────────┐         HTTPS/WSS          ┌──────────────┐
│   Frontend   │◄──────────────────────────►│   Backend    │
│   (React)    │   REST API + Socket.IO     │ (Express/    │
│              │                             │  FastAPI)    │
└──────────────┘                             └──────┬───────┘
                                                    │
                                                    │ MongoDB Driver
                                                    ▼
                                             ┌──────────────┐
                                             │   MongoDB    │
                                             │   Database   │
                                             └──────────────┘
                                                    ▲
                                                    │
                                             ┌──────┴───────┐
                                             │ File Storage │
                                             │  (uploads/)  │
                                             └──────────────┘
```

---

## 3. User Roles and Permissions

### 3.1 Admin
**Purpose:** Full system management

**Capabilities:**
- Create and manage image-based cases with clinical histories
- Upload medical images (JPEG, PNG, GIF, DICOM files, ZIP archives)
- Create exams by selecting multiple cases
- Manage users (approve, archive, delete students and examiners)
- Create and manage exam sessions
- Assign examiners and students to sessions
- Clone exams and sessions
- View all system data

**Access:**
- All API endpoints
- Admin dashboard
- User management panel
- Full CRUD on cases, exams, sessions
- Auto-approved upon registration

### 3.2 Examiner
**Purpose:** Create educational content and conduct exams

**Capabilities:**
- Create and manage their own cases
- Upload medical images and DICOM files
- Create exam sessions from existing exams
- Control live exam sessions in real-time
- Navigate through cases and images (synchronized to all students)
- Start, pause, resume, and end exams
- Use annotation tools on DICOM images (circle, arrow, rectangle, freehand, length, angle)
- Monitor participants in real-time
- View student context and assignment

**Access:**
- Own cases only (create, read, update, delete)
- Read all exams
- Create and manage own sessions
- Real-time exam control
- Annotation tools
- Requires admin approval

### 3.3 Student
**Purpose:** Participate in examinations

**Capabilities:**
- Join assigned exam sessions
- View synchronized images controlled by examiner
- See clinical history, findings, and diagnosis for each case
- View examiner annotations in real-time
- Synchronized countdown timer
- Can create own annotations (visible to examiner)

**Access:**
- Read-only access to assigned sessions
- Join sessions
- View synchronized content
- Full-screen presentation mode (no navigation controls)
- Requires admin approval

### 3.4 User Approval System
- All new users (except admins) start with `isApproved: false`
- Admins auto-approve themselves upon registration
- Examiners and students must be approved by admin
- Unapproved users cannot access protected features
- Middleware checks approval status on all protected routes

---

## 4. Core Features

### 4.1 Case Management

#### 4.1.1 Case Creation
- **Title** (required): Descriptive case name
- **Clinical History** (optional): Patient background and presentation
- **Findings** (optional): Observable findings in images
- **Diagnosis** (optional): Final diagnosis or teaching points
- **Discussion Points** (optional):
  - Case-level discussion points
  - Per-image discussion points (schema ready, UI pending)
- **Multiple Images**: Upload 1-n images per case
- **Image Types**: JPEG, PNG, GIF, DICOM (.dcm), ZIP archives containing DICOM series
- **Image Metadata**:
  - Original filename
  - Description per image
  - DICOM metadata (if applicable)
  - Discussion points per image (schema ready)

#### 4.1.2 DICOM Support
- **Single DICOM Upload**: Upload .dcm files directly
- **ZIP Archive Upload**: Upload ZIP containing multiple DICOM files
  - Automatic extraction
  - Metadata parsing (series UID, instance number, modality, patient ID, study date)
  - Series grouping and ordering
  - Supports multiple series from one study
- **DICOM Viewer Integration**:
  - Cornerstone.js medical image viewer
  - Mouse wheel scrolling through series
  - Window/Level adjustment (brightness/contrast)
  - Series indicator (e.g., "Image 5 of 45")
  - Multi-series support

#### 4.1.3 Image Operations
- **Upload**: Drag-and-drop or click to select
- **Preview**: Thumbnail view in case manager
- **Delete**: Remove specific images from case (hover to reveal delete button)
- **Reorder**: Not yet implemented (future enhancement)
- **Download**: Download original files (especially DICOM)

#### 4.1.4 Case Visibility
- **Examiners**: See only their own cases
- **Admins**: See all cases
- **Students**: Cannot create cases

#### 4.1.5 Usage Tracking
- Cases track which sessions used them
- Usage history stored in `usageHistory` array
- Prevents accidental deletion of cases in active use

### 4.2 Exam Management

#### 4.2.1 Exam Creation (Admin Only)
- **Title** (required): Exam name
- **Description** (optional): Exam purpose/details
- **Case Selection**: Select multiple cases from case library
- **Duration**: Exam duration in minutes (default: 60)
- **Case Ordering**: Cases maintain selection order

#### 4.2.2 Exam Cloning
- **Clone Endpoint**: `POST /api/exams/:id/clone`
- Creates duplicate exam with " (Copy)" suffix
- Copies all case references
- Enables template-based exam creation
- Original exam remains unchanged

#### 4.2.3 Exam Display
- Shows case count
- Shows total images across all cases
- Lists all included cases with thumbnails
- Displays duration

### 4.3 Session Management

#### 4.3.1 Session Creation
**Who can create:**
- Admins (full control)
- Examiners (create own sessions)

**Required Fields:**
- **Session Name** (required): Unique identifier for session
- **Exam Selection** (required): Choose from existing exams
- **Examiner Assignment** (admin only): Assign one or more examiners
- **Student Assignment** (optional): Pre-assign specific students
- **Scheduled Time** (optional): Future start time

**Optional Features:**
- **Multiple Examiners**: Support for team teaching
- **Examiner-Student Pairing**: 1:1 matching for individualized instruction
- **Assigned Students**: Pre-populate participant list

#### 4.3.2 Session Lifecycle
1. **Scheduled** (pending) - Session created, waiting to start
2. **Active** (in_progress) - Exam running, timer active
3. **Paused** - Exam paused, timer stopped
4. **Completed** - Exam ended

#### 4.3.3 Session States
- `status`: scheduled, in_progress, paused, completed
- `currentImageIndex`: Current image being displayed (synchronized)
- `timeRemaining`: Countdown timer in seconds
- `participants`: Array of joined students with join times
- `startedAt`: Timestamp when exam started
- `completedAt`: Timestamp when exam ended

#### 4.3.4 Archive System
- **Smart Delete**: Sessions with assigned students are archived, not deleted
- **Manual Archive**: Admin can manually archive sessions
- **Unarchive**: Restore archived sessions
- **Filter**: Toggle between active and archived session views
- **Preserve Integrity**: Maintains data for reporting and auditing
- **Archive Date**: Timestamp when session was archived

#### 4.3.5 Session Editing (Admin Only)
- Edit scheduled sessions before they start
- Modify session name, exam, examiners, students, pairings
- Cannot edit in-progress or completed sessions

#### 4.3.6 Session Cloning
- Clone existing sessions
- Copy configuration (examiners, students, pairings)
- Enables reusable session templates

### 4.4 Real-Time Exam Execution

#### 4.4.1 Examiner Controls
**Exam Lifecycle Controls:**
- **Start Exam**: Begins exam, starts timer, enables navigation
- **Pause Exam**: Pauses timer, shows pause message to students
- **Resume Exam**: Resumes from pause, continues timer
- **End Exam**: Completes exam, redirects all users to dashboard

**Navigation Controls:**
- **Thumbnail Grid**: Visual navigation of all images in exam
- **Previous Button**: Go to previous image
- **Next Button**: Go to next image
- **Direct Navigation**: Click thumbnail to jump to specific image
- **Case/Image Counter**: Shows current position (e.g., "Case 2, Image 3 of 5")

**Display Controls:**
- **View Mode Toggle**: Switch between clinical history and image view
- **Annotation Tools** (DICOM only):
  - Window/Level (brightness/contrast adjustment)
  - Circle (elliptical ROI)
  - Arrow annotations
  - Rectangle ROI
  - Freehand drawing
  - Length measurement
  - Angle measurement

**Monitoring:**
- **Participant List**: See all joined students in real-time
- **Join Timestamps**: When each student joined
- **Participant Count**: Total number of participants

#### 4.4.2 Student Experience
**Full-Screen Presentation Mode:**
- Clean, distraction-free interface
- No navigation controls (examiner controls all navigation)
- No participant lists or sidebars
- Large, centered content display

**View States:**
1. **Waiting Screen** (`status === 'scheduled'`):
   - "Waiting to Start" message
   - Session name display
   - Exit button only

2. **Clinical History View** (`viewMode === 'history'`):
   - Full clinical history text
   - Large, readable typography
   - Clean background

3. **Image View** (`viewMode === 'image'`):
   - Full-screen image display
   - DICOM viewer (if applicable)
   - No metadata or descriptions visible
   - No case numbers or titles visible

4. **Transition Screen** (between cases):
   - 2-second animated transition
   - "Moving to Next Case" message
   - Visual loading animation
   - Only shown to students (examiners navigate instantly)

**Synchronized Elements:**
- Current image (matches examiner's selection)
- Countdown timer
- Exam status (scheduled, active, paused, completed)
- Annotations (view examiner's annotations in real-time)

**Hidden from Students:**
- Case numbers and titles
- Image descriptions
- Discussion points
- Navigation controls
- Participant lists
- Thumbnail grid

#### 4.4.3 Synchronization Mechanism
**Architecture:**
- Socket.IO WebSocket connections
- Room-based broadcasting
- JWT authentication for socket connections
- State synchronization across all clients

**Socket Event Flow:**
```
EXAMINER ACTION          SOCKET EVENT              ALL PARTICIPANTS
─────────────────        ─────────────             ────────────────
Click Start         →    start-exam          →     exam-started
                         (broadcasts)               status = 'active'

Navigate Thumbnail  →    navigate-image      →     image-changed
                         (broadcasts)               caseIndex = X
                                                   imageIndex = Y

Click Pause         →    pause-exam          →     exam-paused
                         (broadcasts)               status = 'paused'

Click Resume        →    resume-exam         →     exam-resumed
                         (broadcasts)               status = 'active'

Click End           →    end-exam            →     exam-ended
                         (broadcasts)               redirect to dashboard
```

**State Management:**
- Examiner actions emit socket events ONLY
- State updates occur via broadcast to ALL participants (including examiner)
- Ensures perfect synchronization between all users
- Prevents race conditions and state drift

#### 4.4.4 Timer Synchronization
- **Server-side timer**: Authoritative time source
- **Client-side display**: Updates every second
- **Socket broadcasts**: Timer updates sent to all participants
- **Pause/Resume**: Timer stops and restarts correctly
- **Countdown format**: MM:SS display

### 4.5 Annotation System

#### 4.5.1 Annotation Tools (DICOM Images Only)
Available to examiners during exam sessions:

1. **Window/Level** (default tool)
   - Adjust image brightness and contrast
   - Left-click and drag

2. **Circle (Elliptical ROI)**
   - Highlight circular regions of interest
   - Click and drag to create

3. **Arrow**
   - Point to specific anatomical features
   - Click start point, drag to endpoint

4. **Rectangle ROI**
   - Define rectangular regions
   - Click and drag to create

5. **Freehand Drawing**
   - Custom shapes and outlines
   - Click and drag to draw freely

6. **Length Measurement**
   - Measure distances in pixels
   - Click start point, click endpoint
   - Shows measurement value

7. **Angle Measurement**
   - Measure angles
   - Click three points to define angle
   - Shows degree value

#### 4.5.2 Annotation Data Model
```javascript
{
  _id: ObjectId,
  imageId: ObjectId,           // Reference to specific image
  imageIndex: Number,          // Position in exam
  seriesId: String,            // DICOM series UID (if applicable)
  instanceNumber: Number,      // DICOM instance number (if applicable)
  toolType: String,            // 'circle', 'arrow', 'rectangle', etc.
  data: Object,                // Cornerstone tool state data
  createdBy: ObjectId,         // User who created annotation
  createdByName: String,       // User's display name
  createdByRole: String,       // 'examiner' or 'student'
  isVisible: Boolean,          // Visibility toggle
  createdAt: DateTime
}
```

#### 4.5.3 Real-Time Annotation Synchronization
**Socket Events:**
- `annotation-added`: Broadcast new annotation to all participants
- `annotation-updated`: Broadcast annotation modifications
- `annotation-deleted`: Broadcast annotation removal

**Visibility:**
- Examiner annotations: Visible to all students in real-time
- Student annotations: Visible to examiner
- Persistent storage in MongoDB
- Annotations load when navigating to image

**API Endpoints:**
- `GET /api/cases/:id/annotations` - Retrieve all annotations for case
- `POST /api/cases/:id/annotations` - Create new annotation
- `PUT /api/cases/:id/annotations/:annotationId` - Update annotation
- `DELETE /api/cases/:id/annotations/:annotationId` - Delete annotation

### 4.6 User Management (Admin Only)

#### 4.6.1 User Approval Workflow
1. User registers with email, password, name, role
2. Account created with `isApproved: false` (except admins)
3. Admin reviews pending users
4. Admin approves or rejects user
5. Approved users gain full access to role-specific features

#### 4.6.2 User Operations
- **List Users**: Filter by role, approval status, archived status
- **Approve User**: Set `isApproved: true`
- **Revoke Approval**: Set `isApproved: false`
- **Archive User**: Set `isArchived: true` (soft delete)
- **Unarchive User**: Restore from archived status
- **Delete User**: Permanent deletion (use with caution)

#### 4.6.3 Student Management
- View all students
- Approve pending student registrations
- Archive graduated or inactive students
- Assign students to sessions

#### 4.6.4 Examiner Management
- View all examiners
- Approve new examiner accounts
- Assign examiners to sessions
- Create examiner-student pairings

---

## 5. Technical Specifications

### 5.1 Database Schema

#### 5.1.1 User Collection
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (bcrypt hashed, SHA-256 pre-hashed in FastAPI),
  firstName: String (required),
  lastName: String (required),
  role: Enum ['admin', 'examiner', 'student'] (required),
  isApproved: Boolean (default: false, auto-true for admins),
  isArchived: Boolean (default: false),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**Indexes:**
- Unique index on `email`
- Index on `role`
- Index on `isApproved`
- Index on `isArchived`

#### 5.1.2 Case Collection
```javascript
{
  _id: ObjectId,
  title: String (required),
  clinicalHistory: String,
  findings: String,
  diagnosis: String,
  discussionPoints: String,        // Case-level discussion points
  images: [
    {
      id: String,
      filename: String,
      originalName: String,
      path: String,
      mimetype: String,
      size: Number,
      description: String,
      discussionPoints: [          // Per-image discussion points (schema ready, UI pending)
        {
          point: String,
          order: Number
        }
      ],
      isDicom: Boolean,
      dicomMetadata: {
        seriesInstanceUID: String,
        studyInstanceUID: String,
        sopInstanceUID: String,
        seriesDescription: String,
        modality: String,
        instanceNumber: Number,
        seriesNumber: Number,
        patientId: String,
        studyDate: String,
        rows: Number,
        columns: Number
      },
      uploadedAt: DateTime
    }
  ],
  annotations: [
    {
      id: String,
      imageId: ObjectId,
      imageIndex: Number,
      seriesId: String,
      instanceNumber: Number,
      toolType: String,            // 'circle', 'arrow', 'rectangle', 'freehand', 'length', 'angle'
      data: Mixed,                 // Cornerstone tool state data
      createdBy: ObjectId,
      createdByName: String,
      createdByRole: String,       // 'examiner' or 'student'
      isVisible: Boolean,
      createdAt: DateTime
    }
  ],
  usageHistory: [
    {
      sessionId: ObjectId,
      sessionName: String,
      usedAt: DateTime
    }
  ],
  createdBy: ObjectId (ref: User),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**Indexes:**
- Index on `createdBy`
- Index on `createdAt`
- Index on `images.isDicom`

#### 5.1.3 Exam Collection
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String,
  cases: [ObjectId] (ref: Case, required),
  duration: Number (minutes, default: 60),
  createdBy: ObjectId (ref: User),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**Indexes:**
- Index on `createdBy`
- Index on `createdAt`

#### 5.1.4 ExamSession Collection
```javascript
{
  _id: ObjectId,
  name: String (required),                        // Unique session name
  exam: ObjectId (ref: Exam, required),
  examiner: ObjectId (ref: User),                 // Legacy single examiner
  examiners: [ObjectId] (ref: User),              // Multiple examiners support
  assignedStudents: [ObjectId] (ref: User),
  status: Enum ['pending', 'in_progress', 'paused', 'completed'],
  currentImageIndex: Number (default: 0),
  timeRemaining: Number (seconds),
  participants: [
    {
      student: ObjectId (ref: User),
      joinedAt: DateTime,
      currentImageIndex: Number
    }
  ],
  examinerStudentPairs: [                         // For 1-on-1 exam scenarios
    {
      examiner: ObjectId (ref: User),
      student: ObjectId (ref: User)
    }
  ],
  scheduledFor: DateTime,
  startedAt: DateTime,
  completedAt: DateTime,
  isArchived: Boolean (default: false),
  archivedDate: DateTime,
  createdBy: ObjectId (ref: User),
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**Indexes:**
- Index on `exam`
- Index on `examiners`
- Index on `status`
- Index on `isArchived`
- Index on `scheduledFor`
- Index on `createdBy`

### 5.2 API Endpoints

#### 5.2.1 Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, returns JWT token |
| GET | `/api/auth/me` | JWT | Get current authenticated user |

**POST /api/auth/register**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student"  // "admin" | "examiner" | "student"
}
```
Response: `{ "token": "jwt_token", "user": {...} }`

**POST /api/auth/login**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```
Response: `{ "token": "jwt_token", "user": {...} }`

#### 5.2.2 Cases
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cases` | JWT | List all cases (role-filtered) |
| GET | `/api/cases/:id` | JWT | Get single case with images and annotations |
| POST | `/api/cases` | Admin/Examiner | Create case with image uploads (multipart/form-data) |
| PUT | `/api/cases/:id` | Admin/Examiner (owner) | Update case |
| DELETE | `/api/cases/:id` | Admin/Examiner (owner) | Delete case |
| DELETE | `/api/cases/:id/images/:imageId` | Admin/Examiner (owner) | Delete specific image from case |
| GET | `/api/cases/:id/annotations` | JWT | Get all annotations for case |
| POST | `/api/cases/:id/annotations` | JWT | Create annotation |
| PUT | `/api/cases/:id/annotations/:annotationId` | JWT | Update annotation |
| DELETE | `/api/cases/:id/annotations/:annotationId` | JWT | Delete annotation |

**POST /api/cases** (multipart/form-data)
- `title` (required): Case title
- `clinicalHistory`: Clinical history text
- `findings`: Findings text
- `diagnosis`: Diagnosis text
- `discussionPoints`: Discussion points
- `images`: File uploads (JPEG, PNG, GIF, DICOM, ZIP)

#### 5.2.3 Exams
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/exams` | JWT | List all exams |
| GET | `/api/exams/:id` | JWT | Get exam with populated cases |
| POST | `/api/exams` | Admin | Create exam |
| PUT | `/api/exams/:id` | Admin | Update exam |
| POST | `/api/exams/:id/clone` | Admin | Clone exam (creates duplicate) |
| DELETE | `/api/exams/:id` | Admin | Delete exam |

**POST /api/exams**
```json
{
  "title": "Radiology Final Exam 2024",
  "description": "Comprehensive final examination",
  "cases": ["case_id_1", "case_id_2", "case_id_3"],
  "duration": 90
}
```

#### 5.2.4 Sessions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/sessions` | JWT | List sessions (role-filtered) |
| GET | `/api/sessions/:id` | JWT | Get session with full details |
| POST | `/api/sessions` | Examiner/Admin | Create session |
| POST | `/api/sessions/:id/join` | Student | Join session as participant |
| DELETE | `/api/sessions/:id` | Examiner/Admin | Archive session (smart delete) |

**POST /api/sessions**
```json
{
  "name": "Morning Session - Group A",
  "exam": "exam_id",
  "examiner": "user_id",
  "assignedStudents": ["student_id_1", "student_id_2"],
  "scheduledFor": "2024-03-15T09:00:00Z"
}
```

#### 5.2.5 Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin | List users (filterable by role, approval, archived) |
| GET | `/api/admin/examiners` | Admin | List all examiners |
| PATCH | `/api/admin/users/:id/approve` | Admin | Approve user |
| PATCH | `/api/admin/users/:id/revoke` | Admin | Revoke user approval |
| PATCH | `/api/admin/users/:id/archive` | Admin | Archive user (soft delete) |
| PATCH | `/api/admin/users/:id/unarchive` | Admin | Unarchive user |
| DELETE | `/api/admin/users/:id` | Admin | Delete user permanently |
| POST | `/api/admin/sessions` | Admin | Create session with full control |
| GET | `/api/admin/sessions` | Admin | List all sessions (with archived filter) |
| PATCH | `/api/admin/sessions/:id` | Admin | Update session details |
| PATCH | `/api/admin/sessions/:id/assign-examiner` | Admin | Assign examiner to session |
| PATCH | `/api/admin/sessions/:id/assign-students` | Admin | Assign students to session |
| DELETE | `/api/admin/sessions/:id` | Admin | Archive session |
| PATCH | `/api/admin/sessions/:id/archive` | Admin | Manually archive session |
| PATCH | `/api/admin/sessions/:id/unarchive` | Admin | Restore archived session |
| POST | `/api/admin/sessions/:id/clone` | Admin | Clone session with configuration |

**Query Parameters for GET /api/admin/users**
- `role`: Filter by role (admin/examiner/student)
- `isApproved`: Filter by approval status (true/false)
- `isArchived`: Filter by archived status (true/false)

**Query Parameters for GET /api/admin/sessions**
- `archived`: Filter by archived status (true/false)

### 5.3 Socket.IO Events

#### 5.3.1 Connection
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});
```

#### 5.3.2 Client → Server Events
| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId }` | Join exam session room |
| `start-exam` | `{ sessionId }` | Start exam (examiner only) |
| `pause-exam` | `{ sessionId }` | Pause exam (examiner only) |
| `resume-exam` | `{ sessionId }` | Resume exam (examiner only) |
| `navigate-image` | `{ sessionId, caseIndex, imageIndex }` | Navigate to specific image (examiner only) |
| `update-timer` | `{ sessionId, timeRemaining }` | Update countdown timer |
| `end-exam` | `{ sessionId }` | End exam (examiner only) |
| `annotation-added` | `{ sessionId, caseId, annotation }` | Add annotation |
| `annotation-updated` | `{ sessionId, caseId, annotationId, updates }` | Update annotation |
| `annotation-deleted` | `{ sessionId, caseId, annotationId }` | Delete annotation |

#### 5.3.3 Server → Client Events
| Event | Payload | Description |
|-------|---------|-------------|
| `session-state` | `{ status, currentImageIndex, timeRemaining }` | Initial session state on join |
| `exam-started` | `{ status }` | Exam has started |
| `exam-paused` | `{ status }` | Exam paused |
| `exam-resumed` | `{ status }` | Exam resumed |
| `image-changed` | `{ caseIndex, imageIndex }` | Current image changed |
| `timer-update` | `{ timeRemaining }` | Timer countdown update |
| `exam-ended` | `{ status }` | Exam has ended |
| `annotation-added` | `{ caseId, annotation }` | New annotation added |
| `annotation-updated` | `{ caseId, annotationId, updates }` | Annotation updated |
| `annotation-deleted` | `{ caseId, annotationId }` | Annotation deleted |
| `error` | `{ message }` | Error message |

### 5.4 File Upload System

#### 5.4.1 Supported File Types
- **Images**: JPEG, JPG, PNG, GIF
- **Medical Imaging**: DICOM (.dcm, .dicom)
- **Archives**: ZIP files containing DICOM series

#### 5.4.2 File Validation
**Backend (Node.js):**
```javascript
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif/;
  const dicomTypes = /dcm|dicom/;
  const extname = path.extname(file.originalname).toLowerCase();

  const isImage = imageTypes.test(extname.slice(1));
  const isDicom = dicomTypes.test(extname.slice(1));
  const isImageMime = file.mimetype.startsWith('image/');
  const isDicomMime = file.mimetype === 'application/dicom';

  if ((isImage && isImageMime) || isDicom || isDicomMime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF) and DICOM files are allowed'));
  }
};
```

#### 5.4.3 File Size Limits
- **Maximum file size**: 500MB (configurable)
- Handles large DICOM series in ZIP format

#### 5.4.4 Storage
- **Development**: Local filesystem (`./uploads` directory)
- **Production**: Configurable to cloud storage (AWS S3, Google Cloud Storage, Azure Blob Storage)

#### 5.4.5 File Naming
- Unique filename generation: `{timestamp}-{random_string}.{extension}`
- Prevents filename collisions
- Preserves original filename in database

#### 5.4.6 DICOM Processing
**ZIP Archive Processing:**
1. Upload ZIP file
2. Extract to temporary directory
3. Scan for .dcm files recursively
4. Parse DICOM metadata for each file
5. Group by series UID
6. Order by instance number
7. Save individual DICOM files
8. Delete ZIP archive
9. Store metadata in database

**DICOM Metadata Extraction:**
- Uses `dicom-parser` (Node.js) or `pydicom` (FastAPI)
- Extracts:
  - Series Instance UID
  - Study Instance UID
  - SOP Instance UID
  - Series Description
  - Modality
  - Instance Number
  - Series Number
  - Patient ID
  - Study Date
  - Image dimensions (rows, columns)

### 5.5 Security Features

#### 5.5.1 Authentication
- **JWT (JSON Web Tokens)**: Stateless authentication
- **Token Expiration**: 7-day default (configurable)
- **Bearer Token**: Sent in `Authorization: Bearer {token}` header
- **Password Requirements**: Minimum 6 characters (configurable)

#### 5.5.2 Password Security
**Node.js Backend:**
- bcryptjs with salt rounds
- Plain bcrypt hashing

**FastAPI Backend (Enhanced):**
- **SHA-256 Pre-hashing**: Passwords are pre-hashed with SHA-256 before bcrypt
- **Reason**: bcrypt has a 72-byte input limit; SHA-256 pre-hash ensures passwords >72 bytes work correctly
- **Passlib with bcrypt**: Industry-standard password hashing with salt
- **Implementation**:
  ```python
  # Pre-hash with SHA-256
  password_hash = hashlib.sha256(password.encode()).hexdigest()
  # Hash with bcrypt
  hashed = pwd_context.hash(password_hash)
  ```

#### 5.5.3 Authorization
- **Role-Based Access Control (RBAC)**: Three distinct roles with different permissions
- **Middleware Checks**:
  - JWT verification on protected routes
  - Role authorization (admin-only, examiner-only, etc.)
  - User approval status check
  - Resource ownership validation (examiners can only edit own cases)

#### 5.5.4 API Security
- **CORS Configuration**: Cross-Origin Resource Sharing enabled (configured for production)
- **Input Validation**: Pydantic models (FastAPI) or manual validation (Node.js)
- **SQL Injection Prevention**: MongoDB's document model prevents SQL injection
- **XSS Prevention**: React's auto-escaping of JSX
- **File Upload Validation**: File type, size, and extension checks

#### 5.5.5 Socket.IO Security
- **Authentication**: JWT token required in auth object for WebSocket connections
- **Room Isolation**: Users only receive events for sessions they've joined
- **Authorization**: Server-side checks for examiner-only actions (start, navigate, end)

#### 5.5.6 Additional Security Measures
- **Archived User Handling**: Archived users excluded from active operations
- **Session Isolation**: Students cannot navigate or control sessions
- **Static File Access**: Only uploaded files in `/uploads` are publicly accessible
- **Environment Variables**: Sensitive config (JWT secret, DB URI) in `.env`

---

## 6. User Interface Specifications

### 6.1 Design Principles
- **Clean and Professional**: Medical education context requires professional appearance
- **Full-Screen Modes**: Exam sessions use full-screen presentation for students
- **Accessibility**: High contrast, readable fonts, keyboard navigation support
- **Responsive**: Works on desktop (primary), tablet (secondary), mobile (limited)
- **Real-Time Feedback**: Loading states, success/error messages, live updates

### 6.2 Color Scheme (Tailwind CSS)
- **Primary**: Blue shades (medical theme)
- **Success**: Green shades
- **Warning**: Yellow/Orange shades
- **Danger**: Red shades
- **Neutral**: Gray shades
- **Background**: White (light mode), Dark gray (exam mode)

### 6.3 Typography
- **Font Family**: System font stack (sans-serif)
- **Headers**: Bold, larger sizes (text-xl, text-2xl, text-3xl)
- **Body**: Regular weight, readable size (text-base, text-sm)
- **Code/Monospace**: Not used in this application

### 6.4 Layout Structure

#### 6.4.1 Admin Dashboard
**Layout:**
- Top navigation bar with tabs:
  - Manage Cases
  - Manage Exams
  - Manage Sessions
  - Student Manager
  - Examiner Manager
- Content area with tab-specific components
- Logout button in header

**Components:**
- CaseManager: Create, edit, delete cases; upload images
- ExamManager: Create, edit, delete, clone exams
- SessionManager: Create, edit, delete, archive, clone sessions
- StudentManager: Approve, archive, delete students
- ExaminerManager: Approve, archive, delete examiners

#### 6.4.2 Examiner Dashboard
**Layout:**
- Header with user info and logout
- "My Cases" section with create/edit/delete
- "Available Exams" section (read-only)
- "Create Session" form
- "My Sessions" list with start/delete actions

#### 6.4.3 Student Dashboard
**Layout:**
- Header: "My Exam Sessions"
- Session cards showing:
  - Session name (primary)
  - Exam title (secondary)
  - Status badge (pending, active, completed)
  - Scheduled time (if applicable)
  - Join button (for pending/active sessions)
- Clean, card-based design

#### 6.4.4 Exam Session (Examiner View)
**Layout:**
- **Header Bar**:
  - Session name
  - Status indicator (Scheduled / Active / Paused / Completed)
  - Countdown timer
  - Exit button

- **Left Sidebar** (collapsible):
  - Participant list with join timestamps
  - Participant count

- **Main Content Area**:
  - **Top Section**: Control buttons (Start, Pause, Resume, End)
  - **Middle Section**: Image display or clinical history
    - Case/image counter
    - View mode toggle (History / Image)
    - DICOM viewer with annotation tools (if DICOM)
    - Standard image display (if JPEG/PNG/GIF)
  - **Bottom Section**: Metadata display
    - Case title
    - Image description
    - Discussion points

- **Right Sidebar**: Thumbnail grid
  - All images in exam
  - Click to navigate
  - Current image highlighted
  - Case grouping visual

#### 6.4.5 Exam Session (Student View)
**Full-Screen Presentation Mode:**
- **Header Bar** (minimal):
  - Session name
  - Status indicator
  - Countdown timer
  - Exit button only

- **Content Area** (full screen):
  - **Waiting State**: "Waiting to Start" message with animated icon
  - **Transition State**: "Moving to Next Case" animation (2 seconds)
  - **History View**: Full-screen clinical history text
  - **Image View**: Full-screen image or DICOM viewer
  - No sidebars, no navigation controls, no metadata

### 6.5 Component Specifications

#### 6.5.1 CaseManager Component
**Features:**
- Case list with search/filter
- Create new case form:
  - Title input
  - Clinical history textarea
  - Findings textarea
  - Diagnosis textarea
  - Discussion points textarea
  - Image dropzone (drag-and-drop or click)
  - Image preview grid with delete buttons (hover to reveal)
- Edit case modal (same fields)
- Delete confirmation dialog
- Image deletion (individual images)

#### 6.5.2 ExamManager Component
**Features:**
- Exam list with case counts
- Create new exam form:
  - Title input
  - Description textarea
  - Duration input (minutes)
  - Case selector (multi-select with checkboxes)
- Clone button with confirmation
- Edit exam modal
- Delete confirmation dialog

#### 6.5.3 SessionManager Component
**Features:**
- Session list with filters (active/archived toggle)
- Create new session form:
  - Session name input (required)
  - Exam selector dropdown
  - Examiner selector (multi-select for admin)
  - Student assignment (multi-select checkboxes)
  - Scheduled time picker (optional)
  - Examiner-student pairing interface (optional)
- Edit session modal (scheduled sessions only)
- Clone button with confirmation
- Archive/Unarchive toggle
- Delete (smart: archives if students assigned)

#### 6.5.4 DicomViewer Component
**Features:**
- Cornerstone.js integration
- Toolbar with annotation tools (examiner only)
- Window/Level adjustment (left-click drag)
- Pan tool (middle-click drag)
- Zoom tool (right-click drag)
- Mouse wheel scrolling through series
- Series indicator (e.g., "Image 5 of 45")
- Annotation rendering (real-time sync)
- Tool state management

**Props:**
```javascript
{
  images: Array,              // Array of image objects
  currentImageIndex: Number,   // Current image index
  onImageChange: Function,     // Callback when image changes
  caseId: String,             // Case ID for annotations
  isExaminer: Boolean,        // Show annotation tools
  onAnnotationChange: Function, // Callback for annotation events
  initialAnnotations: Array,  // Existing annotations to load
  className: String           // CSS classes
}
```

### 6.6 User Flows

#### 6.6.1 Admin Workflow
1. Login as admin
2. **Create Cases**:
   - Go to "Manage Cases" tab
   - Click "Create New Case"
   - Fill in case details
   - Upload images (JPEG, PNG, DICOM, ZIP)
   - Submit
3. **Create Exam**:
   - Go to "Manage Exams" tab
   - Click "Create New Exam"
   - Enter title, description, duration
   - Select cases from library
   - Submit
4. **Manage Users**:
   - Go to "Student Manager" or "Examiner Manager"
   - Review pending users
   - Approve or archive users
5. **Create Session**:
   - Go to "Manage Sessions" tab
   - Click "Create New Session"
   - Enter session name
   - Select exam
   - Assign examiners and students
   - Set scheduled time (optional)
   - Submit

#### 6.6.2 Examiner Workflow
1. Login as examiner
2. **Create Cases** (optional):
   - Go to "My Cases"
   - Create new case with images
3. **Create Session**:
   - Select exam from dropdown
   - Click "Create Session"
   - Enter session name
   - Optionally assign students
4. **Start Exam**:
   - Click "Start" on session
   - Click "Start Exam" button
   - Navigate through images using thumbnails or prev/next
   - Toggle between history and image views
   - Use annotation tools on DICOM images
   - Pause/Resume as needed
   - End exam when complete
5. Students are synchronized to examiner's navigation

#### 6.6.3 Student Workflow
1. Login as student
2. View "My Exam Sessions" dashboard
3. **Join Session**:
   - Find assigned session (pending or active)
   - Click "Join Session"
   - Wait for examiner to start (if pending)
4. **During Exam**:
   - View synchronized images
   - Read clinical history when shown
   - See case transition animations
   - Monitor countdown timer
   - No navigation control (examiner controls all)
5. **Exam Ends**:
   - Redirected to dashboard automatically

---

## 7. Error Handling & Corrections Made

### 7.1 Critical Issues Fixed

#### 7.1.1 WebSocket Synchronization (FIXED)
**Problem**: Student views not updating when examiner navigates through cases and images.

**Root Cause**:
- Frontend was updating local state immediately without waiting for socket broadcasts
- Status state was managed with `isRunning` derived value instead of direct `status` state
- Image navigation was emitting socket events AFTER updating local state
- Socket event handlers weren't properly updating all required state

**Solution**:
- Separated `status` state from `isRunning` derived value
- Socket events now directly update `status` ('scheduled', 'active', 'paused', 'completed')
- `navigateToImage()` now ONLY emits socket events - updates happen via broadcast
- All participants (including examiner) receive `image-changed` event
- Proper state management flow: Action → Socket Emit → Broadcast → State Update

**Files Changed**: `frontend/src/pages/ExamSession.jsx`

#### 7.1.2 Button State Management (FIXED)
**Problem**: Start button remained visible after starting exam, buttons not updating based on status.

**Solution**:
- Conditional rendering based on `status` state
- `status === 'scheduled'` → Show "Start Exam" button
- `status === 'active'` → Show "Pause Exam" + "End Exam" buttons
- `status === 'paused'` → Show "Resume Exam" + "End Exam" buttons
- Status updates properly from socket events

#### 7.1.3 Student View - Complete Redesign (FIXED)
**Problem**:
- Students saw participant lists and navigation controls
- Cluttered interface with metadata
- Showed exam name instead of session name

**Solution**:
- Completely separate student view from examiner view
- Full-screen presentation mode:
  - Clean header with session name, status, timer, exit button
  - No sidebars or participant lists
  - No navigation controls (Previous/Next removed)
  - Large, centered content display
- Three view states for students:
  1. `status === 'scheduled'` → "Waiting to Start" screen
  2. `viewMode === 'history'` → Clinical history display
  3. `viewMode === 'image'` → Full-screen image display
  4. `viewMode === 'transition'` → Animated transition between cases

#### 7.1.4 Session Labeling (FIXED)
**Problem**: Students saw exam titles instead of session names.

**Solution**:
- Updated StudentDashboard to show `session.name` as primary title
- Exam title shown as secondary information
- Updated all messages to say "session" instead of "exam"
- Page title changed from "My Exams" to "My Exam Sessions"

**Files Changed**: `frontend/src/pages/StudentDashboard.jsx`

#### 7.1.5 DICOM File Upload and Display (FIXED)
**Problem**: DICOM (.dcm) files upload successfully but don't display because browsers cannot render DICOM format natively.

**Solution Implemented**: Graceful handling with download option
- Improved file filter validation (backend)
- DICOM detection by extension
- Shows professional DICOM placeholder with:
  - Large document icon
  - "DICOM Medical Image" heading
  - Explanation message
  - Download button
  - File name display
- Users can download and view in external DICOM software

**Files Changed**:
- `backend/routes/cases.js` - Improved DICOM file filter
- `frontend/src/pages/ExamSession.jsx` - Added DICOM detection and download UI

**Future Enhancement**: Full in-browser DICOM viewing with Cornerstone.js (already integrated for annotation features)

#### 7.1.6 Password Hashing - bcrypt 72-byte Limit (FIXED - FastAPI Only)
**Problem**: bcrypt has a 72-byte input limit; passwords longer than 72 bytes get truncated, causing security issues.

**Solution**: SHA-256 pre-hashing before bcrypt
- Passwords are pre-hashed with SHA-256 (produces 64-character hex string)
- SHA-256 hash is then hashed with bcrypt
- Ensures passwords of any length are handled correctly
- Implemented in FastAPI backend only

**Implementation**:
```python
import hashlib
password_hash = hashlib.sha256(password.encode()).hexdigest()
hashed = pwd_context.hash(password_hash)
```

**Files Changed**: `backend-fastapi/app/routes/auth.py`

#### 7.1.7 MongoDB Compatibility (FIXED)
**Problem**: Deprecated MongoDB driver options causing warnings.

**Solution**:
- Updated to MongoDB Driver v4.0.0+
- Removed deprecated options `useNewUrlParser` and `useUnifiedTopology`
- Updated dependencies:
  - `beanie >= 1.27.0`
  - `motor >= 3.6.0`
  - `pymongo >= 4.6.0`

**Files Changed**: `backend-fastapi/requirements.txt`

#### 7.1.8 Image Deletion in Case Edit (ALREADY WORKING)
**Status**: Already implemented, no action needed

**Location**: `/frontend/src/components/admin/CaseManager.jsx`

**How it works**:
- When editing a case, hover over any existing image
- A red "Delete" button appears in the top-right corner
- Click to delete the image from the case
- The deletion calls `DELETE /api/cases/:caseId/images/:imageId`
- Image is removed from both database and filesystem

### 7.2 Known Limitations

1. **DICOM Series Selection**: Currently displays the first series only. Multi-series viewer could be added.
2. **Image-Level Discussion Points**: Database schema complete, UI implementation pending.
3. **Image Reordering**: Not yet implemented (cases maintain upload order).
4. **Student Answer Submission**: Not yet implemented.
5. **Automated Grading**: Not yet implemented.
6. **Session Recording/Playback**: Not yet implemented.

---

## 8. Deployment Requirements

### 8.1 Prerequisites

#### Development Environment
- **Node.js**: v18+ and npm
- **Python**: 3.9+ (for FastAPI backend)
- **MongoDB**: 4.4+
- **Operating System**: Linux, macOS, or Windows

#### Production Environment
- **Node.js**: v18+ LTS
- **Python**: 3.9+
- **MongoDB**: 4.4+ (recommend MongoDB Atlas for cloud)
- **Reverse Proxy**: Nginx or Apache (for SSL/TLS)
- **Process Manager**: PM2 (Node.js) or Supervisor (Python)
- **Cloud Storage**: AWS S3, Google Cloud Storage, or Azure Blob Storage (optional)

### 8.2 Backend Setup (FastAPI - Recommended)

```bash
cd backend-fastapi
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run server
uvicorn main:socket_app --host 0.0.0.0 --port 5000 --reload
```

**Environment Variables** (.env):
```env
MONGODB_URI=mongodb://localhost:27017/irexam
JWT_SECRET=your_secure_random_string_here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000"]
```

### 8.3 Backend Setup (Node.js - Alternative)

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run server
npm run dev
```

**Environment Variables** (.env):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/irexam
JWT_SECRET=your_secure_random_string_here
NODE_ENV=development
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:3000
```

### 8.4 Frontend Setup

```bash
cd frontend
npm install

# Create .env file (optional)
VITE_API_URL=http://localhost:5000

# Run development server
npm run dev

# Build for production
npm run build
```

### 8.5 MongoDB Setup

**Local Development:**
```bash
# Install MongoDB Community Edition
# macOS with Homebrew:
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian:
sudo apt-get install mongodb
sudo systemctl start mongod

# Windows: Download installer from mongodb.com
```

**Production (MongoDB Atlas):**
1. Create account at mongodb.com/atlas
2. Create cluster
3. Create database user
4. Whitelist IP addresses
5. Get connection string
6. Update MONGODB_URI in .env

### 8.6 Production Deployment

#### 8.6.1 Frontend Build
```bash
cd frontend
npm run build
# Outputs to dist/ directory
```

Serve `dist/` with:
- Nginx static file serving
- Express.js static middleware
- Vercel, Netlify, or AWS S3 + CloudFront

#### 8.6.2 Backend Deployment (FastAPI)
**Using Uvicorn + Supervisor:**
```bash
# Install supervisor
sudo apt-get install supervisor

# Create supervisor config: /etc/supervisor/conf.d/irexam.conf
[program:irexam]
command=/path/to/venv/bin/uvicorn main:socket_app --host 0.0.0.0 --port 5000 --workers 4
directory=/path/to/backend-fastapi
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
```

**Using Gunicorn + Uvicorn Workers:**
```bash
gunicorn main:socket_app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000
```

#### 8.6.3 Backend Deployment (Node.js)
**Using PM2:**
```bash
npm install -g pm2

# Start server
pm2 start server.js --name irexam-backend

# Save process list
pm2 save

# Auto-start on reboot
pm2 startup
```

#### 8.6.4 Nginx Configuration
```nginx
server {
    listen 80;
    server_name irexam.example.com;

    # Frontend
    location / {
        root /var/www/irexam/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploaded files
    location /uploads {
        proxy_pass http://localhost:5000/uploads;
    }
}
```

#### 8.6.5 SSL/TLS (Let's Encrypt)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d irexam.example.com
```

### 8.7 Cloud Storage Configuration (Optional)

**AWS S3 Example:**
```python
# backend-fastapi/app/utils/storage.py
import boto3

s3_client = boto3.client('s3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET_KEY')
)

def upload_to_s3(file_path, bucket, key):
    s3_client.upload_file(file_path, bucket, key)
    return f"https://{bucket}.s3.amazonaws.com/{key}"
```

Update file upload routes to use S3 instead of local storage.

### 8.8 Environment-Specific Configuration

**Production .env:**
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/irexam
JWT_SECRET=very_secure_random_string_change_this
UPLOAD_DIR=/var/www/irexam/uploads
FRONTEND_URL=https://irexam.example.com
CORS_ORIGINS=["https://irexam.example.com"]
```

### 8.9 Monitoring and Logging

**Recommended Tools:**
- **Logging**: Winston (Node.js), Python logging module
- **Monitoring**: PM2 monitoring, New Relic, Datadog
- **Error Tracking**: Sentry
- **Uptime Monitoring**: UptimeRobot, Pingdom

---

## 9. Testing Strategy

### 9.1 Unit Testing
- **Backend**: Jest (Node.js) or Pytest (FastAPI)
- **Frontend**: Vitest + React Testing Library
- **Coverage Target**: 80%+

### 9.2 Integration Testing
- Test API endpoints with real MongoDB test database
- Test Socket.IO events and broadcasts
- Test file upload and DICOM processing

### 9.3 End-to-End Testing
- **Tool**: Playwright or Cypress
- **Scenarios**:
  - Admin creates case, exam, session
  - Examiner starts session
  - Student joins and views synchronized images
  - Real-time synchronization across multiple browsers
  - Annotation creation and synchronization

### 9.4 Manual Testing Checklist

**Synchronization Testing:**
- [ ] Create session with multiple students
- [ ] Examiner starts exam
- [ ] Verify student view changes from "Waiting to Start" to showing content
- [ ] Examiner navigates through thumbnails
- [ ] Verify student view updates in real-time
- [ ] Examiner pauses exam
- [ ] Verify student sees pause message
- [ ] Examiner resumes exam
- [ ] Verify student view resumes
- [ ] Examiner ends exam
- [ ] Verify both examiner and student redirect to dashboard

**Student View Testing:**
- [ ] Student logs in and sees "My Exam Sessions"
- [ ] Session cards show session name (not exam name)
- [ ] Student joins session before it starts
- [ ] Verify "Waiting to Start" screen displays
- [ ] Verify no navigation controls visible
- [ ] Verify no participants sidebar visible
- [ ] Verify full-screen presentation mode
- [ ] Verify case transition screen appears between cases
- [ ] Verify clinical history displays properly
- [ ] Verify images display full-screen

**DICOM Testing:**
- [ ] Upload .dcm file → Should succeed
- [ ] Upload ZIP with multiple DICOM files → Should extract and display
- [ ] Add DICOM case to exam session → Should show download option
- [ ] Test DICOM viewer with annotation tools (examiner)
- [ ] Test mouse wheel scrolling through series
- [ ] Test annotation synchronization (examiner → student)

**User Management Testing:**
- [ ] Register new student → Requires approval
- [ ] Admin approves student → Student gains access
- [ ] Archive user → User excluded from session assignment
- [ ] Delete user → Permanent removal

---

## 10. Future Enhancements

### 10.1 High Priority
- [ ] **Student Answer Submission**: Allow students to submit answers during exam
- [ ] **Automated Grading**: Score submissions based on predefined answers
- [ ] **Analytics and Reporting**: Generate performance reports for students
- [ ] **Image-Level Discussion Points UI**: Complete the UI for per-image discussion points
- [ ] **Image Reordering**: Drag-and-drop reordering in case manager

### 10.2 Medium Priority
- [ ] **Multiple Choice Questions**: Add MCQ support alongside image cases
- [ ] **Export Results**: Export exam results to PDF or Excel
- [ ] **Email Notifications**: Notify students of scheduled sessions
- [ ] **Session Recordings**: Record exam sessions for playback
- [ ] **Mobile Responsive Improvements**: Better tablet and mobile support
- [ ] **DICOM MPR (Multi-Planar Reconstruction)**: Coronal, sagittal, axial views
- [ ] **DICOM Cine Mode**: Automatic scrolling through series

### 10.3 Low Priority
- [ ] **Annotation Export**: Export annotations to PDF reports
- [ ] **DICOM Metadata Viewer Panel**: Show DICOM tags in sidebar
- [ ] **Preset Window/Level Values**: Quick presets for lung, bone, soft tissue
- [ ] **Measurement Calibration**: Real-world measurements in mm/cm
- [ ] **Hanging Protocols**: Side-by-side comparison of multiple series
- [ ] **Chat Feature**: Real-time chat between examiner and students
- [ ] **Screen Sharing**: Examiner can share screen during exam
- [ ] **Whiteboard**: Shared drawing canvas for teaching

---

## 11. Support and Maintenance

### 11.1 Documentation
- **README.md**: Installation and setup
- **API_DOCUMENTATION.md**: Complete API reference (FastAPI backend)
- **DICOM_FEATURES_INTEGRATION.md**: DICOM and annotation features
- **PRODUCT_SPECIFICATION.md**: This document

### 11.2 Issue Tracking
- Use GitHub Issues for bug reports and feature requests
- Tag issues with labels: bug, enhancement, documentation, etc.

### 11.3 Version Control
- **Git**: Main repository
- **Branching Strategy**:
  - `main`: Production-ready code
  - `develop`: Development branch
  - `feature/*`: Feature branches
  - `bugfix/*`: Bug fix branches

### 11.4 Release Process
1. Update version number in package.json
2. Update CHANGELOG.md
3. Create git tag (e.g., v1.0.0)
4. Build and test
5. Deploy to production
6. Monitor for errors

---

## 12. Appendices

### 12.1 Glossary
- **Case**: A medical case with images, clinical history, and teaching points
- **Exam**: A collection of cases with a duration
- **Session**: An instance of an exam being delivered to students
- **DICOM**: Digital Imaging and Communications in Medicine format
- **ROI**: Region of Interest
- **Annotation**: Drawing or measurement on an image
- **Synchronization**: Real-time updating of all student views to match examiner

### 12.2 References
- MongoDB Documentation: https://docs.mongodb.com/
- React Documentation: https://react.dev/
- FastAPI Documentation: https://fastapi.tiangolo.com/
- Socket.IO Documentation: https://socket.io/docs/
- Cornerstone.js Documentation: https://cornerstonejs.org/
- DICOM Standard: https://www.dicomstandard.org/

### 12.3 License
MIT License (or specify your chosen license)

### 12.4 Contributors
List of contributors and maintainers

---

**Document End**

This product specification provides a complete guide for developers to build, maintain, and extend the IRExam platform. For questions or clarifications, refer to the additional documentation files or contact the development team.
