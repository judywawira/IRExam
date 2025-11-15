import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import ExaminerDashboard from './pages/ExaminerDashboard'
import StudentDashboard from './pages/StudentDashboard'
import ExamSession from './pages/ExamSession'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />
  }

  return children
}

const DashboardRouter = () => {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" />

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />
    case 'examiner':
      return <ExaminerDashboard />
    case 'student':
      return <StudentDashboard />
    default:
      return <Navigate to="/login" />
  }
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/session/:sessionId"
            element={
              <ProtectedRoute>
                <ExamSession />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
