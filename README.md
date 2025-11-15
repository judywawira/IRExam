# IR Exam - Image-Based Case Examination System

A real-time, synchronized examination system for delivering image-based cases to medical residents. Built with React, Node.js, Socket.IO, and MongoDB.

## Features

### User Roles

1. **Admin**
   - Create and manage image-based cases with clinical histories
   - Upload multiple images per case (JPEG, PNG, GIF, DICOM)
   - Create exams by selecting cases
   - Set exam duration

2. **Examiner**
   - Create exam sessions
   - Control live exam sessions in real-time
   - Navigate through cases and images
   - All students see the same image simultaneously
   - Start, pause, resume, and end exams
   - Monitor participants

3. **Student**
   - Join available exam sessions
   - View synchronized images controlled by examiner
   - See clinical history for each case
   - Synchronized timer across all participants

### Real-Time Synchronization

- Socket.IO ensures all students see the exact same image at the same time
- Synchronized countdown timer
- Live exam controls (start, pause, resume, end)
- Real-time participant tracking

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- Socket.IO (real-time communication)
- JWT Authentication
- Multer (file uploads)
- bcryptjs (password hashing)

### Frontend
- React 18
- React Router
- Axios
- Socket.IO Client
- Tailwind CSS
- React Dropzone
- Vite (build tool)

## Installation

### Prerequisites

- Node.js 18+ and npm
- MongoDB 4.4+

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` with your settings:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/irexam
JWT_SECRET=your_secure_random_string_here
NODE_ENV=development
UPLOAD_DIR=./uploads
```

5. Create uploads directory:
```bash
mkdir uploads
```

6. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage Guide

### 1. Register Users

Visit `http://localhost:3000/register` and create accounts with different roles:
- Admin (for managing cases and exams)
- Examiner (for running exam sessions)
- Student (for taking exams)

### 2. Create Cases (Admin)

1. Login as Admin
2. Go to "Manage Cases" tab
3. Click "Create New Case"
4. Fill in:
   - Case title
   - Clinical history
   - Upload multiple images (drag & drop or click to select)
5. Click "Create Case"

### 3. Create Exams (Admin)

1. Go to "Manage Exams" tab
2. Click "Create New Exam"
3. Fill in:
   - Exam title
   - Description (optional)
   - Duration in minutes
   - Select cases to include
4. Click "Create Exam"

### 4. Run Exam Session (Examiner)

1. Login as Examiner
2. Select an exam from the dropdown
3. Click "Create Session"
4. Click "Start" to enter the exam session
5. Use controls to:
   - Start the exam (begins timer)
   - Navigate between images (Previous/Next buttons)
   - Pause/Resume exam
   - End exam

### 5. Take Exam (Student)

1. Login as Student
2. See available exam sessions
3. Click "Join Session"
4. View images as examiner advances them
5. See synchronized timer and clinical history

## Project Structure

```
IRExam/
├── backend/
│   ├── models/           # MongoDB schemas
│   │   ├── User.js
│   │   ├── Case.js
│   │   ├── Exam.js
│   │   └── ExamSession.js
│   ├── routes/           # API endpoints
│   │   ├── auth.js
│   │   ├── cases.js
│   │   ├── exams.js
│   │   └── sessions.js
│   ├── middleware/       # Auth middleware
│   │   └── auth.js
│   ├── socket/           # Socket.IO handlers
│   │   └── examSession.js
│   ├── uploads/          # Image storage
│   ├── server.js         # Entry point
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   │   └── admin/
    │   │       ├── CaseManager.jsx
    │   │       └── ExamManager.jsx
    │   ├── context/      # React context
    │   │   └── AuthContext.jsx
    │   ├── pages/        # Page components
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── AdminDashboard.jsx
    │   │   ├── ExaminerDashboard.jsx
    │   │   ├── StudentDashboard.jsx
    │   │   └── ExamSession.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Cases (Admin only)
- `POST /api/cases` - Create case with images
- `GET /api/cases` - Get all cases
- `GET /api/cases/:id` - Get single case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case
- `DELETE /api/cases/:id/images/:imageId` - Delete specific image

### Exams (Admin only)
- `POST /api/exams` - Create exam
- `GET /api/exams` - Get all exams
- `GET /api/exams/:id` - Get single exam
- `PUT /api/exams/:id` - Update exam
- `DELETE /api/exams/:id` - Delete exam

### Sessions
- `POST /api/sessions` - Create session (Examiner)
- `GET /api/sessions` - Get sessions
- `GET /api/sessions/:id` - Get single session
- `POST /api/sessions/:id/join` - Join session (Student)
- `DELETE /api/sessions/:id` - Delete session (Examiner)

## Socket.IO Events

### Client to Server
- `join-session` - Join exam session room
- `start-exam` - Start exam (Examiner)
- `navigate-image` - Change current image (Examiner)
- `update-timer` - Update timer
- `pause-exam` - Pause exam (Examiner)
- `resume-exam` - Resume exam (Examiner)
- `end-exam` - End exam (Examiner)

### Server to Client
- `session-state` - Current session state
- `exam-started` - Exam has started
- `exam-paused` - Exam paused
- `exam-resumed` - Exam resumed
- `exam-ended` - Exam ended
- `image-changed` - Image changed
- `timer-update` - Timer update
- `error` - Error message

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control
- Protected API routes
- Socket.IO authentication
- Input validation

## Production Deployment

### Environment Variables

Update `.env` for production:
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=very_secure_random_string
UPLOAD_DIR=/path/to/uploads
FRONTEND_URL=https://your-frontend-domain.com
```

### Build Frontend

```bash
cd frontend
npm run build
```

Serve the `dist` folder with your preferred static hosting or configure Express to serve it.

### MongoDB

For production, use:
- MongoDB Atlas (cloud)
- Self-hosted MongoDB instance

### File Storage

For production, consider:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

Update file upload/retrieval logic accordingly.

## Future Enhancements

- [ ] Student answer submission
- [ ] Automated grading
- [ ] Analytics and reporting
- [ ] Export results
- [ ] Multiple choice questions
- [ ] Recording exam sessions
- [ ] DICOM viewer integration
- [ ] Mobile responsive improvements
- [ ] Email notifications
- [ ] Session recordings playback

## License

MIT License

## Support

For issues and questions, please create an issue in the repository.
