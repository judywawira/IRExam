# IRExam FastAPI Backend - API Documentation

## Overview
FastAPI backend for the IRExam medical education platform with MongoDB, JWT authentication, and Socket.IO for real-time features.

**Base URL:** `http://localhost:5000`
**API Prefix:** `/api`

## Running the Server
```bash
cd backend-fastapi
pip install -r requirements.txt
uvicorn main:socket_app --host 0.0.0.0 --port 5000 --reload
```

## Auto-Generated Docs
- **Swagger UI:** `http://localhost:5000/docs`
- **ReDoc:** `http://localhost:5000/redoc`

---

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Register new user |
| POST | `/api/auth/login` | - | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |

#### POST /api/auth/register
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student"  // "admin", "examiner", "student"
}
```
**Response:** `{ "token": "...", "user": {...} }`

#### POST /api/auth/login
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:** `{ "token": "...", "user": {...} }`

---

## Cases

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cases` | JWT | List cases |
| GET | `/api/cases/{id}` | JWT | Get case details |
| POST | `/api/cases` | Admin/Examiner | Create case (multipart/form-data) |
| PUT | `/api/cases/{id}` | Admin/Examiner | Update case |
| DELETE | `/api/cases/{id}` | Admin/Examiner | Delete case |
| DELETE | `/api/cases/{id}/images/{imageId}` | Admin/Examiner | Delete image |
| GET | `/api/cases/{id}/annotations` | JWT | Get annotations |
| POST | `/api/cases/{id}/annotations` | JWT | Create annotation |
| PUT | `/api/cases/{id}/annotations/{annotationId}` | JWT | Update annotation |
| DELETE | `/api/cases/{id}/annotations/{annotationId}` | JWT | Delete annotation |

#### POST /api/cases (multipart/form-data)
- `title` (required): Case title
- `clinicalHistory`: Clinical history text
- `findings`: Findings text
- `diagnosis`: Diagnosis text
- `discussionPoints`: Discussion points
- `images`: File uploads (JPEG, PNG, GIF, DICOM, ZIP)

---

## Exams

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/exams` | JWT | List all exams |
| GET | `/api/exams/{id}` | JWT | Get exam with cases |
| POST | `/api/exams` | Admin | Create exam |
| PUT | `/api/exams/{id}` | Admin | Update exam |
| POST | `/api/exams/{id}/clone` | Admin | Clone exam |
| DELETE | `/api/exams/{id}` | Admin | Delete exam |

#### POST /api/exams
```json
{
  "title": "Radiology Exam 2024",
  "description": "Final exam",
  "cases": ["case_id_1", "case_id_2"],
  "duration": 60
}
```

---

## Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/sessions` | JWT | List sessions (role-filtered) |
| GET | `/api/sessions/{id}` | JWT | Get session with full details |
| POST | `/api/sessions` | Admin | Create session |
| POST | `/api/sessions/{id}/join` | Student | Join session |
| DELETE | `/api/sessions/{id}` | Examiner/Admin | Archive session |

#### POST /api/sessions
```json
{
  "name": "Morning Session",
  "exam": "exam_id",
  "examiner": "user_id",
  "assignedStudents": ["student_id_1", "student_id_2"],
  "scheduledFor": "2024-03-15T09:00:00Z"
}
```

---

## Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin | List users (filterable) |
| GET | `/api/admin/examiners` | Admin | List examiners |
| PATCH | `/api/admin/users/{id}/approve` | Admin | Approve user |
| PATCH | `/api/admin/users/{id}/revoke` | Admin | Revoke approval |
| PATCH | `/api/admin/users/{id}/archive` | Admin | Archive user |
| PATCH | `/api/admin/users/{id}/unarchive` | Admin | Unarchive user |
| DELETE | `/api/admin/users/{id}` | Admin | Delete user |
| POST | `/api/admin/sessions` | Admin | Create session |
| GET | `/api/admin/sessions` | Admin | List all sessions |
| PATCH | `/api/admin/sessions/{id}` | Admin | Update session |
| PATCH | `/api/admin/sessions/{id}/assign-examiner` | Admin | Assign examiner |
| PATCH | `/api/admin/sessions/{id}/assign-students` | Admin | Assign students |
| DELETE | `/api/admin/sessions/{id}` | Admin | Archive session |
| PATCH | `/api/admin/sessions/{id}/archive` | Admin | Archive session |
| PATCH | `/api/admin/sessions/{id}/unarchive` | Admin | Unarchive session |
| POST | `/api/admin/sessions/{id}/clone` | Admin | Clone session |

#### Query Parameters for GET /api/admin/users
- `role`: Filter by role (admin/examiner/student)
- `isApproved`: Filter by approval status (true/false)
- `isArchived`: Filter by archived status (true/false)

---

## Socket.IO Events

**Connection:** Include JWT token in auth object
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId }` | Join exam session room |
| `start-exam` | `{ sessionId }` | Start exam |
| `pause-exam` | `{ sessionId }` | Pause exam |
| `resume-exam` | `{ sessionId }` | Resume exam |
| `next-image` | `{ sessionId }` | Go to next image |
| `prev-image` | `{ sessionId }` | Go to previous image |
| `go-to-image` | `{ sessionId, index }` | Go to specific image |
| `update-timer` | `{ sessionId, timeRemaining }` | Update timer |
| `end-exam` | `{ sessionId }` | End exam |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session-state` | `{ status, currentImageIndex, timeRemaining }` | Initial state |
| `exam-started` | `{ status }` | Exam started |
| `exam-paused` | `{ status }` | Exam paused |
| `exam-resumed` | `{ status }` | Exam resumed |
| `image-changed` | `{ currentImageIndex }` | Image navigation |
| `timer-update` | `{ timeRemaining }` | Timer sync |
| `exam-ended` | `{ status }` | Exam ended |

---

## Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status |
| GET | `/api/health` | API status |

---

## File Uploads

- **Endpoint:** `/uploads/{filename}`
- **Supported formats:** JPEG, PNG, GIF, DICOM (.dcm), ZIP (containing DICOM)
- **Max size:** 500MB

---

## Error Responses

```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad request
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `422` - Validation error
