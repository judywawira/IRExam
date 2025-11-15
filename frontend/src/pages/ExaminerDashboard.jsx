import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function ExaminerDashboard() {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sessionsRes, examsRes] = await Promise.all([
        axios.get('/api/sessions'),
        axios.get('/api/exams')
      ])
      setSessions(sessionsRes.data.sessions)
      setExams(examsRes.data.exams)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    if (!selectedExam) {
      alert('Please select an exam')
      return
    }

    try {
      const response = await axios.post('/api/sessions', { examId: selectedExam })
      setSessions([response.data.session, ...sessions])
      setSelectedExam('')
      alert('Session created successfully')
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Failed to create session')
    }
  }

  const startSession = (sessionId) => {
    navigate(`/session/${sessionId}`)
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return

    try {
      await axios.delete(`/api/sessions/${sessionId}`)
      setSessions(sessions.filter(s => s._id !== sessionId))
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Examiner Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.firstName} {user.lastName}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create New Session</h2>
          <div className="flex gap-4">
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select an exam</option>
              {exams.map(exam => (
                <option key={exam._id} value={exam._id}>
                  {exam.title} ({exam.cases.length} cases, {exam.duration} min)
                </option>
              ))}
            </select>
            <button
              onClick={createSession}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create Session
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Your Exam Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500">No sessions yet. Create one above.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => (
                <div key={session._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{session.exam.title}</h3>
                      <p className="text-sm text-gray-600">
                        Status: <span className={`font-medium ${
                          session.status === 'active' ? 'text-green-600' :
                          session.status === 'completed' ? 'text-gray-600' :
                          session.status === 'paused' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>{session.status}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Participants: {session.participants.length}
                      </p>
                      <p className="text-sm text-gray-600">
                        Created: {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {session.status !== 'completed' && (
                        <button
                          onClick={() => startSession(session._id)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {session.status === 'active' ? 'Resume' : 'Start'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(session._id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
