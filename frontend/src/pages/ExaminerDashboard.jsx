import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import ExaminerCaseManager from '../components/examiner/ExaminerCaseManager'

export default function ExaminerDashboard() {
  const { user, logout } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sessions')
  const navigate = useNavigate()

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await axios.get('/api/sessions')
      setSessions(response.data.sessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
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
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('sessions')}
                className={`${
                  activeTab === 'sessions'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Exam Sessions
              </button>
              <button
                onClick={() => setActiveTab('cases')}
                className={`${
                  activeTab === 'cases'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                My Cases
              </button>
            </nav>
          </div>
        </div>

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Your Assigned Exam Sessions</h2>
              <div className="text-sm text-gray-500">
                Sessions are created and assigned by administrators
              </div>
            </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions assigned</h3>
              <p className="mt-1 text-sm text-gray-500">
                Contact your administrator to have exam sessions assigned to you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => (
                <div key={session._id} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{session.exam.title}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className={`ml-2 font-medium ${
                            session.status === 'active' ? 'text-green-600' :
                            session.status === 'completed' ? 'text-gray-600' :
                            session.status === 'paused' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`}>
                            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-2">{Math.floor(session.timeRemaining / 60)} minutes remaining</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Participants:</span>
                          <span className="ml-2">{session.participants.length} joined</span>
                        </div>
                        {session.assignedStudents && session.assignedStudents.length > 0 && (
                          <div>
                            <span className="text-gray-600">Assigned Students:</span>
                            <span className="ml-2">{session.assignedStudents.length}</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-gray-600">Created:</span>
                          <span className="ml-2">{new Date(session.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {session.assignedStudents && session.assignedStudents.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium text-gray-700 mb-2">Assigned Students:</p>
                          <div className="flex flex-wrap gap-2">
                            {session.assignedStudents.map((student, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {student.firstName} {student.lastName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {session.status !== 'completed' && (
                        <button
                          onClick={() => startSession(session._id)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                        >
                          {session.status === 'active' || session.status === 'paused' ? 'Resume' : 'Start'}
                        </button>
                      )}
                      {session.status === 'completed' && (
                        <button
                          onClick={() => startSession(session._id)}
                          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(session._id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 whitespace-nowrap"
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
        )}

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          <div className="bg-white shadow rounded-lg p-6">
            <ExaminerCaseManager />
          </div>
        )}
      </div>
    </div>
  )
}
