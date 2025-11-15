import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [sessionCode, setSessionCode] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await axios.get('/api/sessions')
      // Filter active and scheduled sessions
      const availableSessions = response.data.sessions.filter(
        s => s.status === 'active' || s.status === 'scheduled'
      )
      setSessions(availableSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinSession = async (sessionId) => {
    try {
      await axios.post(`/api/sessions/${sessionId}/join`)
      navigate(`/session/${sessionId}`)
    } catch (error) {
      console.error('Error joining session:', error)
      alert('Failed to join session')
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
              <h1 className="text-xl font-bold text-gray-900">Student Dashboard</h1>
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
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Available Exam Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500">No active sessions available at the moment.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => (
                <div key={session._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{session.exam.title}</h3>
                      <p className="text-sm text-gray-600">
                        Duration: {session.exam.duration} minutes
                      </p>
                      <p className="text-sm text-gray-600">
                        Cases: {session.exam.cases?.length || 0}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: <span className={`font-medium ${
                          session.status === 'active' ? 'text-green-600' : 'text-blue-600'
                        }`}>{session.status}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Participants: {session.participants.length}
                      </p>
                    </div>
                    <button
                      onClick={() => joinSession(session._id)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Join Session
                    </button>
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
